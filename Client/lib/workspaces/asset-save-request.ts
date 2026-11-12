import type { FocalPoint, LoginImageAsset } from '../models/index.ts';

/** The body of an asset save. Every field is sent: the save replaces the stored asset. */
export interface AssetSaveRequest {
	/** Display name of the asset. */
	name: string;
	/** Alternative text, or `null` to clear it. */
	altText: string | null;
	/** Greeting shown with a background; always `null` for a logo. */
	greetingText: string | null;
	/** Logo paired with a background; always `null` for a logo. */
	logoAssetId: string | null;
	/** Normalised crop focal point of a background; always `null` for a logo. */
	focalPoint: FocalPoint | null;
	/** Zoom factor of a background; always `null` for a logo. */
	zoom: number | null;
}

/** The parts of an asset draft that a save sends. */
export type AssetSaveDraft = Pick<
	LoginImageAsset,
	'name' | 'kind' | 'altText' | 'greetingText' | 'logoAssetId' | 'focalPoint' | 'zoom'
>;

/**
 * Builds the save request for an asset draft. Background-only fields are nulled for
 * logo assets, matching what the server would force them to anyway.
 *
 * @param draft - The asset draft being saved.
 * @returns The request body; missing optional fields become `null`.
 */
export function toAssetSaveRequest(draft: AssetSaveDraft): AssetSaveRequest {
	const base = { name: draft.name, altText: draft.altText ?? null };
	switch (draft.kind) {
		case 'background':
			return {
				...base,
				greetingText: draft.greetingText ?? null,
				logoAssetId: draft.logoAssetId ?? null,
				focalPoint: draft.focalPoint ?? null,
				zoom: draft.zoom ?? null
			};
		case 'logo':
			return { ...base, greetingText: null, logoAssetId: null, focalPoint: null, zoom: null };
	}
}
