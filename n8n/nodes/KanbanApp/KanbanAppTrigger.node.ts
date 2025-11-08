import type { ITriggerFunctions } from 'n8n-core';
import type {
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  INodeTypeTriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import { kanbanApiRequest } from './GenericFunctions';

export class KanbanAppTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kanban App Trigger',
    name: 'kanbanAppTrigger',
    icon: 'file:kanbanApp.svg',
    group: ['trigger'],
    version: 1,
    description: 'Subscribe to Kanban board and task updates in near real-time',
    defaults: {
      name: 'Kanban App Trigger',
    },
    inputs: [],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: 'kanbanAppApi',
        required: true,
      },
    ],
    properties: [
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
        description: 'Events that should trigger the workflow',
      },
      {
        displayName: 'Polling Interval',
        name: 'pollInterval',
        type: 'number',
        default: 15,
        typeOptions: {
          minValue: 5,
          maxValue: 3600,
        },
        description: 'How often to poll the backend for new events (in seconds)',
      },
      {
        displayName: 'Initial Lookback (minutes)',
        name: 'initialLookback',
        type: 'number',
        default: 10,
        typeOptions: {
          minValue: 0,
          maxValue: 1440,
        },
        description: 'Look back this many minutes on the initial poll when no state is stored',
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
        description: 'Maximum number of events to request per poll',
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<INodeTypeTriggerResponse> {
    const eventTypes = (this.getNodeParameter('eventTypes', 0, []) as string[]) || [];
    const pollInterval = this.getNodeParameter('pollInterval', 0, 15) as number;
    const initialLookback = this.getNodeParameter('initialLookback', 0, 10) as number;
    const syncLimit = this.getNodeParameter('syncLimit', 0, 100) as number;

    let lastEventId: string | undefined;
    let active = true;
    let polling = false;

    const pollForEvents = async () => {
      if (!active || polling) {
        return;
      }

      polling = true;

      try {
        const query: IDataObject = {
          limit: syncLimit,
        };

        if (lastEventId) {
          query.lastEventId = lastEventId;
        } else if (initialLookback > 0) {
          const sinceDate = new Date(Date.now() - initialLookback * 60 * 1000);
          query.since = sinceDate.toISOString();
        }

        const events = (await kanbanApiRequest.call(this, 'GET', '/api/sync/events', {}, query)) as IDataObject[];

        if (Array.isArray(events) && events.length > 0) {
          const filters = eventTypes.length > 0 ? new Set(eventTypes) : undefined;
          const filtered = filters
            ? events.filter((event) => filters.has(`${event.resource}.${event.action}`))
            : events;

          if (filtered.length > 0) {
            const executionItems: INodeExecutionData[] = filtered.map((event) => ({
              json: event,
            }));

            this.emit([executionItems]);
          }

          lastEventId = events[events.length - 1].id as string;
        }
      } catch (error) {
        console.error('KanbanAppTrigger polling error', error);
      } finally {
        polling = false;
      }
    };

    const intervalHandle = setInterval(() => {
      void pollForEvents();
    }, pollInterval * 1000);

    await pollForEvents();

    return {
      closeFunction: async () => {
        active = false;
        clearInterval(intervalHandle);
      },
    };
  }
}
