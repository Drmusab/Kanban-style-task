import type { IExecuteFunctions, ILoadOptionsFunctions, ITriggerFunctions } from 'n8n-core';
import type { IDataObject } from 'n8n-workflow';
export declare function kanbanApiRequest(this: IExecuteFunctions | ILoadOptionsFunctions | ITriggerFunctions, method: string, endpoint: string, body?: IDataObject, qs?: IDataObject): Promise<any>;
export declare function kanbanApiRequestAllItems(this: IExecuteFunctions, method: string, endpoint: string, body?: IDataObject, qs?: IDataObject): Promise<IDataObject[]>;
//# sourceMappingURL=GenericFunctions.d.ts.map