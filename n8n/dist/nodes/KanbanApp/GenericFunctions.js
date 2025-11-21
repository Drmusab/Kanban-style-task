"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kanbanApiRequest = kanbanApiRequest;
exports.kanbanApiRequestAllItems = kanbanApiRequestAllItems;
async function kanbanApiRequest(method, endpoint, body = {}, qs = {}) {
    var _a, _b;
    const credentials = (await this.getCredentials('kanbanAppApi'));
    if (!(credentials === null || credentials === void 0 ? void 0 : credentials.baseUrl)) {
        throw new Error('Kanban App base URL is missing from the credentials.');
    }
    const options = {
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
    }
    catch (error) {
        if ((_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.body) === null || _b === void 0 ? void 0 : _b.message) {
            throw new Error(`Kanban App error response [${error.response.statusCode}]: ${error.response.body.message}`);
        }
        throw error;
    }
}
async function kanbanApiRequestAllItems(method, endpoint, body = {}, qs = {}) {
    const returnData = [];
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
        }
        else if ((responseData === null || responseData === void 0 ? void 0 : responseData.data) && Array.isArray(responseData.data)) {
            returnData.push(...responseData.data);
        }
        else {
            returnData.push(responseData);
        }
        page += 1;
    } while (Array.isArray(responseData) && responseData.length === 50);
    return returnData;
}
//# sourceMappingURL=GenericFunctions.js.map