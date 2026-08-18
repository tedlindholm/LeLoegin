import type { LoginRuleConditionOperator, LoginRuleField } from '../api/index.js';

/**
 * The generated contract types and the domain types are the same literal unions, so no
 * translation happens here any more. What remains is runtime narrowing for values that
 * arrive as plain strings — condition-metadata object keys — plus compile-time pins
 * (`satisfies`) that break this file the moment the generated contract drifts from the
 * lists below.
 */
const makeValidator = <Value extends string>(label: string, values: readonly Value[]) => {
	const known = new Set<string>(values);
	return (value: string): Value => {
		if (known.has(value)) return value as Value;
		throw new Error(`Le Løgin received an unsupported ${label} '${value}'.`);
	};
};

export const ensureConditionOperator = makeValidator('condition operator', [
	'is',
	'isNot',
	'in',
	'notIn',
	'between',
	'notBetween'
] as const satisfies readonly LoginRuleConditionOperator[]);

export const ensureConditionField = makeValidator('condition field', [
	'weekday',
	'month'
] as const satisfies readonly LoginRuleField[]);
