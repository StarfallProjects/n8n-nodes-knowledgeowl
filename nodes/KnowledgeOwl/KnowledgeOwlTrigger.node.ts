import {
	IHookFunctions,
	IWebhookFunctions,
} from 'n8n-core';

import {
	IDataObject,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	NodeOperationError,
} from 'n8n-workflow';

import { getKnowledgeBases, knowledgeOwlApiRequest } from './GenericFunctions';

export class KnowledgeOwlTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'KnowledgeOwl Trigger',
		name: 'knowledgeOwlTrigger',
		icon: 'file:knowledgeowl.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Start a workflow in response to a KnowledgeOwl webhook.',
		defaults: {
			name: 'KnowledgeOwl Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'knowledgeOwlBasicAuthApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			// TODO: change to resource locator
			{
				displayName: 'Knowledge Base Name or ID',
				name: 'knowledgeBaseId',
				type: 'options',
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getKnowledgeBases',
				},
				options: [],
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: [],
				options: [
					{
						name: 'Article Published',
						value: 'article.publish',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getKnowledgeBases(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const knowledgeBases = await getKnowledgeBases.call(this);
				knowledgeBases.unshift({
					name: '',
					value: '',
				});
				return knowledgeBases;
			},
		},
	};

	// @ts-ignore (because of request)
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {

				const webhookData = this.getWorkflowStaticData('node');
				const endpoint = `/webhook/${webhookData.webhookId}.json`;

				if(webhookData.webhookId === undefined) {
					return false;
				}

				try {
					await knowledgeOwlApiRequest.call(this, 'GET', endpoint, {});
				}
				catch(err) {
					if (err.response.status === 404) {
						delete webhookData.webhookId;
						return false;
					}
					throw err;
				}

				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				if (webhookUrl.includes('//localhost')) {
					throw new NodeOperationError(
						this.getNode(),
						'The Webhook can not work on "localhost". Please, either setup n8n on a custom domain or start with "--tunnel"!',
					);
				}
				const endpoint = `/webhook.json`;
				const events = this.getNodeParameter('events');
				const knowledgeBaseId = this.getNodeParameter('knowledgeBaseId');
				const body = {
					event: events,
					endpoint: webhookUrl,
					status: 'active',
					project_ids: [`${knowledgeBaseId}`]
				};
				let responseData;
				try {
					responseData = await knowledgeOwlApiRequest.call(this, 'POST', endpoint, body);
				}
				catch(err) {
					throw err;
				}
				if (responseData.data.id === undefined) {
					// Required data is missing so was not successful
					return false;
				}

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = responseData.data.id as string;

				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');

				if (webhookData.webhookId !== undefined) {
					const endpoint = `/webhook/${webhookData.webhookId}.json`;

					try {
						await knowledgeOwlApiRequest.call(this, 'DELETE', endpoint, {});
					} catch (err) {
						if(err.response.status !== 404) {
							return false;
						}
					}
					// Remove from the static workflow data so that it is clear
					// that no webhooks are registred anymore
					delete webhookData.webhookId;
				}

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		console.log(JSON.stringify(bodyData, null, 2));
		if (bodyData.type === "ping") {
			console.log("in body data ping");
			const res = this.getResponseObject();
			res.status(200).end();
			return {
				noWebhookResponse: true,
			}
		}
		const returnData: IDataObject[] = [];

		returnData.push({
			body: bodyData,
		});

		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
