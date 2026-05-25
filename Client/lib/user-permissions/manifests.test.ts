import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const manifestsFilePath = resolve(currentDirectory, 'manifests.ts');
const indexFilePath = resolve(currentDirectory, '..', 'index.ts');
const englishLanguageFilePath = resolve(currentDirectory, '..', 'assets', 'lang', 'en.ts');

describe('Le Løgin user permissions', () => {
	it('groups Le Løgin fallback permissions under one shared entity type', async () => {
		const source = await readFile(manifestsFilePath, 'utf8');

		expect(source).toContain("type: 'entityUserPermission'");
		expect(source).toContain('forEntityTypes: [LOGIN_SCREEN_PERMISSION_ENTITY_TYPE]');
		expect(source).not.toContain('login-screen-asset-root');
		expect(source).not.toContain('login-screen-asset-upload');
		expect(source).not.toContain('login-screen-rule-list');
	});

	it('registers the permission manifests from the backoffice entry point', async () => {
		const source = await readFile(indexFilePath, 'utf8');

		expect(source).toContain(
			"import { manifests as userPermissionManifests } from './user-permissions/manifests.ts';"
		);
		expect(source).toContain('...userPermissionManifests');
	});

	it('localises the shared Le Løgin permission group heading', async () => {
		const source = await readFile(englishLanguageFilePath, 'utf8');

		expect(source).toContain('permissionsEntityGroup_login-screen');
		expect(source).toContain("'permissionsEntityGroup_login-screen': 'Le Løgin'");
	});
});
