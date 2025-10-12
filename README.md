# Kanban Task Management Application

A comprehensive Kanban-style task management web application that runs locally on your PC, utilizing a local SQLite database for persistent storage and providing an intuitive, responsive web interface for managing tasks.

## Features

### Core Kanban Features
- Fully customizable columns and swimlanes
- Drag-and-drop functionality for tasks
- Board template system
- Rich task structure with Markdown support
- Task history and audit trail

### Advanced Features
- n8n integration with webhooks
- Time-based tasks with recurring patterns
- Background automation and notifications
- Offline-first design
- Analytics and reporting
- Theming and accessibility
- Backup and restore functionality

## Getting Started

### Prerequisites
- Docker and Docker Compose installed on your system

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/kanban-app.git
cd kanban-app







Create environment files:
bash

Line Wrapping

Collapse
Copy
1
cp .env.example .env
Start the application using Docker Compose:
bash

Line Wrapping

Collapse
Copy
1
docker-compose up -d
Access the application:
Frontend: http://localhost:3000
Backend API: http://localhost:3001
Default Login Credentials
Username: demo
Password: demo123
Usage
Creating a Board
Click on the "Boards" tab
Click the "+" button to create a new board
Give your board a name and description
Click "Create"
Adding Columns
Open a board
Click the "Add Column" button
Configure the column name, color, and icon
Click "Create"
Adding Swimlanes
Open a board
Click the "Add Swimlane" button
Configure the swimlane name and color
Click "Create"
Creating Tasks
Click the "Add Task" button in any column
Fill in the task details
Add tags, subtasks, and due dates as needed
Click "Create"
Setting Up n8n Integration
Go to Settings > Integrations
Click "Add Integration"
Select "n8n Webhook"
Enter your webhook URL and API key
Click "Save"

Securing Webhook Endpoints
Set the `N8N_API_KEY` value in your `.env` file (or export it before running Docker) to enable API key authentication for automation and webhook endpoints.
Include the key in external requests through the `x-api-key` header or a `Bearer` token (e.g. `Authorization: Bearer <your-key>`).
Creating Automation Rules
Go to Settings > Automation
Click "Add Rule"
Configure the trigger and action
Click "Save"
API Documentation
Tasks
GET /api/tasks - Get all tasks
GET /api/tasks/:id - Get a specific task
POST /api/tasks - Create a new task
POST /api/tasks/create - Create a task through an API-key protected automation webhook
POST /api/tasks/update - Update a task through an API-key protected automation webhook
POST /api/tasks/delete - Delete a task through an API-key protected automation webhook
PUT /api/tasks/:id - Update a task
DELETE /api/tasks/:id - Delete a task
Boards
GET /api/boards - Get all boards
GET /api/boards/:id - Get a specific board
POST /api/boards - Create a new board
PUT /api/boards/:id - Update a board
DELETE /api/boards/:id - Delete a board
Integrations
GET /api/integrations - Get all integrations
POST /api/integrations - Create a new integration
PUT /api/integrations/:id - Update an integration
DELETE /api/integrations/:id - Delete an integration
POST /api/integrations/test-n8n-webhook - Test an n8n webhook
Automation
GET /api/automation - Get all automation rules
POST /api/automation - Create a new automation rule
PUT /api/automation/:id - Update an automation rule
DELETE /api/automation/:id - Delete an automation rule
POST /api/automation/:id/trigger - Manually trigger an automation rule
Development
Running in Development Mode
Install dependencies:
bash

Line Wrapping

Collapse
Copy
1
2
cd backend && npm install
cd ../frontend && npm install
Start the backend:
bash

Line Wrapping

Collapse
Copy
1
cd backend && npm run dev
Start the frontend:
bash

Line Wrapping

Collapse
Copy
1
cd frontend && npm start
Database Schema
The application uses SQLite with the following main tables:

users
boards
columns
swimlanes
tasks
tags
task_tags
subtasks
attachments
task_history
integrations
automation_rules
automation_logs
Contributing
Fork the repository
Create a feature branch
Make your changes
Commit your changes
Push to the branch
Create a pull request"# Kanban-style-task" 
