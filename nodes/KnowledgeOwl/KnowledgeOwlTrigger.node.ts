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
			{
				displayName: 'Knowledge Base Name or ID',
				name: 'knowledgeBaseId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getKnowledgeBases',
				},
				options: [],
				default: '',
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
						value: 'articlePublished',
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
				const credentials = await this.getCredentials('knowledgeOwlApi');

				// Check all the webhooks which exist already if it is identical to the
				// one that is supposed to get created.
				const endpoint = `/webhooks.json`;

				const responseData = await knowledgeOwlApiRequest.call(this, 'GET', endpoint, {});

				const idModel = this.getNodeParameter('id') as string;
				const webhookUrl = this.getNodeWebhookUrl('default');

				for (const webhook of responseData) {
					if (webhook.idModel === idModel && webhook.callbackURL === webhookUrl) {
						// Set webhook-id to be sure that it can be deleted
						const webhookData = this.getWorkflowStaticData('node');
						webhookData.webhookId = webhook.id as string;
						return true;
					}
				}

				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const endpoint = `/webhook.json`;
				const events = this.getNodeParameter('events');
				const body = {
					event: events,
					endpoint: webhookUrl,
					status: 'active',
				};

				const responseData = await knowledgeOwlApiRequest.call(this, 'POST', endpoint, body);

				if (responseData.id === undefined) {
					// Required data is missing so was not successful
					return false;
				}

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = responseData.id as string;

				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');

				if (webhookData.webhookId !== undefined) {
					const credentials = await this.getCredentials('knowledgeOwlApi');

					const endpoint = `/webhook/${webhookData.webhookId}.json`;

					const body = {};

					try {
						await knowledgeOwlApiRequest.call(this, 'DELETE', endpoint, body);
					} catch (error) {
						return false;
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
		const headerData = this.getHeaderData() as IDataObject;
		const req = this.getRequestObject();

		const webhookData = this.getWorkflowStaticData('node');

		if (headerData['x-hook-secret'] !== undefined) {
			// Is a create webhook confirmation request
			webhookData.hookSecret = headerData['x-hook-secret'];

			const res = this.getResponseObject();
			res.set('X-Hook-Secret', webhookData.hookSecret as string);
			res.status(200).end();

			return {
				noWebhookResponse: true,
			};
		}

		// Is regular webhook call
		// Check if it contains any events
		if (
			bodyData.events === undefined ||
			!Array.isArray(bodyData.events) ||
			bodyData.events.length === 0
		) {
			// Does not contain any event data so nothing to process so no reason to
			// start the workflow
			return {};
		}


		return {
			workflowData: [this.helpers.returnJsonArray(req.body.events)],
		};
	}
}

