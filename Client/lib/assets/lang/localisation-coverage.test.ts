import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { englishDictionary } from './en.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const libDirectory = resolve(currentDirectory, '..', '..');
const KEY_PREFIX = 'loginScreen_';

function isKeyChar(ch: string): boolean {
	const code = ch.charCodeAt(0);
	return (
		(code >= 48 && code <= 57) || // 0-9
		(code >= 65 && code <= 90) || // A-Z
		(code >= 97 && code <= 122) // a-z
	);
}

function extractLoginScreenKeys(source: string): Array<string> {
	const keys: Array<string> = [];
	let searchFrom = 0;
	while (searchFrom < source.length) {
		const start = source.indexOf(KEY_PREFIX, searchFrom);
		if (start === -1) break;
		let end = start + KEY_PREFIX.length;
		while (end < source.length && isKeyChar(source.charAt(end))) {
			end++;
		}
		if (end > start + KEY_PREFIX.length) {
			keys.push(source.slice(start, end));
		}
		searchFrom = end;
	}
	return keys;
}

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

			for (const key of extractLoginScreenKeys(source)) {
				referencedKeys.add(key);
			}
		}

		const availableKeys = new Set(
			Object.keys(englishDictionary.loginScreen).map((key) => `loginScreen_${key}`)
		);

		const missingKeys = [...referencedKeys].filter((key) => !availableKeys.has(key)).sort();

		expect(missingKeys).toEqual([]);
	});
});
