import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const conditionEditorFilePath = resolve(currentDirectory, 'condition-editor.element.ts');

describe('LeLøginScreenConditionEditor source', () => {
	it('uses the pure TypeScript Umbraco element pattern', async () => {
		const source = await readFile(conditionEditorFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).not.toContain('@umbraco-cms/backoffice/components');
		expect(source).not.toContain('UmbLitElement');
		expect(source).not.toContain('html`');
	});

	it('renders the expected condition editor controls', async () => {
		const source = await readFile(conditionEditorFilePath, 'utf8');

		expect(source).toContain('group-operator-select');
		expect(source).toContain('add-condition-btn');
		expect(source).toContain('condition-row');
		expect(source).toContain('value-input');
		expect(source).toContain('remove-btn');
	});

	it('builds condition rows with DOM nodes instead of string re-renders', async () => {
		const source = await readFile(conditionEditorFilePath, 'utf8');

		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('#buildConditionRow(');
		expect(source).not.toContain('this.#conditionList.innerHTML =');
		expect(source).not.toContain('#renderConditionRow(condition: LoginRuleCondition, index: number): string');
	});

	it('initialises and mutates the condition group in the editor methods', async () => {
		const source = await readFile(conditionEditorFilePath, 'utf8');

		expect(source).toContain("operator: 'all'");
		expect(source).toContain('conditions: []');
		expect(source).toContain('structuredClone(value)');
		expect(source).toContain('#conditionGroup.conditions.push({');
		expect(source).toContain('#conditionGroup.conditions.splice(index, 1)');
	});

	it('emits a condition-change event with cloned detail', async () => {
		const source = await readFile(conditionEditorFilePath, 'utf8');

		expect(source).toContain("new CustomEvent<LoginRuleConditionGroup>('condition-change'");
		expect(source).toContain('detail: structuredClone(this.#conditionGroup)');
		expect(source).toContain('bubbles: true');
		expect(source).toContain('composed: true');
	});

	it('instantiates uui-select / uui-input from templates rather than via document.createElement', async () => {
		// Regression: `document.createElement('uui-select')` throws
		// NotSupportedError ("The result must not have attributes") because UUI's
		// constructor sets attributes synchronously, which the spec forbids in the
		// create-an-element flow. Template instantiation followed by
		// `customElements.upgrade()` (handled by the shared cloneTemplate helper)
		// runs the constructor in upgrade context, where that check doesn't apply.
		const source = await readFile(conditionEditorFilePath, 'utf8');

		expect(source).toContain('valueSelectTemplate');
		expect(source).toContain('valueInputTemplate');
		expect(source).toContain('cloneTemplate(valueSelectTemplate');
		expect(source).toContain('cloneTemplate(valueInputTemplate');
		expect(source).not.toContain("document.createElement('uui-select')");
		expect(source).not.toContain("document.createElement('uui-input')");
	});

	it('formats weekday and month labels through Umbraco localisation', async () => {
		const source = await readFile(conditionEditorFilePath, 'utf8');

		expect(source).toContain("this.localize.date(new Date(2023, 0, i + 1), { weekday: 'long' })");
		expect(source).toContain("this.localize.date(new Date(2023, monthNum - 1, 1), { month: 'long' })");
		expect(source).not.toContain("new Intl.DateTimeFormat(navigator.language, { weekday: 'long' })");
		expect(source).not.toContain("new Intl.DateTimeFormat(navigator.language, { month: 'long' })");
	});
});
