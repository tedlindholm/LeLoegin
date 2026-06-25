import { UmbModalToken } from '@umbraco-cms/backoffice/modal';
import type { LoginImageAsset } from '../models/index.js';

export type LogoPickerModalData = {
	logoAssets: Array<LoginImageAsset>;
	selectedLogoAssetId: string;
};

export type LogoPickerModalValue = {
	logoAssetId: string;
};

export const LOGO_PICKER_MODAL_TOKEN = new UmbModalToken<LogoPickerModalData, LogoPickerModalValue>(
	'LeLøgin.Modal.LogoPicker',
	{ modal: { type: 'dialog' } }
);
