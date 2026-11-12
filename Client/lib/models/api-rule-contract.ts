import type { LoginRuleConditionOperator, LoginRuleField } from '../api/index.js';

/**
 * The generated contract types and the domain types are the same literal unions, so no
 * translation happens here any more. What remains is runtime narrowing for values that
 * arrive as plain strings — condition-metadata object keys — plus compile-time pins
 * (`satisfies`) that break this file the moment the generated contract drifts from the
 * lists below.
 */
const makeValidator = <Value extends string>(label: string, values: readonly Value[]) => {
	const isKnown = (value: string): value is Value => values.some((known) => known === value);
	return (value: string): Value => {
		if (isKnown(value)) return value;
		throw new Error(`Le Løgin received an unsupported ${label} '${value}'.`);
	};
};

/**
 * Narrows a plain string to a known condition operator.
 *
 * @param value - The candidate operator.
 * @returns The value, typed as a condition operator.
 * @throws {Error} When the value is not a supported operator.
 */
export const ensureConditionOperator = makeValidator('condition operator', [
	'is',
	'isNot',
	'in',
	'notIn',
	'between',
	'notBetween'
] as const satisfies readonly LoginRuleConditionOperator[]);

/**
 * Narrows a plain string to a known condition field.
 *
 * @param value - The candidate field.
 * @returns The value, typed as a condition field.
 * @throws {Error} When the value is not a supported field.
 */
export const ensureConditionField = makeValidator('condition field', [
	'weekday',
	'month'
] as const satisfies readonly LoginRuleField[]);
