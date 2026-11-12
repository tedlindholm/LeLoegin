import { UmbModalToken } from '@umbraco-cms/backoffice/modal';

/** The kind of asset the create modal can start an upload for. */
export type CreateAssetKind = 'background' | 'logo';

/** The create-asset modal takes no data. */
export type CreateAssetModalData = Record<string, never>;

/** The create-asset modal's result: the kind of asset the user chose. */
export type CreateAssetModalValue = { kind: CreateAssetKind };

/** Token for the dialog that asks whether to upload a background or a logo. */
export const CREATE_ASSET_MODAL_TOKEN = new UmbModalToken<
	CreateAssetModalData,
	CreateAssetModalValue
>('LeLøgin.Modal.CreateAsset', { modal: { type: 'dialog' } });
