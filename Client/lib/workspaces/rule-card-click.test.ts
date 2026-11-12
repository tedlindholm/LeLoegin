import { describe, expect, it } from 'vitest';
import { isLinkInEventPath } from './rule-card-click.js';

const element = (localName: string) => ({ localName });

describe('isLinkInEventPath', () => {
	it('is true when the click started on the link that opens an asset', () => {
		const path = [element('span'), element('a'), element('uui-card-media'), element('div')];

		expect(isLinkInEventPath(path)).toBe(true);
	});

	it('is false for a click on the card itself, which toggles the image', () => {
		const path = [element('img'), element('uui-card-media'), element('div'), element('body')];

		expect(isLinkInEventPath(path)).toBe(false);
	});

	it('is false for an empty path', () => {
		expect(isLinkInEventPath([])).toBe(false);
	});

	it('ignores path entries that are not elements', () => {
		expect(isLinkInEventPath([null, 'text', 42, element('a')])).toBe(true);
		expect(isLinkInEventPath([null, 'text', 42])).toBe(false);
	});
});
