import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { englishDictionary } from './en.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const libDirectory = resolve(currentDirectory, '..', '..');
const keyPattern = /#?(loginScreen_[A-Za-z0-9]+)/g;

const collectTypeScriptFiles = async (directory: string): Promise<Array<string>> => {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const path = resolve(directory, entry.name);

			if (entry.isDirectory()) {
				return collectTypeScriptFiles(path);
			}

			if (!entry.isFile() || !path.endsWith('.ts') || path.endsWith('.test.ts')) {
				return [];
			}

			if (path.includes('/assets/lang/')) {
				return [];
			}

			return [path];
		})
	);

	return files.flat();
};

describe('Le Løgin localisations', () => {
	it('provides English strings for every referenced loginScreen key', async () => {
		const files = await collectTypeScriptFiles(libDirectory);
		const referencedKeys = new Set<string>();

		for (const filePath of files) {
			const source = await readFile(filePath, 'utf8');

			for (const match of source.matchAll(keyPattern)) {
				const key = match[1];
				if (key !== undefined) {
					referencedKeys.add(key);
				}
			}
		}

		const availableKeys = new Set(
			Object.keys(englishDictionary.loginScreen).map((key) => `loginScreen_${key}`)
		);

		const missingKeys = [...referencedKeys]
			.filter((key) => !availableKeys.has(key))
			.sort();

		expect(missingKeys).toEqual([]);
	});
});
