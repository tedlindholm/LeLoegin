/** The date part a rule condition tests. */
export type LoginRuleField = 'weekday' | 'month';

/** Comparison a condition applies between the field and its values. */
export type LoginRuleConditionOperator = 'is' | 'isNot' | 'in' | 'notIn' | 'between' | 'notBetween';

/** How a group combines its conditions: every condition (`all`) or at least one (`any`). */
export type LoginRuleConditionGroupOperator = 'all' | 'any';
/** A single condition operand, such as a weekday name or a month number. */
export type LoginRuleConditionValue = string | number;

/** One condition within a rule's condition group. */
export interface LoginRuleCondition {
	/** Client-generated identifier, stable across edits. */
	id: string;
	/** The date part being tested. */
	field: LoginRuleField;
	/** The comparison applied. */
	operator: LoginRuleConditionOperator;
	/** Operands; their count follows the operator's arity (one, a set, or a two-item range). */
	values: Array<LoginRuleConditionValue>;
}

/** The conditions of a rule and how they combine. */
export interface LoginRuleConditionGroup {
	/** Whether all or any of the conditions must match. */
	operator: LoginRuleConditionGroupOperator;
	/** The conditions in display order. */
	conditions: Array<LoginRuleCondition>;
}

/** Server-supplied description of an operator. */
export interface ConditionOperatorMetadata {
	/** How many values the operator takes: one, a set, or a two-item range. */
	readonly arity: 'single' | 'set' | 'range';
}

/** Server-supplied description of a field. */
export interface ConditionFieldMetadata {
	/** Operators valid for the field, in display order. */
	readonly operators: ReadonlyArray<LoginRuleConditionOperator>;
	/** Value used when a condition on this field needs a starting value. */
	readonly defaultValue: LoginRuleConditionValue;
	/** Permitted values, when the field is restricted to a fixed list. */
	readonly allowedValues?: ReadonlyArray<LoginRuleConditionValue>;
}

/** Server-authoritative metadata that drives the condition editor. */
export interface ConditionMetadata {
	/** Metadata for each operator. */
	readonly operators: ReadonlyMap<LoginRuleConditionOperator, ConditionOperatorMetadata>;
	/** Metadata for each field. */
	readonly fields: ReadonlyMap<LoginRuleField, ConditionFieldMetadata>;
}

/**
 * Type guard for {@link LoginRuleField}.
 *
 * @param value - The string to test
 * @returns `true` when the value is a known field
 */
export const isLoginRuleField = (value: string): value is LoginRuleField =>
	value === 'weekday' || value === 'month';

/**
 * Type guard for {@link LoginRuleConditionOperator}.
 *
 * @param value - The string to test
 * @returns `true` when the value is a known operator
 */
export const isLoginRuleConditionOperator = (value: string): value is LoginRuleConditionOperator =>
	value === 'is' ||
	value === 'isNot' ||
	value === 'in' ||
	value === 'notIn' ||
	value === 'between' ||
	value === 'notBetween';

const normaliseSingle = (
	values: Array<LoginRuleConditionValue>,
	fallback: LoginRuleConditionValue
): Array<LoginRuleConditionValue> => [values[0] ?? fallback];

const normaliseRange = (
	values: Array<LoginRuleConditionValue>,
	fallback: LoginRuleConditionValue
): Array<LoginRuleConditionValue> => {
	const first = values[0] ?? fallback;
	const second = values[1] ?? first;
	return [first, second];
};

const normaliseSet = (
	values: Array<LoginRuleConditionValue>,
	fallback: LoginRuleConditionValue
): Array<LoginRuleConditionValue> => (values.length === 0 ? [fallback] : [...values]);

/**
 * Reshapes a condition's values to fit the operator's arity. A single operator keeps the first
 * value, a range keeps two (repeating the first when only one exists), and a set keeps all.
 * Missing values fall back to the field's default; unknown operators are treated as single.
 *
 * @param operator - The operator the values must fit
 * @param field - The field, used to find the default value
 * @param values - The current values; not mutated
 * @param metadata - Server condition metadata
 * @returns A new array of values sized for the operator
 */
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
			return normaliseSingle(values, fallback);
		case 'range':
			return normaliseRange(values, fallback);
		case 'set':
			return normaliseSet(values, fallback);
	}
};

/**
 * Moves a condition to another field. The previous field's values mean nothing for the new field
 * (a weekday name is not a month), so they are replaced by the new field's default. The operator
 * is kept when the new field supports it; otherwise the new field's first operator is used.
 *
 * @param condition - The condition to move; not mutated
 * @param field - The new field
 * @param metadata - Server condition metadata
 * @returns A new condition with the same id
 */
export const changeConditionField = (
	condition: LoginRuleCondition,
	field: LoginRuleField,
	metadata: ConditionMetadata
): LoginRuleCondition => {
	const supportedOperators = metadata.fields.get(field)?.operators ?? [];
	const operator = supportedOperators.includes(condition.operator)
		? condition.operator
		: (supportedOperators[0] ?? condition.operator);

	return {
		...condition,
		field,
		operator,
		values: normaliseValuesForOperator(operator, field, [], metadata)
	};
};

/**
 * Creates the starting condition group for a new rule: `all`, with one `weekday is <default>`
 * condition carrying a fresh random id.
 *
 * @param metadata - Server condition metadata, used for the weekday default
 * @returns A new condition group
 */
export const createEmptyRuleConditionGroup = (
	metadata: ConditionMetadata
): LoginRuleConditionGroup => {
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
