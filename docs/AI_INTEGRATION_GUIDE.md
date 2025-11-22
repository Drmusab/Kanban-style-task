# AI-Integrated Task Manager - Enhanced Features Documentation

## Overview

This document describes the enhanced features that transform the Kanban Task Management application into a Local-First AI-Integrated Task Manager with comprehensive n8n integration.

## Table of Contents

1. [AI Agent Node](#ai-agent-node)
2. [Notification Node](#notification-node)
3. [Reporting Node](#reporting-node)
4. [Routine Task Management](#routine-task-management)
5. [API Reference](#api-reference)
6. [n8n Integration Examples](#n8n-integration-examples)

---

## AI Agent Node

The AI Agent interprets natural language commands and converts them into CRUD operations on the Kanban board.

### Supported Commands

#### 1. Create Task
```
Create task "Write release notes" in Done
Add task "Fix critical bug" to In Progress
Create high priority task "Deploy to production" in To Do
Add low priority task "Update documentation" to To Do with medium priority
```

#### 2. Move Task
```
Move task "Upgrade dependencies" to In Progress
```

#### 3. Complete Task
```
Complete task "Push to production"
Mark task "Deploy application" as complete
Finish task "Testing phase"
```

#### 4. Set Due Date
```
Set due date for task "Write tests" to 2024-12-01 17:00
Set due date for task "Deploy" to 2024-12-15T10:00:00Z
```

#### 5. Set Priority
```
Set task "Fix bug" priority to high
Set "Security audit" to critical
```

#### 6. List Tasks
```
List tasks in To Do
Show all tasks
Get tasks in In Progress
```

#### 7. Generate Reports
```
Show weekly report
Generate report
Get analytics
```

### API Endpoint

**POST** `/api/ai/command`

**Request Body:**
```json
{
  "command": "Create high priority task \"Deploy application\" in To Do"
}
```

**Success Response:**
```json
{
  "action": "create",
  "success": true,
  "taskId": 123,
  "columnId": 1,
  "priority": "high",
  "message": "Created high priority task \"Deploy application\" in To Do"
}
```

**Error Response:**
```json
{
  "error": "Unable to understand the command. Try specifying the task title and column."
}
```

### Supported Actions

- `create` - Create a new task with optional priority
- `move` - Move a task to a different column
- `complete` - Mark a task as complete
- `set_due` - Set or update a task due date
- `set_priority` - Update task priority (low, medium, high, critical)
- `list` - List tasks (all or filtered by column)
- `report` - Generate weekly report with analytics

---

## Notification Node

The Notification Node sends notifications to n8n webhooks for task events, due dates, and routine reminders.

### Notification Types

1. **Task Due Notifications**
   - Sent when a task is approaching its due date
   - Sent when a task is overdue
   
2. **Routine Reminders**
   - Sent when a recurring task is scheduled
   - Sent when a new instance of a routine task is created

3. **Custom Notifications**
   - Can be sent for any event with custom metadata

### Notification Payload Structure

```json
{
  "type": "notification",
  "title": "Task Due Soon",
  "message": "Task \"Deploy application\" is due in 30 minutes",
  "notificationType": "due",
  "priority": "high",
  "taskId": 123,
  "boardId": 1,
  "timestamp": "2024-11-22T19:30:00.000Z",
  "metadata": {
    "dueDate": "2024-11-22T20:00:00.000Z",
    "minutesUntilDue": 30,
    "isOverdue": false
  }
}
```

### Configuration

Notifications are automatically sent to all enabled n8n webhook integrations configured in the system.

To configure n8n webhook integration:

**POST** `/api/integrations`

```json
{
  "name": "n8n Notification Webhook",
  "type": "n8n_webhook",
  "enabled": true,
  "config": {
    "webhookUrl": "https://your-n8n-instance.com/webhook/kanban-notifications",
    "apiKey": "your-api-key-if-needed"
  }
}
```

### Automated Notifications

The scheduler automatically sends notifications for:

- Tasks due within 1 hour
- Overdue tasks (more than 1 hour past due date)
- Recurring task reminders when new instances are created

---

## Reporting Node

The Reporting Node generates comprehensive reports and analytics, which can be automatically sent to n8n webhooks.

### Report Types

#### 1. Weekly Report

Comprehensive report covering the last 7 days:

**GET** `/api/reports/weekly`

**Response:**
```json
{
  "period": {
    "start": "2024-11-15T19:30:00.000Z",
    "end": "2024-11-22T19:30:00.000Z",
    "days": 7
  },
  "summary": {
    "tasksCreated": 25,
    "tasksCompleted": 18,
    "tasksOverdue": 3,
    "completionRate": "72.00%",
    "avgCompletionTimeHours": "24.50"
  },
  "tasksByColumn": [
    { "column": "To Do", "count": 10 },
    { "column": "In Progress", "count": 7 },
    { "column": "Done", "count": 18 }
  ],
  "tasksByPriority": [
    { "priority": "high", "count": 5 },
    { "priority": "medium", "count": 10 },
    { "priority": "low", "count": 2 }
  ],
  "activeBoards": [
    {
      "id": 1,
      "name": "Development",
      "task_count": 25,
      "recent_activity": 12
    }
  ]
}
```

#### 2. Custom Date Range Report

Generate reports for any date range:

**GET** `/api/reports/custom?startDate=2024-11-01T00:00:00Z&endDate=2024-11-30T23:59:59Z`

**Response:**
```json
{
  "period": {
    "start": "2024-11-01T00:00:00.000Z",
    "end": "2024-11-30T23:59:59.000Z",
    "days": 30
  },
  "summary": {
    "tasksCreated": 85,
    "tasksCompleted": 72,
    "completionRate": "84.71%"
  },
  "tasksByColumn": [...]
}
```

#### 3. Productivity Analytics

Get detailed productivity metrics:

**GET** `/api/reports/analytics?days=30`

**Response:**
```json
{
  "period": {
    "days": 30,
    "start": "2024-10-23T19:30:00.000Z",
    "end": "2024-11-22T19:30:00.000Z"
  },
  "dailyCompletions": [
    { "date": "2024-11-22", "count": 5 },
    { "date": "2024-11-21", "count": 8 },
    ...
  ],
  "userProductivity": [
    { "assigned_to": "john.doe", "tasks_completed": 45 },
    { "assigned_to": "jane.smith", "tasks_completed": 38 }
  ],
  "velocity": [
    { "week_ago": 0, "count": 18 },
    { "week_ago": 1, "count": 22 },
    ...
  ]
}
```

### Sending Reports to n8n

#### Send Weekly Report

**POST** `/api/reports/weekly/send-to-n8n`

Generates the weekly report and sends it to all configured n8n webhooks.

**Response:**
```json
{
  "success": true,
  "message": "Report sent to 2 of 2 webhooks"
}
```

#### Send Custom Report

**POST** `/api/reports/custom/send-to-n8n`

**Request Body:**
```json
{
  "startDate": "2024-11-01T00:00:00Z",
  "endDate": "2024-11-30T23:59:59Z"
}
```

### Automated Weekly Reports

The scheduler automatically generates and sends weekly reports to n8n every Monday at 9:00 AM.

Report Payload sent to n8n:
```json
{
  "type": "report",
  "reportType": "weekly",
  "timestamp": "2024-11-25T09:00:00.000Z",
  "data": {
    "period": {...},
    "summary": {...},
    "tasksByColumn": [...],
    "tasksByPriority": [...],
    "activeBoards": [...]
  }
}
```

---

## Routine Task Management

Manage recurring tasks with flexible scheduling options.

### Create Recurring Task

**POST** `/api/routines`

**Request Body:**
```json
{
  "title": "Daily Standup",
  "description": "Team standup meeting",
  "columnId": 1,
  "startAt": "2024-11-23T09:00:00Z",
  "frequency": "daily",
  "interval": 1,
  "occurrences": 30
}
```

**Supported Frequencies:**
- `daily` - Repeat every N days
- `weekly` - Repeat every N weeks
- `monthly` - Repeat every N months
- `yearly` - Repeat every N years

**Optional Parameters:**
- `interval` - Repeat every N periods (default: 1)
- `occurrences` - Maximum number of occurrences
- `endDate` - Date when recurrence should stop

### Routine Reminders

When a new instance of a recurring task is created, the system automatically:

1. Creates the task in the specified column
2. Sends a routine reminder notification to n8n webhooks

**Reminder Payload:**
```json
{
  "type": "notification",
  "title": "Routine Reminder",
  "message": "Routine task \"Daily Standup\" is scheduled",
  "notificationType": "routine",
  "priority": "normal",
  "taskId": 456,
  "timestamp": "2024-11-23T09:00:00.000Z",
  "metadata": {
    "dueDate": "2024-11-23T09:00:00.000Z",
    "recurringRule": "{\"frequency\":\"daily\",\"interval\":1}"
  }
}
```

---

## API Reference

### AI Commands

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/command` | POST | Execute natural language command |
| `/api/ai/patterns` | GET | Get supported command patterns and examples |

### Reports

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reports/weekly` | GET | Get weekly report |
| `/api/reports/custom` | GET | Get custom date range report |
| `/api/reports/analytics` | GET | Get productivity analytics |
| `/api/reports/weekly/send-to-n8n` | POST | Send weekly report to n8n |
| `/api/reports/custom/send-to-n8n` | POST | Send custom report to n8n |

### Routines

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/routines` | POST | Create recurring task |

### Integrations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/integrations` | GET | List all integrations |
| `/api/integrations` | POST | Create new integration |
| `/api/integrations/test-n8n-webhook` | POST | Test n8n webhook |

---

## n8n Integration Examples

### Example 1: AI Task Management Workflow

```
1. Webhook Trigger (receives natural language command)
2. HTTP Request to /api/ai/command
3. Process response
4. Send confirmation notification
```

**n8n Webhook Node Configuration:**
- Method: POST
- Path: `/kanban-ai-command`

**HTTP Request Node:**
- Method: POST
- URL: `http://kanban-backend:3001/api/ai/command`
- Body:
  ```json
  {
    "command": "{{$json.command}}"
  }
  ```

### Example 2: Automated Weekly Reports

```
1. Cron Trigger (Every Monday at 9 AM)
2. HTTP Request to /api/reports/weekly
3. Format Report
4. Send to Email/Slack/etc.
```

**HTTP Request Node:**
- Method: GET
- URL: `http://kanban-backend:3001/api/reports/weekly`

### Example 3: Task Due Notifications

```
1. Webhook Trigger (receives notification from Kanban app)
2. Filter by notification type
3. Format message
4. Send to Slack/Email/etc.
```

**Webhook receives:**
```json
{
  "type": "notification",
  "title": "Task Due Soon",
  "message": "Task \"Deploy application\" is due in 30 minutes",
  "notificationType": "due",
  "priority": "high",
  "taskId": 123
}
```

### Example 4: Routine Task Reminders

```
1. Webhook Trigger (receives routine reminder)
2. Check if it's a weekday
3. Send reminder to team channel
```

**Filter Node:**
- Only process if `notificationType` === 'routine'
- Only process if today is a weekday

---

## Scheduler Automation

The application includes a built-in scheduler that runs background jobs:

### Scheduled Tasks

1. **Due Date Monitoring** (Every minute)
   - Checks for tasks approaching due date (within 1 hour)
   - Checks for overdue tasks
   - Sends notifications to n8n webhooks

2. **Recurring Task Generation** (Daily at midnight)
   - Creates new instances of recurring tasks
   - Sends routine reminders

3. **Weekly Report Generation** (Mondays at 9 AM)
   - Generates comprehensive weekly report
   - Sends to all configured n8n webhooks

4. **Log Cleanup** (Weekly on Sundays)
   - Removes automation logs older than 7 days

---

## Security

### API Key Authentication

Webhook endpoints can be secured with API keys:

**Environment Variable:**
```
N8N_API_KEY=your-secure-api-key-here
```

**Request Header:**
```
x-api-key: your-secure-api-key-here
```

Or:
```
Authorization: Bearer your-secure-api-key-here
```

### Rate Limiting

All API endpoints are protected with rate limiting:
- 100 requests per 15 minutes per IP address

---

## Best Practices

### 1. AI Command Usage

- Use quoted task names for multi-word tasks
- Specify priority during creation when needed
- Column names are case-insensitive

### 2. n8n Webhooks

- Configure webhook URL with HTTPS for production
- Use API key authentication for security
- Test webhooks before enabling

### 3. Reporting

- Use weekly reports for regular monitoring
- Use custom reports for specific analysis
- Schedule reports during low-traffic periods

### 4. Routine Tasks

- Set reasonable intervals for recurring tasks
- Use `occurrences` or `endDate` to prevent unlimited tasks
- Review and archive completed routine tasks regularly

---

## Troubleshooting

### AI Commands Not Working

1. Check command syntax matches supported patterns
2. Verify column names exist in the database
3. Check for typos in task names
4. Review `/api/ai/patterns` for examples

### Notifications Not Received

1. Verify n8n webhook integration is enabled
2. Check webhook URL is accessible
3. Review integration configuration
4. Check n8n webhook logs

### Reports Empty or Missing Data

1. Verify tasks exist in the date range
2. Check database for completed tasks
3. Ensure tasks have proper timestamps
4. Review column names (e.g., "Done" for completed tasks)

---

## Support

For additional help:
- Check application logs for detailed error messages
- Review test files for usage examples
- Consult the main README.md for general setup
- Create an issue on GitHub for bugs or feature requests

---

**Version:** 1.0.0  
**Last Updated:** November 22, 2024
