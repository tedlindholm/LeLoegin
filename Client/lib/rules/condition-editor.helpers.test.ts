import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ConditionMetadata } from '../models/index.js';

const localize: Parameters<typeof operatorOptions>[0] = {
	term: (key, ..._args) => String(key),
	date: () => ''
};

let operatorOptions: typeof import('./condition-editor.helpers.js').operatorOptions;
let buildConditionShellMarkup: typeof import('./condition-editor.helpers.js').buildConditionShellMarkup;

beforeAll(async () => {
	vi.stubGlobal('document', {
		createElement: () => ({ innerHTML: '' })
	});
	({ operatorOptions, buildConditionShellMarkup } = await import('./condition-editor.helpers.js'));
});

afterAll(() => {
	vi.unstubAllGlobals();
});

describe('operatorOptions', () => {
	it('falls back to is and isNot when metadata is null', () => {
		expect(operatorOptions(localize, null, 'weekday', 'isNot')).toEqual([
			{ name: 'loginScreen_operatorIs', value: 'is', selected: false },
			{ name: 'loginScreen_operatorIsNot', value: 'isNot', selected: true }
		]);
	});

	it('maps field operators from metadata without mutating the source array', () => {
		const sourceOps = ['is', 'in'] as const;
		const metadata: ConditionMetadata = {
			operators: new Map(),
			fields: new Map([
				[
					'weekday',
					{
						operators: [...sourceOps],
						defaultValue: 'monday'
					}
				]
			])
		};

		const options = operatorOptions(localize, metadata, 'weekday', 'in');

		expect(options).toEqual([
			{ name: 'loginScreen_operatorIs', value: 'is', selected: false },
			{ name: 'loginScreen_operatorIn', value: 'in', selected: true }
		]);
		expect(metadata.fields.get('weekday')?.operators).toEqual(['is', 'in']);
	});
});

describe('buildConditionShellMarkup', () => {
	it('escapes localised labels before interpolating into HTML markup', () => {
		const escape = (v: string) =>
			v.replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
		const markup = buildConditionShellMarkup('Match <all>', 'Add "condition"', escape);

		expect(markup).toContain('>Match &lt;all&gt;</uui-label>');
		expect(markup).toContain('label="Add &quot;condition&quot;"');
	});
});
