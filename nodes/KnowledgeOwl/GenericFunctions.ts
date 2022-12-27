import { IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions } from 'n8n-core';

import {
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodePropertyOptions,
} from 'n8n-workflow';


/**
 * Make an API request to KnowledgeOwl
 *
 */
export async function knowledgeOwlApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: object,
	query?: IDataObject,
	uri?: string | undefined,
): Promise<any> {
	const options: IHttpRequestOptions = {
		headers: {},
		method,
		body: { data: body },
		qs: query,
		url: uri || `https://app.knowledgeowl.com/api/head${endpoint}`,
		json: true,
	};
	return await this.helpers.requestWithAuthentication.call(this, 'knowledgeOwlBasicAuthApi', options);
}



export async function getKnowledgeBases(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	console.log("in get kbs");
	const endpoint = '/project.json';
	const responseData = await knowledgeOwlApiRequest.call(this, 'GET', endpoint, {});
	const returnData: INodePropertyOptions[] = [];

	for (const knowledgeBaseData of responseData.data) {
		console.log(knowledgeBaseData);
		returnData.push({
			name: knowledgeBaseData.name,
			value: knowledgeBaseData.id,
		});
	}

	returnData.sort((a, b) => {
		if (a.name < b.name) {
			return -1;
		}
		if (a.name > b.name) {
			return 1;
		}
		return 0;
	});
	console.log(returnData);

	return returnData;
}



