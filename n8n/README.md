# n8n Custom Node for Kanban App

This directory contains a reusable n8n custom node that connects to the Kanban Task Management backend.

## Features

- Supports CRUD operations for boards and tasks
- Handles pagination when retrieving large lists
- Uses the application's API key authentication for secure access

## Installation

1. Copy the `n8n` directory into your n8n custom nodes folder (usually `~/.n8n/custom/`).
2. Restart n8n so it can discover the new node.

## Configuration

1. In n8n, add new credentials of type **Kanban App API**.
2. Provide the backend base URL (for example, `http://localhost:3001`).
3. If your Kanban backend requires an API key, enter it in the **API Key** field.

## Usage

1. Drag the **Kanban App** node onto your workflow canvas.
2. Choose a resource (Task or Board) and the desired operation.
3. Configure the required parameters. Additional optional fields are exposed as needed.
4. Connect the node in your workflow and execute the workflow to interact with the Kanban backend.

The node returns the JSON data from the backend so it can be chained with other n8n nodes for automation and integrations.
