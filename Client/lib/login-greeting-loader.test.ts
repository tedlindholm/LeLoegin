import { describe, expect, it } from 'vitest';
import { assertGreetingLocalizationModule, loadWithTimeout } from './login-greeting-loader.js';

describe('loadWithTimeout', () => {
	it('returns the loaded value when it resolves before the timeout', async () => {
		const expected = { default: { login: { greeting0: 'Hello' } } };
		const result = await loadWithTimeout(() => Promise.resolve(expected), 100);
		expect(result).toBe(expected);
	});

	it('rejects when the loader stalls past the timeout', async () => {
		const never = () => new Promise<never>(() => {});
		await expect(loadWithTimeout(never, 20)).rejects.toThrow('Timed out after 20ms.');
	});
});

describe('assertGreetingLocalizationModule', () => {
	it('accepts a module with an object default export and rejects malformed modules', () => {
		const valid = { default: { login: { greeting0: 'Hi' } } };
		expect(assertGreetingLocalizationModule(valid)).toEqual(valid);
		expect(() => assertGreetingLocalizationModule(null)).toThrow(
			'Le Løgin: invalid greeting localisation module.'
		);
		expect(() => assertGreetingLocalizationModule({})).toThrow(
			'Le Løgin: invalid greeting localisation module.'
		);
		expect(() => assertGreetingLocalizationModule({ default: 'not-an-object' })).toThrow(
			'Le Løgin: invalid greeting localisation module.'
		);
	});
});
