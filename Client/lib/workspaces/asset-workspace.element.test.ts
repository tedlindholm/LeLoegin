import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceElementFilePath = resolve(currentDirectory, 'asset-workspace.element.ts');
const workspaceManifestFilePath = resolve(currentDirectory, 'manifests.ts');

const readWorkspaceSources = async () => {
	const [workspaceElementSource, workspaceManifestSource] = await Promise.all([
		readFile(workspaceElementFilePath, 'utf8'),
		readFile(workspaceManifestFilePath, 'utf8')
	]);

	return { workspaceElementSource, workspaceManifestSource };
};

it('uses the auth view preview shell without the old asset list', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain("import '@umbraco-cms/backoffice/auth';");
	expect(workspaceElementSource).toContain(
		'this.consumeContext(UMB_LOGIN_SCREEN_ASSET_EDITOR_WORKSPACE_CONTEXT'
	);
	expect(workspaceElementSource).not.toContain('#resolveAssetIdFromLocation()');
	expect(workspaceElementSource).not.toContain('window.location.href');
	expect(workspaceElementSource).not.toContain('Upload New Asset');
	expect(workspaceElementSource).not.toContain('Login screen assets list');
	expect(workspaceElementSource).not.toContain('#renderAssetList');
});

it('loads asset previews through the authenticated thumbnail controller', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('new LeLøginAssetThumbnailController(');
	// Object URLs are created and revoked in one place, AssetThumbnailUrls.
	expect(workspaceElementSource).not.toContain('URL.createObjectURL');
	expect(workspaceElementSource).not.toContain('URL.revokeObjectURL');
});

it('builds no thumbnail URL by hand anywhere in the client', async () => {
	// The thumbnail endpoint requires backoffice authentication, which an <img src> cannot send.
	const libDirectory = resolve(currentDirectory, '..');
	const entries = await readdir(libDirectory, { recursive: true });
	const sources = entries.filter(
		(entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.gen.ts')
	);
	const offenders: Array<string> = [];
	for (const source of sources) {
		const text = await readFile(resolve(libDirectory, source), 'utf8');
		if (text.includes('/thumbnail`')) offenders.push(source);
	}

	expect(sources.length).toBeGreaterThan(20);
	expect(offenders).toEqual([]);
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
	expect(workspaceElementSource).toContain("case 'asset-logo-picker-button':");
	expect(workspaceElementSource).not.toContain("querySelector('#asset-logo-asset')");
});

it('preserves an explicit empty logo selection so saves can clear the stored logo', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('updateDraft({ logoAssetId: result.logoAssetId });');
	expect(workspaceElementSource).not.toContain(
		'updateDraft({ logoAssetId: normaliseOptionalInputValue(result.logoAssetId) });'
	);
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
	expect(workspaceManifestSource).toContain(
		"api: () => import('./asset-editor-workspace.context.js')"
	);
	expect(workspaceManifestSource).toContain("type: 'workspaceAction'");
	expect(workspaceManifestSource).toContain('UmbSubmitWorkspaceAction');
	expect(workspaceManifestSource).not.toContain(
		"element: () => import('./asset-workspace.element.js')"
	);
});

it('dispatches preview toolbar clicks with a switch on the button id', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('switch (button?.id) {');
	expect(workspaceElementSource).toContain("case 'asset-zoom-in':");
	expect(workspaceElementSource).toContain("case 'asset-zoom-out':");
	expect(workspaceElementSource).not.toContain("target.closest('#asset-zoom-in')");
});

it('leaves background dragging to its own controller', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('new LeLøginBackgroundDragController(');
	expect(workspaceElementSource).not.toContain("addEventListener('pointerdown'");
});

it('preserves in-flight local draft fields when currentAsset emits a save response for the same asset (3.11)', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('asset === null || asset.id !== this.#asset?.id');
});

it('observes loadError to distinguish load failures from not-found (3.12)', async () => {
	const { workspaceElementSource } = await readWorkspaceSources();

	expect(workspaceElementSource).toContain('ctx.loadError');
});
