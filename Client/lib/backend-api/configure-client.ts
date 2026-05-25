import { UMB_AUTH_CONTEXT } from '@umbraco-cms/backoffice/auth';
import type { UmbElement } from '@umbraco-cms/backoffice/element-api';
import { client } from '../api/index.js';

/**
 * Configures the generated Le Løgin API client with the current Umbraco auth context.
 */
export async function configureLeLøginScreenClient(host: UmbElement) {
	const authContext = await host.getContext(UMB_AUTH_CONTEXT, { preventTimeout: true });

	if (!authContext) {
		throw new Error(
			'Le Løgin requires UMB_AUTH_CONTEXT to configure the generated API client.'
		);
	}

	authContext.configureClient(client);
}
