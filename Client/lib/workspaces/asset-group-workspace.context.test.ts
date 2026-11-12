import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const contextFilePath = resolve(currentDirectory, 'asset-group-workspace.context.ts');

describe('asset group workspace context source', () => {
	it('names the group with an exhaustive switch on the asset kind', async () => {
		const source = await readFile(contextFilePath, 'utf8');

		expect(source).toContain('switch (kind) {');
		expect(source).toContain('const unhandledKind: never = kind;');
		expect(source).not.toContain("if (kind === '");
	});
});
