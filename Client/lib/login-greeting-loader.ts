import type { UmbLocalizationDictionary } from '@umbraco-cms/backoffice/localization-api';

/** Maximum time to wait for the pre-login greeting module before falling back to Umbraco's default. */
export const GREETING_TIMEOUT_MS = 2_000;

function isLocalizationDictionary(value: unknown): value is UmbLocalizationDictionary {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates that a dynamically imported greeting module exports a dictionary object on `default`.
 *
 * @param value - The raw module namespace returned by dynamic `import()`.
 * @returns The typed localisation module.
 */
export function assertGreetingLocalizationModule(value: unknown): {
	default: UmbLocalizationDictionary;
} {
	if (typeof value !== 'object' || value === null || !('default' in value)) {
		throw new Error('Le Løgin: invalid greeting localisation module.');
	}
	const dict: unknown = value.default;
	if (!isLocalizationDictionary(dict)) {
		throw new Error('Le Løgin: invalid greeting localisation module.');
	}
	return { default: dict };
}

/**
 * Races an async loader against a timeout so a stalled request never blocks sign-in.
 *
 * @param load - Function that starts loading the resource.
 * @param timeoutMs - Timeout in milliseconds before rejecting.
 * @returns The loaded value when it resolves before the timeout.
 */
export async function loadWithTimeout<T>(
	load: () => Promise<T>,
	timeoutMs: number = GREETING_TIMEOUT_MS
): Promise<T> {
	let timerId: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_resolve, reject) => {
		timerId = setTimeout(() => {
			reject(new Error(`Timed out after ${timeoutMs}ms.`));
		}, timeoutMs);
	});

	try {
		return await Promise.race([load(), timeout]);
	} finally {
		if (timerId !== undefined) {
			clearTimeout(timerId);
		}
	}
}
