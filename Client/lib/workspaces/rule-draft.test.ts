import { describe, expect, it } from 'vitest';
import { cloneRuleDraft, draftToRule, ruleToDraft, validateRuleDraft } from './rule-draft.js';
import type { LoginRuleDraft } from './rule-draft.js';

const draft = (overrides: Partial<LoginRuleDraft> = {}): LoginRuleDraft => ({
	name: 'Mondays',
	priority: 100,
	enabled: true,
	assetIds: ['asset-1'],
	condition: {
		operator: 'all',
		conditions: [{ id: 'c1', field: 'weekday', operator: 'is', values: ['monday'] }]
	},
	...overrides
});

const withValues = (values: Array<string | number>) =>
	draft({
		condition: {
			operator: 'all',
			conditions: [{ id: 'c1', field: 'month', operator: 'is', values }]
		}
	});

describe('validateRuleDraft', () => {
	it('accepts a complete draft', () => {
		expect(validateRuleDraft(draft())).toBeUndefined();
	});

	it('requires a name that is not blank', () => {
		expect(validateRuleDraft(draft({ name: '   ' }))).toBe('nameRequired');
	});

	it('requires at least one image', () => {
		expect(validateRuleDraft(draft({ assetIds: [] }))).toBe('assetRequired');
	});

	it.each([[[]], [['  ']], [[Number.NaN]]])('requires a value in every condition: %j', (values) => {
		expect(validateRuleDraft(withValues(values))).toBe('conditionValueRequired');
	});
});

describe('rule draft conversion', () => {
	it('round-trips a saved rule through a draft', () => {
		const rule = { ...draft(), id: 'rule-1' };

		expect(draftToRule(ruleToDraft(rule), 'unused')).toEqual(rule);
	});

	it('gives a new draft the supplied id when it becomes a rule', () => {
		expect(draftToRule(draft(), 'new-id').id).toBe('new-id');
	});

	it('clones a draft without sharing its arrays', () => {
		const original = draft();
		const clone = cloneRuleDraft(original);

		expect(clone).toEqual(original);
		expect(clone).not.toHaveProperty('id');
		expect(clone.assetIds).not.toBe(original.assetIds);
		expect(clone.condition.conditions[0]?.values).not.toBe(
			original.condition.conditions[0]?.values
		);
	});
});
