import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceElementFilePath = resolve(currentDirectory, 'asset-upload-workspace.element.ts');

describe('asset upload workspace source', () => {
	it('uses DOM-based field rendering instead of string re-renders', async () => {
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('#buildImageField(');
		expect(source).not.toContain('this.#layout.innerHTML =');
		expect(source).not.toContain('#renderImageFieldMarkup(): string');
		expect(source).not.toContain('#bindFileDropzone()');
	});

	it('imports the shared cloneTemplate utility so template-cloned custom elements are upgraded before any guard runs', async () => {
		// Regression test: same class of bug as the rule-list-workspace crash. The
		// fix is in the shared `cloneTemplate` helper, which calls
		// `customElements.upgrade(fragment)` before any guard inspects the clone.
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain("from '../utils/template.js'");
		expect(source).toContain('cloneTemplate(');
	});
});
