import { UmbModalToken } from '@umbraco-cms/backoffice/modal';
import type { LoginImageAsset } from '../models/index.js';

/** What the logo picker modal is opened with. */
export type LogoPickerModalData = {
	/** The logo assets to choose from. */
	logoAssets: Array<LoginImageAsset>;
	/** Id of the logo currently chosen, preselected in the picker. */
	selectedLogoAssetId: string;
};

/** The logo picker modal's result. */
export type LogoPickerModalValue = {
	/** Id of the logo the user picked. */
	logoAssetId: string;
};

/** Token for the dialog that picks the logo shown with a background asset. */
export const LOGO_PICKER_MODAL_TOKEN = new UmbModalToken<LogoPickerModalData, LogoPickerModalValue>(
	'LeLøgin.Modal.LogoPicker',
	{ modal: { type: 'dialog' } }
);
