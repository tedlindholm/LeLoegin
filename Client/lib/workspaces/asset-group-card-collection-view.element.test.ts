import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceElementFilePath = resolve(currentDirectory, 'asset-group-card-collection-view.element.ts');

describe('asset group card collection view source', () => {
	it('renders cards with DOM nodes instead of string markup and hydration', async () => {
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('#buildAssetCard(');
		expect(source).not.toContain('this.#root.innerHTML =');
		expect(source).not.toContain('#hydrateCards()');
	});
});