import type { englishDictionary } from './en.js';

type LocalisedDictionary<T> = T extends (...args: infer TArgs) => unknown
	? (...args: TArgs) => string
	: T extends string
		? string
		: T extends Record<PropertyKey, unknown>
			? { [K in keyof T]: LocalisedDictionary<T[K]> }
			: never;

/**
 * Shape every translation must match: the English dictionary's keys, with string values and
 * functions that return strings, so a missing or extra key fails to compile.
 */
export type LeLøginScreenLocalisationDictionary = LocalisedDictionary<typeof englishDictionary>;
