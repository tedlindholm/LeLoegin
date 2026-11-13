import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isLinkInEventPath, updateSelectedAssetIds } from './rule-card-click.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

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

describe('updateSelectedAssetIds (3.3)', () => {
	it('adds an asset id on selected without duplicating existing ids', () => {
		expect(updateSelectedAssetIds(['a'], 'b', 'selected')).toEqual(['a', 'b']);
		expect(updateSelectedAssetIds(['a', 'b'], 'b', 'selected')).toEqual(['a', 'b']);
	});

	it('removes an asset id on deselected', () => {
		expect(updateSelectedAssetIds(['a', 'b'], 'a', 'deselected')).toEqual(['b']);
		expect(updateSelectedAssetIds(['b'], 'a', 'deselected')).toEqual(['b']);
	});

	it('wires rule workspace and logo picker to UUI selected and deselected events', async () => {
		const ruleWorkspace = await readFile(
			resolve(currentDirectory, 'rule-workspace.element.ts'),
			'utf8'
		);
		const logoPicker = await readFile(
			resolve(currentDirectory, 'logo-picker-modal.element.ts'),
			'utf8'
		);

		expect(ruleWorkspace).toContain("'selected'");
		expect(ruleWorkspace).toContain("'deselected'");
		expect(logoPicker).toContain("'selected'");
		expect(logoPicker).toContain("'deselected'");
	});
});
