import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceElementFilePath = resolve(currentDirectory, 'root-workspace.element.ts');

describe('root workspace source', () => {
	it('renders the rule selector menu with DOM nodes instead of string markup', async () => {
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('#buildRuleMenuItem(');
		expect(source).not.toContain('this.#ruleMenu.innerHTML =');
		expect(source).not.toContain("querySelectorAll('uui-menu-item[data-rule-id]').forEach");
		expect(source).not.toContain('this.#selectorButton.textContent =');
	});
});