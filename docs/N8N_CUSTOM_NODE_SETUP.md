# n8n Custom Node Setup for the Kanban Task Management Application

This guide walks you through using the bundled n8n custom nodes that integrate directly with the Kanban Task Management Application. The nodes ship with this repository and expose both action and trigger capabilities for automating your boards and tasks.

## Prerequisites
- Running Kanban backend (port `3001` by default)
- Node.js 18+ and npm 8+ (for local builds) or Docker if using containers
- Access to the repository source code

## Quick Start (Docker Compose)
1. Set an API key in your backend `.env` file under `N8N_API_KEY`.
2. From the repository root, launch the stack:
   ```bash
   docker compose up --build
   ```
3. Open n8n at http://localhost:5678 and create **Kanban App API** credentials using your backend URL and API key.
4. Add the **Kanban App** action node or **Kanban App Trigger** node to your workflow to interact with tasks, boards, and sync events.

## Using the Custom Node in an Existing n8n Instance
If you already have an n8n server running elsewhere, you can install the node package manually.

```bash
cd n8n
npm install
npm run build
# Copy the dist folder to your n8n custom extensions directory
cp -R dist ~/.n8n/custom/n8n-nodes-kanban-app
```

Restart n8n so it can load the new extension (ensure `N8N_CUSTOM_EXTENSIONS` points to `~/.n8n/custom`).

## Node Capabilities
- **Kanban App (Action) Node**: Create, read, update, or delete tasks and boards. Fetch change events via the synchronization resource for downstream workflows.
- **Kanban App Trigger Node**: Poll the backend for new events and emit them into workflows based on event type filters, polling intervals, and lookback windows.

## Troubleshooting
- Ensure the backend URL in your credentials is reachable from the n8n instance.
- If authentication fails, regenerate `N8N_API_KEY` in the backend `.env` and update the credentials.
- Run `npm run build` inside the `n8n` folder after making changes to the node source to refresh the compiled output.
