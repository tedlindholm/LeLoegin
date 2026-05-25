import type { englishDictionary } from './en.js';

type LocalisedDictionary<T> = T extends (...args: infer TArgs) => unknown
	? (...args: TArgs) => string
	: T extends string
		? string
		: T extends Record<PropertyKey, unknown>
			? { [K in keyof T]: LocalisedDictionary<T[K]> }
			: never;

export type LeLøginScreenLocalisationDictionary = LocalisedDictionary<typeof englishDictionary>;