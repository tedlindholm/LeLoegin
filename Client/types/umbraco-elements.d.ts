import type { ManifestBase } from '@umbraco-cms/backoffice/extension-api';

declare global {
	interface UmbExtensionManifest extends ManifestBase {
		[key: string]: any;
	}
}
