import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceElementFilePath = resolve(currentDirectory, 'asset-workspace.element.ts');
const workspaceManifestFilePath = resolve(currentDirectory, 'manifests.ts');

const readWorkspaceSources = async () => {
	const [workspaceElementSource, workspaceManifestSource] = await Promise.all([
		readFile(workspaceElementFilePath, 'utf8'),
		readFile(workspaceManifestFilePath, 'utf8'),
	]);

	return { workspaceElementSource, workspaceManifestSource };
};

it('uses the auth view preview shell without the old asset list', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain("import '@umbraco-cms/backoffice/auth';");
	expect(workspaceElementSource).toContain('this.consumeContext(UMB_LOGIN_SCREEN_ASSET_EDITOR_WORKSPACE_CONTEXT');
	expect(workspaceElementSource).not.toContain('#resolveAssetIdFromLocation()');
	expect(workspaceElementSource).not.toContain('window.location.href');
	expect(workspaceElementSource).not.toContain('Upload New Asset');
	expect(workspaceElementSource).not.toContain('Login screen assets list');
	expect(workspaceElementSource).not.toContain('#renderAssetList');
});

it('uses thumbnail API URLs for asset previews', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('#thumbnailUrl(');
	expect(workspaceElementSource).toContain('/thumbnail`');
	expect(workspaceElementSource).not.toContain('URL.createObjectURL');
	expect(workspaceElementSource).not.toContain('URL.revokeObjectURL');
});

it('keeps the editor deliberately simple', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('umb-entity-detail-workspace-editor');
	expect(workspaceElementSource).toContain('umb-workspace-header-name-editable');
	expect(workspaceElementSource).not.toContain('back-path=');
	expect(workspaceElementSource).not.toContain('headline=');
	expect(workspaceElementSource).not.toContain('enforceNoFooter');
	expect(workspaceElementSource).toContain('updateDraft({');
	expect(workspaceElementSource).not.toContain('id="asset-save-button"');
	expect(workspaceElementSource).not.toContain('Publish asset');
	expect(workspaceElementSource).not.toContain('Save changes');
	expect(workspaceElementSource).not.toContain('Back to assets');
	expect(workspaceElementSource).not.toContain('Logo URL');
	expect(workspaceElementSource).not.toContain("'Draft'");
	expect(workspaceElementSource).not.toContain("'Published'");
	expect(workspaceElementSource).not.toContain('Updated ');
});

it('hydrates inline preview controls instead of the old right-hand form widgets', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain("closest('#asset-greeting-inline')");
	expect(workspaceElementSource).toContain('umbOpenModal');
	expect(workspaceElementSource).toContain('LOGO_PICKER_MODAL_TOKEN');
	expect(workspaceElementSource).toContain("closest('#asset-logo-picker-button')");
	expect(workspaceElementSource).toContain('hideGreeting: true');
	expect(workspaceElementSource).not.toContain("querySelector('#asset-logo-asset')");
});

it('preserves an explicit empty logo selection so saves can clear the stored logo', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('updateDraft({ logoAssetId: result.logoAssetId });');
	expect(workspaceElementSource).not.toContain('updateDraft({ logoAssetId: normaliseOptionalInputValue(result.logoAssetId) });');
});

it('replaces the workspace body with DOM nodes instead of assigning HTML strings', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('replaceChildren(');
	expect(workspaceElementSource).toContain('buildWorkspaceBody(');
	expect(workspaceElementSource).not.toContain('this.#layout.innerHTML =');
	expect(workspaceElementSource).not.toContain('renderWorkspaceBodyMarkup(');
});

it('registers the asset editor as a routable workspace', async () => {
	const { workspaceManifestSource } = await readWorkspaceSources();

	expect(workspaceManifestSource).toContain("kind: 'routable'");
	expect(workspaceManifestSource).toContain("api: () => import('./asset-editor-workspace.context.js')");
	expect(workspaceManifestSource).toContain("type: 'workspaceAction'");
	expect(workspaceManifestSource).toContain('UmbSubmitWorkspaceAction');
	expect(workspaceManifestSource).not.toContain("element: () => import('./asset-workspace.element.js')");
});
