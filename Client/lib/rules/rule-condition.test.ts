import { describe, expect, it } from 'vitest';
import type { ConditionMetadata } from './rule-condition.js';
import { changeConditionField, createEmptyRuleConditionGroup } from './rule-condition.js';

const testMetadata: ConditionMetadata = {
	operators: new Map([
		['is', { arity: 'single' }],
		['isNot', { arity: 'single' }]
	]),
	fields: new Map([
		[
			'weekday',
			{
				operators: ['is', 'isNot'],
				defaultValue: 'monday',
				allowedValues: [
					'monday',
					'tuesday',
					'wednesday',
					'thursday',
					'friday',
					'saturday',
					'sunday'
				]
			}
		]
	])
};

describe('rule condition factory', () => {
	it('creates a default editable condition group', () => {
		const conditionGroup = createEmptyRuleConditionGroup(testMetadata);
		const [condition] = conditionGroup.conditions;

		expect(conditionGroup.operator).toBe('all');
		expect(conditionGroup.conditions).toHaveLength(1);
		expect(condition).toMatchObject({
			field: 'weekday',
			operator: 'is',
			values: ['monday']
		});

		if (condition === undefined) {
			throw new Error('Expected the default condition group to contain one condition.');
		}

		expect(condition.id.length).toBeGreaterThan(0);
	});
});

describe('changing a condition field', () => {
	it("replaces the previous field's value with the new field's default", () => {
		const metadata: ConditionMetadata = {
			operators: testMetadata.operators,
			fields: new Map([
				...testMetadata.fields,
				['month', { operators: ['is', 'isNot'], defaultValue: 1, allowedValues: [1, 2, 3] }]
			])
		};

		const changed = changeConditionField(
			{ id: 'condition-1', field: 'weekday', operator: 'isNot', values: ['wednesday'] },
			'month',
			metadata
		);

		expect(changed).toEqual({ id: 'condition-1', field: 'month', operator: 'isNot', values: [1] });
	});
});
