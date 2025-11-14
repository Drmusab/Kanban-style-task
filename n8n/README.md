# n8n Custom Node for Kanban App

This directory contains a reusable n8n custom node that connects to the Kanban Task Management backend.

## Features

- Supports CRUD operations for boards and tasks
- Fetches sync events for near real-time updates
- Includes a trigger node for polling the Kanban backend event stream
- Handles pagination when retrieving large lists
- Uses the application's API key authentication for secure access

## Installation

1. Install dependencies and compile the TypeScript sources:
   ```bash
   cd n8n
   npm install
   npm run build
   ```
   This produces the JavaScript implementation inside the `dist/` directory that n8n loads at runtime.
2. Copy the `n8n` directory (including the generated `dist/` folder) into your n8n custom nodes folder (usually `~/.n8n/custom/`).
3. Restart n8n so it can discover the new node.

## Running inside Docker

The repository includes a Docker image that bakes the Kanban App node into an n8n instance. Build and start the stack with docker compose:

```bash
docker compose up --build
```

The compose file exposes the n8n editor on [http://localhost:5678](http://localhost:5678). The custom node is automatically copied into `/home/node/.n8n/custom/` inside the container and is available without additional manual steps.

## Configuration

1. In n8n, add new credentials of type **Kanban App API**.
2. Provide the backend base URL (for example, `http://localhost:3001`).
3. If your Kanban backend requires an API key, enter it in the **API Key** field.

## Usage

### Kanban App Node

1. Drag the **Kanban App** node onto your workflow canvas.
2. Choose a resource (Task, Board, or Synchronization) and the desired operation.
3. Configure the required parameters. Additional optional fields are exposed as needed.
4. Connect the node in your workflow and execute the workflow to interact with the Kanban backend.

### Kanban App Trigger Node

1. Drag the **Kanban App Trigger** onto your workflow.
2. Select the event types you want to monitor and adjust the polling cadence if needed.
3. Execute the workflow (or activate it) to receive streaming updates as boards and tasks change.

The node returns the JSON data from the backend so it can be chained with other n8n nodes for automation and integrations.
