import type { IExecuteFunctions } from 'n8n-core';
import type { IDataObject, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import { kanbanApiRequest } from './GenericFunctions';

function buildTaskPayload(
  data: IDataObject,
  options: { includeEmptyStrings?: boolean } = {},
): IDataObject {
  const { includeEmptyStrings = true } = options;
  const payload: IDataObject = {};

  for (const [rawKey, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }

    if (!includeEmptyStrings && value === '') {
      continue;
    }

    let key = rawKey;

    if (rawKey === 'columnId') {
      key = 'column_id';
    }

    if (key === 'tags') {
      if (Array.isArray(value)) {
        payload[key] = value.filter((tag) => tag !== undefined && tag !== null);
      } else if (typeof value === 'string') {
        payload[key] = value
          .split(',')
          .map((tagId) => tagId.trim())
          .filter((tagId) => tagId !== '')
          .map((tagId) => (Number.isNaN(Number(tagId)) ? tagId : Number(tagId)));
      }
      continue;
    }

    if (key === 'pinned' && typeof value === 'boolean') {
      payload[key] = value ? 1 : 0;
      continue;
    }

    payload[key] = value;
  }

  return payload;
}

function buildBoardPayload(data: IDataObject): IDataObject {
  const payload: IDataObject = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }

    if (key === 'template' && typeof value === 'boolean') {
      payload[key] = value ? 1 : 0;
      continue;
    }

    payload[key] = value;
  }

  return payload;
}

async function handleTaskOperation(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<IDataObject | IDataObject[]> {
  if (operation === 'create') {
    const title = this.getNodeParameter('title', itemIndex) as string;
    const columnId = this.getNodeParameter('columnId', itemIndex) as number;
    const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

    const body: IDataObject = buildTaskPayload({
      title,
      column_id: columnId,
      ...additionalFields,
    });

    return kanbanApiRequest.call(this, 'POST', '/api/tasks', body);
  }

  if (operation === 'get') {
    const taskId = this.getNodeParameter('taskId', itemIndex) as number;
    return kanbanApiRequest.call(this, 'GET', `/api/tasks/${taskId}`);
  }

  if (operation === 'getAll') {
    const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
    const response = (await kanbanApiRequest.call(this, 'GET', '/api/tasks')) as IDataObject[];

    if (returnAll) {
      return response;
    }

    const limit = this.getNodeParameter('limit', itemIndex) as number;
    return response.slice(0, limit);
  }

  if (operation === 'update') {
    const taskId = this.getNodeParameter('taskId', itemIndex) as number;
    const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

    if (Object.keys(additionalFields).length === 0) {
      throw new Error('At least one field must be provided to update a task.');
    }

    const body: IDataObject = buildTaskPayload(additionalFields);

    return kanbanApiRequest.call(this, 'PUT', `/api/tasks/${taskId}`, body);
  }

  if (operation === 'delete') {
    const taskId = this.getNodeParameter('taskId', itemIndex) as number;
    const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
    const body: IDataObject = buildTaskPayload(additionalFields, { includeEmptyStrings: false });

    await kanbanApiRequest.call(this, 'DELETE', `/api/tasks/${taskId}`, body);
    return { success: true };
  }

  throw new Error(`Unsupported task operation: ${operation}`);
}

async function handleBoardOperation(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<IDataObject | IDataObject[]> {
  if (operation === 'create') {
    const name = this.getNodeParameter('boardName', itemIndex) as string;
    const additionalFields = this.getNodeParameter('boardAdditionalFields', itemIndex, {}) as IDataObject;
    const body: IDataObject = buildBoardPayload({
      name,
      ...additionalFields,
    });

    return kanbanApiRequest.call(this, 'POST', '/api/boards', body);
  }

  if (operation === 'get') {
    const boardId = this.getNodeParameter('boardId', itemIndex) as number;
    return kanbanApiRequest.call(this, 'GET', `/api/boards/${boardId}`);
  }

  if (operation === 'getAll') {
    const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
    const response = (await kanbanApiRequest.call(this, 'GET', '/api/boards')) as IDataObject[];

    if (returnAll) {
      return response;
    }

    const limit = this.getNodeParameter('limit', itemIndex) as number;
    return response.slice(0, limit);
  }

  if (operation === 'update') {
    const boardId = this.getNodeParameter('boardId', itemIndex) as number;
    const additionalFields = this.getNodeParameter('boardAdditionalFields', itemIndex, {}) as IDataObject;

    if (Object.keys(additionalFields).length === 0) {
      throw new Error('At least one field must be provided to update a board.');
    }

    const body = buildBoardPayload(additionalFields);

    return kanbanApiRequest.call(this, 'PUT', `/api/boards/${boardId}`, body);
  }

  if (operation === 'delete') {
    const boardId = this.getNodeParameter('boardId', itemIndex) as number;
    await kanbanApiRequest.call(this, 'DELETE', `/api/boards/${boardId}`);
    return { success: true };
  }

  throw new Error(`Unsupported board operation: ${operation}`);
}

async function handleSyncOperation(
  this: IExecuteFunctions,
  itemIndex: number,
  operation: string,
): Promise<IDataObject[]> {
  if (operation !== 'getUpdates') {
    throw new Error(`Unsupported sync operation: ${operation}`);
  }

  const selectedEventTypes = (this.getNodeParameter('eventTypes', itemIndex, []) as string[]) || [];
  const initialLookback = this.getNodeParameter('initialLookback', itemIndex, 5) as number;
  const lastEventId = this.getNodeParameter('lastEventId', itemIndex, '') as string;
  const syncLimit = this.getNodeParameter('syncLimit', itemIndex, 100) as number;

  const query: IDataObject = {
    limit: syncLimit,
  };

  if (lastEventId) {
    query.lastEventId = lastEventId;
  } else if (initialLookback && initialLookback > 0) {
    const sinceDate = new Date(Date.now() - initialLookback * 60 * 1000);
    query.since = sinceDate.toISOString();
  }

  const events = (await kanbanApiRequest.call(this, 'GET', '/api/sync/events', {}, query)) as IDataObject[];

  if (!Array.isArray(events)) {
    throw new Error('Unexpected response from Kanban sync endpoint. Expected an array of events.');
  }

  if (selectedEventTypes.length === 0) {
    return events;
  }

  const filters = new Set(selectedEventTypes);
  return events.filter((event) => {
    const eventType = `${event.resource}.${event.action}`;
    return filters.has(eventType);
  });
}

export class KanbanApp implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kanban App',
    name: 'kanbanApp',
    icon: 'file:kanbanApp.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with the Kanban task management backend',
    defaults: {
      name: 'Kanban App',
    },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: 'kanbanAppApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        options: [
          {
            name: 'Task',
            value: 'task',
          },
          {
            name: 'Board',
            value: 'board',
          },
          {
            name: 'Synchronization',
            value: 'sync',
          },
        ],
        default: 'task',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['task'],
          },
        },
        options: [
          {
            name: 'Create',
            value: 'create',
            action: 'Create a task',
          },
          {
            name: 'Delete',
            value: 'delete',
            action: 'Delete a task',
          },
          {
            name: 'Get',
            value: 'get',
            action: 'Get a task',
          },
          {
            name: 'Get Many',
            value: 'getAll',
            action: 'Get many tasks',
          },
          {
            name: 'Update',
            value: 'update',
            action: 'Update a task',
          },
        ],
        default: 'create',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['board'],
          },
        },
        options: [
          {
            name: 'Create',
            value: 'create',
            action: 'Create a board',
          },
          {
            name: 'Get',
            value: 'get',
            action: 'Get a board',
          },
          {
            name: 'Get Many',
            value: 'getAll',
            action: 'Get many boards',
          },
          {
            name: 'Update',
            value: 'update',
            action: 'Update a board',
          },
          {
            name: 'Delete',
            value: 'delete',
            action: 'Delete a board',
          },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['sync'],
          },
        },
        options: [
          {
            name: 'Get Updates',
            value: 'getUpdates',
            action: 'Retrieve update events for tasks and boards',
          },
        ],
        default: 'getUpdates',
      },
      {
        displayName: 'Task ID',
        name: 'taskId',
        type: 'number',
        default: 0,
        required: true,
        displayOptions: {
          show: {
            resource: ['task'],
            operation: ['get', 'update', 'delete'],
          },
        },
      },
      {
        displayName: 'Board ID',
        name: 'boardId',
        type: 'number',
        default: 0,
        required: true,
        displayOptions: {
          show: {
            resource: ['board'],
            operation: ['get', 'update', 'delete'],
          },
        },
      },
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['task'],
            operation: ['create'],
          },
        },
      },
      {
        displayName: 'Column ID',
        name: 'columnId',
        type: 'number',
        default: 1,
        required: true,
        displayOptions: {
          show: {
            resource: ['task'],
            operation: ['create'],
          },
        },
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: {
            resource: ['task'],
            operation: ['create', 'update'],
          },
        },
        options: [
          {
            displayName: 'Created By',
            name: 'created_by',
            type: 'number',
            default: 0,
            description: 'User ID that should be recorded as the creator',
          },
          {
            displayName: 'Assigned To',
            name: 'assigned_to',
            type: 'number',
            default: 0,
          },
          {
            displayName: 'Column ID',
            name: 'columnId',
            type: 'number',
            default: 0,
            description: 'Override the column the task should belong to',
          },
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            typeOptions: {
              rows: 4,
            },
            default: '',
          },
          {
            displayName: 'Due Date',
            name: 'due_date',
            type: 'string',
            default: '',
            description: 'ISO 8601 date string',
          },
          {
            displayName: 'Pinned',
            name: 'pinned',
            type: 'boolean',
            default: false,
          },
          {
            displayName: 'Position',
            name: 'position',
            type: 'number',
            default: 0,
          },
          {
            displayName: 'Priority',
            name: 'priority',
            type: 'options',
            options: [
              {
                name: 'Low',
                value: 'low',
              },
              {
                name: 'Medium',
                value: 'medium',
              },
              {
                name: 'High',
                value: 'high',
              },
            ],
            default: 'medium',
          },
          {
            displayName: 'Recurring Rule',
            name: 'recurring_rule',
            type: 'string',
            default: '',
            description: 'iCal formatted recurring rule',
          },
          {
            displayName: 'Swimlane ID',
            name: 'swimlane_id',
            type: 'number',
            default: 0,
          },
          {
            displayName: 'Tags',
            name: 'tags',
            type: 'string',
            default: '',
            description: 'Comma-separated tag IDs',
          },
          {
            displayName: 'Title',
            name: 'title',
            type: 'string',
            default: '',
            displayOptions: {
              show: {
                '/operation': ['update'],
              },
            },
          },
          {
            displayName: 'Updated By',
            name: 'updated_by',
            type: 'number',
            default: 0,
            description: 'User ID that is performing the update',
            displayOptions: {
              show: {
                '/operation': ['update'],
              },
            },
          },
          {
            displayName: 'Deleted By',
            name: 'deleted_by',
            type: 'number',
            default: 0,
            description: 'User ID that should be recorded when deleting the task',
            displayOptions: {
              show: {
                '/operation': ['delete'],
              },
            },
          },
        ],
      },
      {
        displayName: 'Board Name',
        name: 'boardName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['board'],
            operation: ['create'],
          },
        },
      },
      {
        displayName: 'Board Additional Fields',
        name: 'boardAdditionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: {
            resource: ['board'],
            operation: ['create', 'update'],
          },
        },
        options: [
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            typeOptions: {
              rows: 4,
            },
            default: '',
          },
          {
            displayName: 'Template Board',
            name: 'template',
            type: 'boolean',
            default: false,
            description: 'Mark the board as a reusable template',
          },
        ],
      },
      {
        displayName: 'Event Types',
        name: 'eventTypes',
        type: 'multiOptions',
        default: [
          'task.created',
          'task.updated',
          'task.deleted',
          'board.created',
          'board.updated',
          'board.deleted',
        ],
        options: [
          {
            name: 'Task Created',
            value: 'task.created',
          },
          {
            name: 'Task Updated',
            value: 'task.updated',
          },
          {
            name: 'Task Deleted',
            value: 'task.deleted',
          },
          {
            name: 'Board Created',
            value: 'board.created',
          },
          {
            name: 'Board Updated',
            value: 'board.updated',
          },
          {
            name: 'Board Deleted',
            value: 'board.deleted',
          },
        ],
        displayOptions: {
          show: {
            resource: ['sync'],
            operation: ['getUpdates'],
          },
        },
        description: 'Filter events by type. Leave empty to include all events.',
      },
      {
        displayName: 'Initial Lookback (minutes)',
        name: 'initialLookback',
        type: 'number',
        default: 5,
        typeOptions: {
          minValue: 0,
          maxValue: 1440,
        },
        displayOptions: {
          show: {
            resource: ['sync'],
            operation: ['getUpdates'],
          },
        },
        description: 'How far back to look for events when no last event ID is provided',
      },
      {
        displayName: 'Last Event ID',
        name: 'lastEventId',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['sync'],
            operation: ['getUpdates'],
          },
        },
        description: 'Resume from a specific event identifier',
      },
      {
        displayName: 'Maximum Events',
        name: 'syncLimit',
        type: 'number',
        default: 100,
        typeOptions: {
          minValue: 1,
          maxValue: 500,
        },
        displayOptions: {
          show: {
            resource: ['sync'],
            operation: ['getUpdates'],
          },
        },
        description: 'Maximum number of events to fetch per request',
      },
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        displayOptions: {
          show: {
            operation: ['getAll'],
          },
        },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 50,
        typeOptions: {
          minValue: 1,
          maxValue: 500,
        },
        displayOptions: {
          show: {
            operation: ['getAll'],
            returnAll: [false],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const length = items.length;

    for (let itemIndex = 0; itemIndex < length; itemIndex += 1) {
      try {
        const resource = this.getNodeParameter('resource', itemIndex) as string;
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        let responseData: IDataObject | IDataObject[] = {};

        if (resource === 'task') {
          responseData = await handleTaskOperation.call(this, itemIndex, operation);
        } else if (resource === 'board') {
          responseData = await handleBoardOperation.call(this, itemIndex, operation);
        } else if (resource === 'sync') {
          responseData = await handleSyncOperation.call(this, itemIndex, operation);
        } else {
          throw new Error(`Unsupported resource: ${resource}`);
        }

        const executionData = this.helpers.returnJsonArray(Array.isArray(responseData) ? responseData : [responseData]);
        returnData.push(...executionData);
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message } });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
