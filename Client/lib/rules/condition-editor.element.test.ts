import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const conditionEditorFilePath = resolve(currentDirectory, 'condition-editor.element.ts');
const conditionEditorHelpersFilePath = resolve(currentDirectory, 'condition-editor.helpers.ts');

const readElementSource = () => readFile(conditionEditorFilePath, 'utf8');
const readEditorSources = async () =>
	(await readElementSource()) + (await readFile(conditionEditorHelpersFilePath, 'utf8'));

describe('LeLøginScreenConditionEditor element pattern', () => {
	it('uses the pure TypeScript Umbraco element pattern', async () => {
		const source = await readElementSource();

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).not.toContain('@umbraco-cms/backoffice/components');
		expect(source).not.toContain('UmbLitElement');
		expect(source).not.toContain('html`');
	});

	it('renders the expected condition editor controls', async () => {
		const source = await readEditorSources();

		expect(source).toContain('group-operator-select');
		expect(source).toContain('add-condition-btn');
		expect(source).toContain('condition-row');
		expect(source).toContain('value-input');
		expect(source).toContain('remove-btn');
	});

	it('builds condition rows with DOM nodes instead of string re-renders', async () => {
		const source = await readElementSource();

		expect(source).toContain('valueInputTemplate');
		expect(source).toContain('cloneTemplate(valueSelectTemplate');
		expect(source).toContain('cloneTemplate(valueInputTemplate');
		expect(source).not.toContain("document.createElement('uui-select')");
		expect(source).not.toContain("document.createElement('uui-input')");
	});
});

describe('LeLøginScreenConditionEditor value labels', () => {
	it('formats weekday and month labels through Umbraco localisation', async () => {
		const source = await readEditorSources();

		expect(source).toContain("localize.date(new Date(2023, 0, i + 1), { weekday: 'long' })");
		expect(source).toContain("localize.date(new Date(2023, monthNum - 1, 1), { month: 'long' })");
		expect(source).not.toContain(
			"new Intl.DateTimeFormat(navigator.language, { weekday: 'long' })"
		);
		expect(source).not.toContain("new Intl.DateTimeFormat(navigator.language, { month: 'long' })");
	});

	it('picks the value label format with a switch on the field', async () => {
		const source = await readEditorSources();

		expect(source).toContain('switch (field) {');
		expect(source).not.toContain("if (field === '");
	});
});

describe('LeLøginScreenConditionEditor change handling', () => {
	it('dispatches row changes with a switch on the control role', async () => {
		const source = await readEditorSources();

		expect(source).toContain('switch (conditionControlRole(el)) {');
		expect(source).toContain('data-role="field"');
		expect(source).toContain('data-role="operator"');
		expect(source).toContain("dataset.role = 'value'");
		expect(source).not.toContain("el.classList.contains('field-select')");
		expect(source).not.toContain("el.classList.contains('operator-select')");
	});
});
