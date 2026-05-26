import type {
	LoginRuleConditionGroupModel,
	LoginRuleConditionModel,
	LoginRuleResponseModel,
} from '../api/index.js';
import type {
	LoginRuleConditionGroup,
	LoginRuleConditionOperator,
	LoginRuleField
} from './index.js';

export type ApiLoginRuleConditionInput = Omit<LoginRuleConditionModel, 'field' | 'operator'> & {
	field: LoginRuleConditionModel['field'] | 'weekday' | 'month';
	operator:
		| LoginRuleConditionModel['operator']
		| 'is'
		| 'isNot'
		| 'in'
		| 'notIn'
		| 'between'
		| 'notBetween';
};

export type ApiLoginRuleConditionGroupInput = Omit<LoginRuleConditionGroupModel, 'operator' | 'conditions'> & {
	operator: LoginRuleConditionGroupModel['operator'] | 'all' | 'any';
	conditions: Array<ApiLoginRuleConditionInput>;
};

export type ApiLoginRuleResponseInput = Omit<LoginRuleResponseModel, 'condition'> & {
	condition: ApiLoginRuleConditionGroupInput;
};

const makeBiMap = <Wire extends string, Domain extends string>(
	label: string,
	pairs: ReadonlyArray<readonly [Wire, Domain]>
) => {
	const wireToDomain = new Map<string, Domain>(pairs.map(([wire, domain]) => [wire.toLowerCase(), domain] as const));
	const domainToWire = new Map<string, Wire>(pairs.map(([wire, domain]) => [domain, wire] as const));

	return {
		fromWire: (wire: string): Domain => {
			const domain = wireToDomain.get(wire.toLowerCase());
			if (domain === undefined) {
				throw new Error(`Le Løgin received an unsupported ${label} '${wire}'.`);
			}
			return domain;
		},
		toWire: (domain: Domain): Wire => {
			const wire = domainToWire.get(domain);
			if (wire === undefined) {
				throw new Error(`Le Løgin cannot serialise the ${label} '${domain}'.`);
			}
			return wire;
		},
		ensureDomain: (value: string): Domain => {
			if (domainToWire.has(value)) return value as Domain;
			throw new Error(`Le Løgin received an unsupported ${label} '${value}'.`);
		}
	};
};

// The generated client still types several condition enums as PascalCase while the live API emits lowercase values.
export const conditionOperator = makeBiMap<LoginRuleConditionModel['operator'], LoginRuleConditionOperator>(
	'condition operator',
	[
		['Is', 'is'],
		['IsNot', 'isNot'],
		['In', 'in'],
		['NotIn', 'notIn'],
		['Between', 'between'],
		['NotBetween', 'notBetween']
	]
);

export const conditionField = makeBiMap<LoginRuleConditionModel['field'], LoginRuleField>('condition field', [
	['Weekday', 'weekday'],
	['Month', 'month']
]);

export const conditionGroupOperator = makeBiMap<LoginRuleConditionGroupModel['operator'], LoginRuleConditionGroup['operator']>('condition group operator', [
	['All', 'all'],
	['Any', 'any']
]);
