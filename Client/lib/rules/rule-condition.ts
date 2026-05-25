export type LoginRuleField = 'weekday' | 'month' | 'date' | 'hostname';

export type LoginRuleConditionOperator =
	| 'is'
	| 'isNot'
	| 'in'
	| 'notIn'
	| 'between'
	| 'notBetween';

export type LoginRuleConditionGroupOperator = 'all' | 'any';
export type LoginRuleConditionValue = string | number;

export interface LoginRuleCondition {
	id: string;
	field: LoginRuleField;
	operator: LoginRuleConditionOperator;
	values: Array<LoginRuleConditionValue>;
}

export interface LoginRuleConditionGroup {
	operator: LoginRuleConditionGroupOperator;
	conditions: Array<LoginRuleCondition>;
}

export interface ConditionOperatorMetadata {
	readonly arity: 'single' | 'set' | 'range';
}

export interface ConditionFieldMetadata {
	readonly operators: ReadonlyArray<LoginRuleConditionOperator>;
	readonly defaultValue: LoginRuleConditionValue;
	readonly allowedValues?: ReadonlyArray<LoginRuleConditionValue>;
}

export interface ConditionMetadata {
	readonly operators: ReadonlyMap<LoginRuleConditionOperator, ConditionOperatorMetadata>;
	readonly fields: ReadonlyMap<LoginRuleField, ConditionFieldMetadata>;
}

export const isLoginRuleField = (value: string): value is LoginRuleField =>
	value === 'weekday' || value === 'month' || value === 'date' || value === 'hostname';

export const isLoginRuleConditionOperator = (value: string): value is LoginRuleConditionOperator =>
	value === 'is' ||
	value === 'isNot' ||
	value === 'in' ||
	value === 'notIn' ||
	value === 'between' ||
	value === 'notBetween';

export const normaliseValuesForOperator = (
	operator: LoginRuleConditionOperator,
	field: LoginRuleField,
	values: Array<LoginRuleConditionValue>,
	metadata: ConditionMetadata
): Array<LoginRuleConditionValue> => {
	const arity = metadata.operators.get(operator)?.arity ?? 'single';
	const fallback = metadata.fields.get(field)?.defaultValue ?? '';

	switch (arity) {
		case 'single':
			return [values[0] ?? fallback];
		case 'range':
			return [values[0] ?? fallback, values[1] ?? values[0] ?? fallback];
		case 'set':
			return values.length === 0 ? [fallback] : [...values];
	}
};

export const createEmptyRuleConditionGroup = (metadata: ConditionMetadata): LoginRuleConditionGroup => {
	const field: LoginRuleField = 'weekday';
	const operator: LoginRuleConditionOperator = 'is';
	const defaultValue = metadata.fields.get(field)?.defaultValue ?? 'monday';

	return {
		operator: 'all',
		conditions: [
			{
				id: globalThis.crypto.randomUUID(),
				field,
				operator,
				values: [defaultValue]
			}
		]
	};
};
