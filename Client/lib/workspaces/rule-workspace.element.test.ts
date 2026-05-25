import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceElementFilePath = resolve(currentDirectory, 'rule-workspace.element.ts');

describe('rule workspace source', () => {
	it('renders the workspace body with DOM nodes instead of string markup and hydrate rebinding', async () => {
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('#buildAssetCard(');
		expect(source).not.toContain('this.#layout.innerHTML =');
		expect(source).not.toContain('#renderBody(): string');
		expect(source).not.toContain('#renderAssetCard(asset: LoginImageAsset): string');
		expect(source).not.toContain('#hydrate()');
	});

	it('builds the condition editor with document.createElement, not inside a <template>', async () => {
		// Regression: when `<login-screen-condition-editor>` was placed inside the
		// workspace-body <template>, it remained un-upgraded after cloning. Subsequent
		// property writes (`.conditionMetadata = …`, `.conditionGroup = …`) became
		// own-properties that shadowed the class getter/setter pair, so #render() never
		// fired and the runtime threw "Expected condition editor with id …". Building
		// the element with document.createElement returns a fully-upgraded instance.
		const source = await readFile(workspaceElementFilePath, 'utf8');

		expect(source).toContain("document.createElement('login-screen-condition-editor')");
		expect(source).toContain('condition-editor-slot');
		expect(source).not.toContain('<login-screen-condition-editor id="condition-editor">');
	});
});