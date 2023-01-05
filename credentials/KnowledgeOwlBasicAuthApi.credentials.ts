import {
	ICredentialType,
	INodeProperties,
	IAuthenticateGeneric,
	ICredentialTestRequest,
} from 'n8n-workflow';

export class KnowledgeOwlBasicAuthApi implements ICredentialType {
	name = 'knowledgeOwlBasicAuthApi';
	displayName = 'KnowledgeOwl Basic Auth API';
	// Uses the link to this tutorial as an example
	// Replace with your own docs links when building your own nodes
	documentationUrl = 'https://github.com/StarfallProjects/n8n-nodes-knowledgeowl';
	properties: INodeProperties[] = [
		{
			displayName: 'KnowledgeOwl uses basic auth, but with some quirks: the username is your API key. The password can be any value.',
			name: 'notice',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'User (API Key)',
			name: 'user',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: 'x',
		}
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.user}}',
				password: '={{$credentials.password}}',
			},
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://app.knowledgeowl.com/api/head',
			url: '/webhook.json',
		},
	};
}
