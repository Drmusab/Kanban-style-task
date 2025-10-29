import type { IDataObject, IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-core';
import type { OptionsWithUri } from 'request';

interface KanbanCredentials {
  baseUrl: string;
  apiKey?: string;
}

export async function kanbanApiRequest(
  this: IExecuteFunctions | ILoadOptionsFunctions,
  method: string,
  endpoint: string,
  body: IDataObject = {},
  qs: IDataObject = {},
): Promise<any> {
  const credentials = (await this.getCredentials('kanbanAppApi')) as KanbanCredentials;

  if (!credentials?.baseUrl) {
    throw new Error('Kanban App base URL is missing from the credentials.');
  }

  const options: OptionsWithUri = {
    method,
    uri: `${credentials.baseUrl.replace(/\/$/, '')}${endpoint}`,
    json: true,
    qs,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (Object.keys(body).length > 0) {
    options.body = body;
  }

  if (credentials.apiKey) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${credentials.apiKey}`,
      'X-API-Key': credentials.apiKey,
    };
  }

  try {
    return await this.helpers.request(options);
  } catch (error: any) {
    if (error?.response?.body?.message) {
      throw new Error(`Kanban App error response [${error.response.statusCode}]: ${error.response.body.message}`);
    }

    throw error;
  }
}

export async function kanbanApiRequestAllItems(
  this: IExecuteFunctions,
  method: string,
  endpoint: string,
  body: IDataObject = {},
  qs: IDataObject = {},
): Promise<IDataObject[]> {
  const returnData: IDataObject[] = [];
  let responseData;
  let page = 0;

  do {
    const requestQuery = {
      ...qs,
      offset: page * 50,
      limit: 50,
    };

    responseData = await kanbanApiRequest.call(this, method, endpoint, body, requestQuery);

    if (Array.isArray(responseData)) {
      returnData.push(...responseData);
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      returnData.push(...responseData.data);
    } else {
      returnData.push(responseData as IDataObject);
    }

    page += 1;
  } while (Array.isArray(responseData) && responseData.length === 50);

  return returnData;
}
