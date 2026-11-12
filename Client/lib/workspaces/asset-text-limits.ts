/** Display name limit, matching `AssetUpdateRequest` and `UploadAssetRequest`. */
export const ASSET_NAME_MAX_LENGTH = 200;

/** Alternative text limit, matching `AssetUpdateRequest`. */
export const ASSET_ALT_TEXT_MAX_LENGTH = 500;

/** Greeting text limit, matching `AssetUpdateRequest`. */
export const ASSET_GREETING_MAX_LENGTH = 500;

/** Which asset text exceeded its API limit. */
export type AssetTextLimitField = 'name' | 'altText' | 'greetingText';

/** A text value the API will reject, and the localisation term that explains the limit. */
export interface AssetTextLimitViolation {
	/** The field that is too long. Name is reported before alternative text, then greeting text. */
	field: AssetTextLimitField;
	/** The maximum length the API accepts for `field`. */
	maximum: number;
	/** Localisation key for the message, with `%0%` replaced by `maximum`. */
	term:
		| 'loginScreen_assetNameTooLong'
		| 'loginScreen_altTextTooLong'
		| 'loginScreen_greetingTextTooLong';
}

/**
 * Finds the first asset text the API rejects for length. Counts UTF-16 code units, as
 * `MaxLength` does, and treats a missing greeting or alternative text as empty.
 *
 * @param value - The name, alternative text and greeting about to be saved.
 * @returns The first limit that fails, or `undefined` when every text is within its limit.
 */
export function assetTextLimitViolation(value: {
	name: string;
	altText?: string | null;
	greetingText?: string | null;
}): AssetTextLimitViolation | undefined {
	if (value.name.length > ASSET_NAME_MAX_LENGTH) {
		return {
			field: 'name',
			maximum: ASSET_NAME_MAX_LENGTH,
			term: 'loginScreen_assetNameTooLong'
		};
	}

	if ((value.altText ?? '').length > ASSET_ALT_TEXT_MAX_LENGTH) {
		return {
			field: 'altText',
			maximum: ASSET_ALT_TEXT_MAX_LENGTH,
			term: 'loginScreen_altTextTooLong'
		};
	}

	if ((value.greetingText ?? '').length > ASSET_GREETING_MAX_LENGTH) {
		return {
			field: 'greetingText',
			maximum: ASSET_GREETING_MAX_LENGTH,
			term: 'loginScreen_greetingTextTooLong'
		};
	}

	return undefined;
}
