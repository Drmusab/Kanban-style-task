import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class KanbanAppApi implements ICredentialType {
  name = 'kanbanAppApi';

  displayName = 'Kanban App API';

  documentationUrl = 'https://github.com/your-username/kanban-app';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:3001',
      placeholder: 'https://kanban.example.com',
      required: true,
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description: 'API key used for securing webhook and automation endpoints',
    },
  ];
}
