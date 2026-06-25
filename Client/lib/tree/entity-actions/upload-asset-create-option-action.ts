import { UmbEntityCreateOptionActionBase } from '@umbraco-cms/backoffice/entity-create-option-action';
import {
	LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE
} from '../types.js';

const WORKSPACE_BASE = '/umbraco/section/settings/workspace';

export class LeLøginScreenAssetBackgroundCreateOptionAction extends UmbEntityCreateOptionActionBase {
	override async getHref() {
		return `${WORKSPACE_BASE}/${LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE}/edit/null`;
	}
}

export class LeLøginScreenAssetLogoCreateOptionAction extends UmbEntityCreateOptionActionBase {
	override async getHref() {
		return `${WORKSPACE_BASE}/${LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE}/edit/null`;
	}
}
