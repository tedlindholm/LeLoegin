import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const modalElementFilePath = resolve(currentDirectory, 'logo-picker-modal.element.ts');

describe('logo picker modal source', () => {
	it('renders the modal body with DOM nodes instead of string re-renders', async () => {
		const source = await readFile(modalElementFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('#buildLogoCard(');
		expect(source).not.toContain('this.#layout.innerHTML =');
		expect(source).not.toContain("this.#layout.querySelector('#close-btn')?.addEventListener");
	});
});
