import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const customiserFilePath = resolve(currentDirectory, 'auth-view-customiser.ts');
const observationFilePath = resolve(currentDirectory, 'auth-view-observation.ts');

describe('auth view preview customiser', () => {
	it('disables rendered providers instead of replacing the slot with custom UUI controls', async () => {
		const source = await readFile(customiserFilePath, 'utf8');

		expect(source).toContain('const disableInteractiveElements = (root: ParentNode) => {');
		expect(source).toContain("providers.setAttribute('inert', '');");
		expect(source).not.toContain("document.createElement('uui-input')");
		expect(source).not.toContain("document.createElement('uui-button')");
		expect(source).not.toContain("document.createElement('uui-tag')");
		expect(source).not.toContain('providers.replaceChildren(');
	});

	it('coalesces mutation updates so preview customisation cannot hot-loop itself', async () => {
		const source = await readFile(observationFilePath, 'utf8');

		expect(source).toContain('observer.disconnect();');
		expect(source).toContain('state.frameHandle = requestAnimationFrame(() => {');
		expect(source).toContain('cancelAnimationFrame(state.frameHandle);');
		expect(source).not.toContain(
			'const observer = new MutationObserver(() => {\n\t\tapply();\n\t});'
		);
	});

	it('can hide the native greeting when the preview overlays its own editor input', async () => {
		const source = await readFile(customiserFilePath, 'utf8');

		expect(source).toContain('hideGreeting?: boolean;');
		expect(source).toContain("greeting.style.visibility = hidden ? 'hidden' : '';");
		expect(source).not.toContain("document.createElement('h1')");
	});

	it('clears stale preview logo image sources when no logo is selected', async () => {
		const source = await readFile(customiserFilePath, 'utf8');

		expect(source).toContain("element.removeAttribute('src');");
		expect(source).toContain("element.style.visibility = 'hidden';");
	});
});
