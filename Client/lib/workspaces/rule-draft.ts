import type { LoginRule } from '../models/index.js';
import { createEmptyRuleConditionGroup } from '../rules/rule-condition.js';
import type {
	ConditionMetadata,
	LoginRuleConditionGroup,
	LoginRuleConditionValue
} from '../rules/rule-condition.js';

/** A rule being edited. `id` is missing until a new rule is first saved. */
export interface LoginRuleDraft {
	/** Rule id; missing until a new rule is first saved. */
	id?: string;
	/** Display name of the rule. */
	name: string;
	/** Evaluation order; lower numbers are tried first. */
	priority: number;
	/** Whether the rule takes part in runtime resolution. */
	enabled: boolean;
	/** Images the rule can show; more than one means a random pick. */
	assetIds: string[];
	/** The conditions a request must meet for the rule to match. */
	condition: LoginRuleConditionGroup;
}

/** The reasons a rule draft cannot be saved. */
export type RuleDraftValidationState = 'nameRequired' | 'assetRequired' | 'conditionValueRequired';

/** Localisation key of the message shown for each validation problem. */
export const RULE_DRAFT_VALIDATION_TERMS: Record<RuleDraftValidationState, string> = {
	nameRequired: 'loginScreen_validationRuleName',
	assetRequired: 'loginScreen_validationRuleAsset',
	conditionValueRequired: 'loginScreen_validationConditionValue'
};

const isBlankValue = (value: LoginRuleConditionValue) =>
	typeof value === 'string' ? value.trim().length === 0 : Number.isNaN(value);

/**
 * Finds the first problem that stops the draft being saved: a blank name, no images, or a
 * condition with a missing or blank value.
 *
 * @param draft - The rule draft to check.
 * @returns The first problem, or `undefined` when the draft can be saved.
 */
export function validateRuleDraft(draft: LoginRuleDraft): RuleDraftValidationState | undefined {
	if (draft.name.trim().length === 0) return 'nameRequired';
	if (draft.assetIds.length === 0) return 'assetRequired';
	const hasMissingValue = draft.condition.conditions.some(
		(condition) => condition.values.length === 0 || condition.values.some(isBlankValue)
	);
	return hasMissingValue ? 'conditionValueRequired' : undefined;
}

/**
 * Creates the draft for a new rule: enabled, priority 100, no images and a default condition.
 *
 * @param metadata - Condition metadata used to seed the condition, or `null` when not yet loaded,
 * which gives an empty `all` group.
 * @returns A new draft with no id.
 */
export function createEmptyRuleDraft(metadata: ConditionMetadata | null): LoginRuleDraft {
	return {
		name: '',
		priority: 100,
		enabled: true,
		assetIds: [],
		condition:
			metadata !== null
				? createEmptyRuleConditionGroup(metadata)
				: { operator: 'all', conditions: [] }
	};
}

const cloneCondition = (condition: LoginRuleConditionGroup): LoginRuleConditionGroup => ({
	operator: condition.operator,
	conditions: condition.conditions.map((c) => ({ ...c, values: [...c.values] }))
});

/**
 * Deep-copies a draft, including its image list and condition values, so edits to the copy do
 * not reach the original.
 *
 * @param draft - The draft to copy.
 * @returns An independent copy.
 */
export function cloneRuleDraft(draft: LoginRuleDraft): LoginRuleDraft {
	return {
		...(draft.id === undefined ? {} : { id: draft.id }),
		name: draft.name,
		priority: draft.priority,
		enabled: draft.enabled,
		assetIds: [...draft.assetIds],
		condition: cloneCondition(draft.condition)
	};
}

/**
 * Turns a stored rule into an editable draft.
 *
 * @param rule - The rule to edit.
 * @returns An independent draft copy of the rule.
 */
export function ruleToDraft(rule: LoginRule): LoginRuleDraft {
	return cloneRuleDraft(rule);
}

/**
 * Builds the rule to save for a draft. A new draft takes `newId`.
 *
 * @param draft - The draft being saved.
 * @param newId - Id to use when the draft has none yet.
 * @returns The rule, copied so later draft edits do not change it.
 */
export function draftToRule(draft: LoginRuleDraft, newId: string): LoginRule {
	return { ...cloneRuleDraft(draft), id: draft.id ?? newId };
}
