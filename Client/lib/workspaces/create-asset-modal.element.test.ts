import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const modalElementFilePath = resolve(currentDirectory, 'create-asset-modal.element.ts');
const tokenFilePath = resolve(currentDirectory, 'create-asset-modal.token.ts');

describe('create asset modal source', () => {
	it('renders the modal body with DOM nodes and submits the chosen kind', async () => {
		const source = await readFile(modalElementFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('updateValue({ kind })');
		expect(source).toContain('submit()');
		expect(source).not.toContain('this.#layout.innerHTML =');
	});

	it('exposes a typed modal token with the kind value contract', async () => {
		const source = await readFile(tokenFilePath, 'utf8');

		expect(source).toContain("'LeLøgin.Modal.CreateAsset'");
		expect(source).toContain('CreateAssetModalValue');
		expect(source).toContain("'background'");
		expect(source).toContain("'logo'");
	});
});
