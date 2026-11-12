import { UmbEntityCreateOptionActionBase } from '@umbraco-cms/backoffice/entity-create-option-action';
import {
	LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE
} from '../types.js';

const WORKSPACE_BASE = '/umbraco/section/settings/workspace';

/** Create option on the background group that opens the background upload workspace. */
export class LeLøginScreenAssetBackgroundCreateOptionAction extends UmbEntityCreateOptionActionBase {
	/**
	 * @returns The Settings workspace URL for a new background upload.
	 */
	override async getHref() {
		return `${WORKSPACE_BASE}/${LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE}/edit/null`;
	}
}

/** Create option on the logo group that opens the logo upload workspace. */
export class LeLøginScreenAssetLogoCreateOptionAction extends UmbEntityCreateOptionActionBase {
	/**
	 * @returns The Settings workspace URL for a new logo upload.
	 */
	override async getHref() {
		return `${WORKSPACE_BASE}/${LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE}/edit/null`;
	}
}
