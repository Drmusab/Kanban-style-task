import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	IHttpRequestOptions,
	NodeApiError,
} from 'n8n-workflow';

export async function kanbanApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions | IWebhookFunctions,
	method: string,
	resource: string,
	body: any = {},
	qs: any = {},
	uri?: string,
	headers: any = {},
): Promise<any> {
	const credentials = await this.getCredentials('kanbanAppApi');

	const options: IHttpRequestOptions = {
		method,
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
		},
		body,
		qs,
		url: uri || `${credentials.baseUrl}/api${resource}`,
		json: true,
	};

	// Add API key authentication if provided
	if (credentials.apiKey) {
		options.headers!['x-api-key'] = credentials.apiKey;
	}

	// Add authorization header if JWT token is provided
	if (credentials.accessToken) {
		options.headers!['Authorization'] = `Bearer ${credentials.accessToken}`;
	}

	try {
		if (Object.keys(headers).length !== 0) {
			options.headers = Object.assign({}, options.headers, headers);
		}
		if (Object.keys(body).length === 0) {
			delete options.body;
		}

		const response = await this.helpers.httpRequest!(options);
		return response;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error);
	}
}

export async function kanbanApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	endpoint: string,
	body: any = {},
	query: any = {},
): Promise<any> {
	const returnData: any[] = [];

	let responseData;
	query.limit = 100;
	query.offset = 0;

	do {
		responseData = await kanbanApiRequest.call(this, method, endpoint, body, query);
		
		if (Array.isArray(responseData)) {
			returnData.push.apply(returnData, responseData);
			query.offset += query.limit;
		} else if (responseData.data && Array.isArray(responseData.data)) {
			returnData.push.apply(returnData, responseData.data);
			query.offset += query.limit;
		} else {
			return responseData;
		}
	} while (responseData.length !== 0 && responseData.length === query.limit);

	return returnData;
}
