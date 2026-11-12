import { describe, expect, it } from 'vitest';
import { loadWithTimeout } from './login-greeting-loader.js';

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
