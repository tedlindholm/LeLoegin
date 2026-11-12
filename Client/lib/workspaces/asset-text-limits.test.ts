import { describe, expect, it } from 'vitest';

import { assetTextLimitViolation } from './asset-text-limits.js';

describe('assetTextLimitViolation at the limit', () => {
	it('accepts text at the API limits', () => {
		expect(
			assetTextLimitViolation({
				name: 'a'.repeat(200),
				altText: 'a'.repeat(500),
				greetingText: 'a'.repeat(500)
			})
		).toBeUndefined();
	});

	it('treats a missing greeting and alternative text as empty', () => {
		expect(assetTextLimitViolation({ name: 'City' })).toBeUndefined();
	});
});

describe('assetTextLimitViolation over the limit', () => {
	it('reports a name one character over the limit', () => {
		expect(assetTextLimitViolation({ name: 'a'.repeat(201) })).toEqual({
			field: 'name',
			maximum: 200,
			term: 'loginScreen_assetNameTooLong'
		});
	});

	it('reports alternative text before greeting text when both are over the limit', () => {
		expect(
			assetTextLimitViolation({
				name: 'City',
				altText: 'a'.repeat(501),
				greetingText: 'a'.repeat(501)
			})
		).toEqual({
			field: 'altText',
			maximum: 500,
			term: 'loginScreen_altTextTooLong'
		});
	});

	it('reports greeting text one character over the limit', () => {
		expect(
			assetTextLimitViolation({
				name: 'City',
				altText: null,
				greetingText: 'a'.repeat(501)
			})
		).toEqual({
			field: 'greetingText',
			maximum: 500,
			term: 'loginScreen_greetingTextTooLong'
		});
	});
});
