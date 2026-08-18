import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const dataSourceFilePath = resolve(currentDirectory, 'asset.data-source.ts');

describe('asset data source', () => {
	it('uses the generated preview endpoint through the authenticated API client', async () => {
		const source = await readFile(dataSourceFilePath, 'utf8');

		expect(source).toContain('getAssetsByIdPreview');
		expect(source).not.toContain('fetch(');
	});
});
