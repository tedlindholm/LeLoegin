import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const cssFilePath = resolve(currentDirectory, 'asset-workspace.element.css');

describe('asset workspace hover affordances', () => {
	it('keeps the greeting field chrome subtle until hover or focus', async () => {
		const source = await readFile(cssFilePath, 'utf8');

		expect(source).toContain('.preview-greeting-field:hover #asset-greeting-inline');
		expect(source).toContain('.preview-greeting-field:focus-within #asset-greeting-inline');
		expect(source).toContain('--uui-input-background-color: transparent;');
		expect(source).toContain('--uui-input-border-color: transparent;');
	});

	it('reveals the overlay action bars only when the preview stage is hovered or focused', async () => {
		const source = await readFile(cssFilePath, 'utf8');

		expect(source).toMatch(/\.preview-logo-picker[\s\S]*opacity: 0;/);
		expect(source).toContain('.preview-stage:is(:hover, :focus-within) .preview-logo-picker');
		expect(source).toContain('.preview-stage:is(:hover, :focus-within) .preview-zoom-controls');
	});

	it('does not hand-roll per-button styling for the action-bar controls', async () => {
		const source = await readFile(cssFilePath, 'utf8');

		expect(source).not.toContain('#asset-logo-picker-button {');
		expect(source).not.toContain('#asset-zoom-in,');
		expect(source).not.toContain('.preview-control-label');
	});
});
