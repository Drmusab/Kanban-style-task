import { KanbanApp } from './KanbanApp.node';
import { KanbanAppTrigger } from './KanbanAppTrigger.node';
import { KanbanAppApi } from '../../credentials/KanbanAppApi.credentials';

module.exports = {
	nodes: [KanbanApp, KanbanAppTrigger],
	credentials: [KanbanAppApi],
};
