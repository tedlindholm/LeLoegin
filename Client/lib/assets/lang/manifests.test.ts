import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { manifests } from './manifests.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const umbracoLanguageDirectory = resolve(
	currentDirectory,
	'../../../node_modules/@umbraco-cms/backoffice/dist-cms/assets/lang'
);

describe('Le Løgin localisation manifests', () => {
	// Umbraco lists every registered localisation culture in the user's language picker, so a
	// culture Umbraco has no translation for would add a language that is only partly translated.
	it('registers only languages that Umbraco ships a backoffice translation for', async () => {
		const umbracoLanguages = new Set(
			(await readdir(umbracoLanguageDirectory))
				.filter((fileName) => fileName.endsWith('.js'))
				.map((fileName) => fileName.slice(0, -'.js'.length).split('-')[0])
		);

		const unsupported = manifests
			.map((manifest) => manifest.meta.culture)
			.filter((culture) => !umbracoLanguages.has(culture.toLowerCase().split('-')[0] ?? ''));

		expect(unsupported).toEqual([]);
	});
});
