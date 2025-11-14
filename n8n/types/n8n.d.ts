declare module 'n8n-workflow' {
  export type IDataObject = Record<string, any>;

  export interface INodeExecutionData {
    json: IDataObject;
    binary?: IDataObject;
  }

  export interface INodeTypeDescription {
    [key: string]: any;
  }

  export interface INodeType {
    description: INodeTypeDescription;
    execute?(this: import('n8n-core').IExecuteFunctions): Promise<INodeExecutionData[][]>;
    trigger?(this: import('n8n-core').ITriggerFunctions): Promise<INodeTypeTriggerResponse>;
  }

  export interface INodeProperties {
    [key: string]: any;
  }

  export interface INodeTypeTriggerResponse {
    closeFunction: () => Promise<void> | void;
  }

  export interface ICredentialType {
    name: string;
    displayName: string;
    properties: INodeProperties[];
    documentationUrl?: string;
  }

  export enum NodeConnectionType {
    Main = 'main'
  }
}

declare module 'n8n-core' {
  import type { IDataObject, INodeExecutionData } from 'n8n-workflow';

  export interface Helpers {
    request(options: any): Promise<any>;
    returnJsonArray(data: IDataObject[]): INodeExecutionData[];
  }

  export interface IExecuteFunctions {
    getInputData(): INodeExecutionData[];
    getNodeParameter(name: string, itemIndex: number, defaultValue?: any): any;
    getCredentials(name: string): Promise<any>;
    continueOnFail(): boolean;
    helpers: Helpers;
  }

  export interface ILoadOptionsFunctions {
    getCredentials(name: string): Promise<any>;
    helpers: Helpers;
  }

  export interface ITriggerFunctions {
    emit(items: INodeExecutionData[][]): void;
    getNodeParameter(name: string, itemIndex: number, defaultValue?: any): any;
    getCredentials(name: string): Promise<any>;
    helpers: Helpers;
  }
}
