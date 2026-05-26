import { UmbModalToken } from '@umbraco-cms/backoffice/modal';

export type CreateAssetKind = 'background' | 'logo';

export type CreateAssetModalData = Record<string, never>;

export type CreateAssetModalValue = { kind: CreateAssetKind };

export const CREATE_ASSET_MODAL_TOKEN = new UmbModalToken<CreateAssetModalData, CreateAssetModalValue>(
	'LeLøgin.Modal.CreateAsset',
	{ modal: { type: 'dialog' } },
);
