import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const cssFilePath = resolve(currentDirectory, 'asset-workspace.element.css');

describe('asset workspace hover affordances', () => {
	it('keeps edit chrome subtle until hover or focus', async () => {
		const source = await readFile(cssFilePath, 'utf8');

		expect(source).toContain('.preview-control:is(:hover, :focus-within) .preview-control-label');
		expect(source).toContain('.preview-logo-picker:is(:hover, :focus-within) #asset-logo-picker-button');
		expect(source).toContain('.preview-greeting-field:hover #asset-greeting-inline');
		expect(source).toContain('.preview-greeting-field:focus-within #asset-greeting-inline');
		expect(source).toContain('--uui-input-background-color: transparent;');
		expect(source).toContain('--uui-input-border-color: transparent;');
		expect(source).toContain('opacity: 0;');
	});
});