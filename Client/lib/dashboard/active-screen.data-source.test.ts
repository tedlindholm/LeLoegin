import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const dataSourceFilePath = resolve(currentDirectory, 'active-screen.data-source.ts');

describe('active-screen data source', () => {
	it('catches adapter parse errors so they surface as { error } instead of an uncaught rejection', async () => {
		const source = await readFile(dataSourceFilePath, 'utf8');

		// The data source must wrap mapApiActiveLeLøginScreenResponse in try/catch so a
		// malformed 200 response (e.g. imageUrl: null) becomes a recoverable error rather
		// than an exception that leaves the dashboard stuck on the loading spinner.
		const tryCatchMatches = source.match(/try\s*{[\s\S]*?mapApiActiveLeLøginScreenResponse[\s\S]*?}\s*catch/g) ?? [];
		expect(tryCatchMatches.length).toBeGreaterThanOrEqual(2);
	});
});
