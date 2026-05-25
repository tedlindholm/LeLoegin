import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const templateUtilFilePath = resolve(currentDirectory, 'template.ts');

describe('cloneTemplate utility source', () => {
	it('force-upgrades custom elements in the cloned fragment so template clones expose real component APIs', async () => {
		// Regression test for the "Expected reference node / condition editor / …"
		// runtime crashes: without this upgrade, custom elements cloned out of a
		// <template> remain plain HTMLElements until they connect to the DOM, which
		// breaks any property-existence guard run against the clone.
		const source = await readFile(templateUtilFilePath, 'utf8');

		expect(source).toContain('customElements.upgrade(fragment)');
		// The side-effect import ensures the UUI element classes are registered
		// before `upgrade()` runs — otherwise it would be a no-op for our tags.
		expect(source).toContain("import '@umbraco-cms/backoffice/components'");
	});
});
