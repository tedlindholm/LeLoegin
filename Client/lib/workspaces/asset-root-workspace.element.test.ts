import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceElementFilePath = resolve(currentDirectory, 'asset-root-workspace.element.ts');
const cardElementFilePath = resolve(currentDirectory, 'asset-card.element.ts');

describe('asset root workspace imports', () => {
	it('uses a pure TypeScript create menu instead of Lit collection helpers', async () => {
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).toContain('uui-popover-container');
		expect(source).toContain('uui-symbol-expand');
		expect(source).toContain('uui-menu-item');
		expect(source).not.toContain('@umbraco-cms/backoffice/external/lit');
		expect(source).not.toContain('UmbLitElement');
		expect(source).not.toContain('html`');
		expect(source).not.toContain('umb-collection-create-action-button');
		expect(source).not.toContain("import '@umbraco-cms/backoffice/collection'");
	});

	it('renders actions and content with DOM nodes instead of string re-renders', async () => {
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('#buildAssetSection(');
		expect(source).not.toContain('actionsEl.innerHTML =');
		expect(source).not.toContain('content.innerHTML =');
		expect(source).not.toContain('#renderCreateButtonMarkup()');
		expect(source).not.toContain('#renderContentMarkup()');
		expect(source).not.toContain('#hydrate()');
	});

	it('provides entity actions through UmbEntityContext without deprecated bundle props', async () => {
		const source = await readFile(cardElementFilePath, 'utf8');

		expect(source).toContain('new UmbEntityContext(this)');
		expect(source).toContain('setEntityType(value?.entityType)');
		expect(source).toContain('setUnique(value?.unique ?? null)');
		expect(source).toContain('<umb-entity-actions-bundle slot="actions" label="${escapeHTML(this.#value.name)}"></umb-entity-actions-bundle>');
		expect(source).not.toContain('.entityType=${');
		expect(source).not.toContain('.unique=${');
		expect(source).not.toContain('<umb-entity-actions-table-column-view');
	});
});
