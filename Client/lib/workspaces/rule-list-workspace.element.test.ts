import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceElementFilePath = resolve(currentDirectory, 'rule-list-workspace.element.ts');

describe('LeLøginScreenRuleListWorkspace source', () => {
	it('uses template-based DOM updates instead of string re-renders', async () => {
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('#buildRow(rule: LoginRule)');
		expect(source).not.toContain('this.#listBox.innerHTML = this.#renderList()');
		expect(source).not.toContain('#renderList(): string');
		expect(source).not.toContain('#renderRow(rule: LoginRule): string');
	});

	it('gates UUI custom-element guards on `localName` so neither un-upgraded clones nor freshly-upgraded UUI defaults trip them', async () => {
		// Regression test for the "Expected reference node" runtime crash. Two
		// failure modes a property-existence guard suffers from:
		//   1. Un-upgraded clones from <template> don't have the custom properties.
		//   2. Freshly upgraded UUI elements (uui-input, uui-toggle, …) default
		//      reactive properties to `undefined`, so `typeof el.value === 'string'`
		//      can fail on a perfectly valid element.
		// Tag-name guards work in both cases; UUI's LitElement base picks up our
		// property writes via the upgrade-fix pass on connection.
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain("from '../utils/template.js'");
		expect(source).toContain('cloneTemplate(this.#rowTemplate');
		expect(source).toContain("el.localName === 'uui-toggle'");
		expect(source).toContain("el.localName === 'uui-ref-node'");
		expect(source).toContain("el.localName === 'uui-button'");
	});
});
