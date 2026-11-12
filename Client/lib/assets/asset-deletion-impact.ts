import type { LoginRule } from '../models/index.js';

/** What deleting an image does to the rules that show it. Names are in the order given. */
export interface AssetDeletionImpact {
	/** Enabled rules whose only image this is; the server disables them. */
	disabledRules: Array<string>;
	/** Every other rule that shows the image; it simply loses the image. */
	reducedRules: Array<string>;
}

/**
 * Predicts the server's rule clean-up for an asset delete, so the confirmation can name the rules
 * before anything changes. Mirrors `AssetController.Delete`: ids compare case-insensitively.
 */
export const assetDeletionImpact = (
	rules: ReadonlyArray<Pick<LoginRule, 'name' | 'enabled' | 'assetIds'>>,
	assetId: string
): AssetDeletionImpact => {
	const target = assetId.toLowerCase();
	const impact: AssetDeletionImpact = { disabledRules: [], reducedRules: [] };

	for (const rule of rules) {
		const remaining = rule.assetIds.filter((id) => id.toLowerCase() !== target);
		if (remaining.length === rule.assetIds.length) continue;

		if (rule.enabled && remaining.length === 0) impact.disabledRules.push(rule.name);
		else impact.reducedRules.push(rule.name);
	}

	return impact;
};
