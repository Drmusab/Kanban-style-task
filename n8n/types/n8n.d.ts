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
  }

  export interface INodeProperties {
    [key: string]: any;
  }

  export interface INodeTypeTriggerResponse {
    closeFunction: () => Promise<void> | void;
  }

  export enum NodeConnectionType {
    Main = 'main'
  }
}

declare module 'n8n-core' {
  import type { IDataObject, INodeExecutionData } from 'n8n-workflow';

  export interface Helpers {
    request(options: any): Promise<any>;
  }

  export interface IExecuteFunctions {
    getInputData(): INodeExecutionData[];
    getNodeParameter(name: string, itemIndex: number, defaultValue?: any): any;
    getCredentials(name: string): Promise<any>;
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
