import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const dashboardElementFilePath = resolve(currentDirectory, 'overview-dashboard.element.ts');

describe('overview dashboard chrome', () => {
	it('uses the auth view shell in a pure TypeScript Umbraco element', async () => {
		const source = await readFile(dashboardElementFilePath, 'utf8');

		expect(source).toContain('extends UmbElementMixin(HTMLElement)');
		expect(source).toContain('<umb-auth-view id="auth-preview"></umb-auth-view>');
		expect(source).not.toContain('@umbraco-cms/backoffice/external/lit');
		expect(source).not.toContain('UmbLitElement');
		expect(source).not.toContain('html`');
		expect(source).not.toContain('headline="Active image"');
		expect(source).not.toContain('<uui-tag color="positive" look="primary">Published</uui-tag>');
		expect(source).not.toContain('LOGIN_PAGE_LOGO_ON_IMAGE');
		expect(source).not.toContain('#previewGreeting()');
	});

	it('updates the preview body with DOM nodes instead of string re-renders', async () => {
		const source = await readFile(dashboardElementFilePath, 'utf8');

		expect(source).toContain('cloneTemplate(');
		expect(source).toContain('replaceChildren(');
		expect(source).toContain('focalPoint');
		expect(source).not.toContain('this.#previewBox.innerHTML =');
		expect(source).not.toContain('#renderActiveStateMarkup()');
	});

	it('empty state links to the rule list workspace so users can create a rule', async () => {
		const source = await readFile(dashboardElementFilePath, 'utf8');

		expect(source).toContain('LOGIN_SCREEN_RULE_LIST_WORKSPACE_PATH');
		expect(source).toContain('loginScreen_goToRules');
	});
});
