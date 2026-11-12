import { expect, it } from 'vitest';
import { LatestLoad } from './latest-load.js';

it('treats only the most recently started load as current', () => {
	const loads = new LatestLoad();

	const loadA = loads.begin();
	expect(loadA()).toBe(true);

	const loadB = loads.begin();
	// A's response may arrive after B started; it must no longer count.
	expect(loadA()).toBe(false);
	expect(loadB()).toBe(true);
});
