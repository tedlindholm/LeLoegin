import type { UmbConditionConfigBase } from '@umbraco-cms/backoffice/extension-api';

declare global {
	interface UmbFallbackUserPermissionConditionConfig extends UmbConditionConfigBase<'Umb.Condition.UserPermission.Fallback'> {
		allOf?: Array<string>;
		oneOf?: Array<string>;
	}

	interface UmbExtensionConditionConfigMap {
		UmbFallbackUserPermissionConditionConfig: UmbFallbackUserPermissionConditionConfig;
	}
}

export {};
