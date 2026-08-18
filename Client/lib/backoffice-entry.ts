import type { UmbEntryPointOnInit } from '@umbraco-cms/backoffice/extension-api';
import { configureLeLøginScreenClient } from './backend-api/configure-client.js';
import { manifests as localisationManifests } from './assets/lang/manifests.ts';
import { manifests as userPermissionManifests } from './user-permissions/manifests.ts';
import { manifests as sectionManifests } from './section/manifests.ts';
import { manifests as dashboardManifests } from './dashboard/manifests.ts';
import { manifests as workspaceManifests } from './workspaces/manifests.ts';
import { manifests as treeManifests } from './tree/manifests.ts';
import { manifests as rulesManifests } from './rules/manifests.ts';

const manifests: Array<UmbExtensionManifest> = [
	...localisationManifests,
	...userPermissionManifests,
	...sectionManifests,
	...dashboardManifests,
	...workspaceManifests,
	...treeManifests,
	...rulesManifests
];

const isDebugLoggingEnabled = import.meta.env.DEV || import.meta.env.VITE_LELOGIN_DEBUG === 'true';

const logDebug = (...parts: Array<unknown>) => {
	if (isDebugLoggingEnabled) {
		console.log(...parts);
	}
};

/**
 * The authenticated backoffice entry, loaded by the package manifest's backofficeEntryPoint.
 * Kept separate from the login entry so neither page downloads the other's code.
 */
export const onInit: UmbEntryPointOnInit = (host, extensionRegistry) => {
	logDebug('Le Løgin: onInit', manifests);

	void configureLeLøginScreenClient(host)
		.then(() => {
			logDebug('Le Løgin: API client configured with Umbraco auth');
			extensionRegistry.registerMany(manifests);
		})
		.catch((error) => {
			console.error('Le Løgin: failed to configure API client', error);
		});
};
