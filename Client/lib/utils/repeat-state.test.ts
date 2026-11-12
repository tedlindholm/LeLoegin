import { UmbStringState } from '@umbraco-cms/backoffice/observable-api';
import { describe, expect, it } from 'vitest';
import { setStringStateAlways } from './repeat-state.js';

const recordValues = (state: UmbStringState<string>) => {
	const seen: string[] = [];
	const subscription = state.asObservable().subscribe((value) => seen.push(value));
	return { seen, stop: () => subscription.unsubscribe() };
};

describe('setStringStateAlways', () => {
	it('tells observers about a message they have already received', () => {
		const state = new UmbStringState('');
		const { seen, stop } = recordValues(state);

		setStringStateAlways(state, 'File too large');
		setStringStateAlways(state, 'File too large');
		stop();

		expect(seen).toEqual(['', 'File too large', '', 'File too large']);
	});

	it('shows the plain setValue call missing the repeat, which is the bug it prevents', () => {
		const state = new UmbStringState('');
		const { seen, stop } = recordValues(state);

		state.setValue('File too large');
		state.setValue('File too large');
		stop();

		expect(seen).toEqual(['', 'File too large']);
	});
});
