"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KanbanAppApi = void 0;
class KanbanAppApi {
    constructor() {
        this.name = 'kanbanAppApi';
        this.displayName = 'Kanban App API';
        this.documentationUrl = 'https://github.com/your-username/kanban-app';
        this.properties = [
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
}
exports.KanbanAppApi = KanbanAppApi;
//# sourceMappingURL=KanbanAppApi.credentials.js.map