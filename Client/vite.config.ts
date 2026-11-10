import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type UserConfig } from 'vite';

/** Referenced by name from the Razor login shell, so this entry's filename cannot be hashed. */
const RAZOR_ENTRY_NAME = 'login';
const ENTRY_POINTS = {
	[RAZOR_ENTRY_NAME]: 'lib/login-bootstrap.ts',
	backoffice: 'lib/backoffice-entry.ts'
};
const INLINE_TEST_DEPS = [/^@umbraco-ui\//, /^@umbraco-cms\/backoffice\//];

/**
 * Release minification. Vite's own `build.minify` only selects which minifier runs; it leaves
 * rolldown on its `'dce-only'` default, which eliminates dead code but neither compresses nor
 * strips whitespace. Everything else has to be asked for here.
 */
const RELEASE_MINIFY = {
	compress: true,
	mangle: true,
	codegen: { removeWhitespace: true }
};

export default defineConfig(() => createClientConfig());

export function createClientConfig(packageVersion?: string) {
	const config: UserConfig = {
		publicDir: false,
		build: createBuildConfig(),
		plugins: [umbracoManifestPlugin(packageVersion)]
	};
	return {
		...config,
		test: {
			server: {
				deps: {
					inline: INLINE_TEST_DEPS
				}
			}
		}
	};
}

function createBuildConfig(): NonNullable<UserConfig['build']> {
	const entryPattern = '[name]-[hash].js';
	return {
		manifest: true,
		emptyOutDir: true,
		cssMinify: 'lightningcss',
		cssCodeSplit: false,
		lib: {
			entry: ENTRY_POINTS,
			formats: ['es']
		},
		rolldownOptions: {
			external: [/^@umbraco/],
			output: {
				// The Razor shell cache-busts `login.js` with asp-append-version, so that name has
				// to stay put. Umbraco imports the backoffice entry from the bare URL in
				// umbraco-package.json with no version query, so its hash is the only
				// cache-buster it gets — umbracoManifestPlugin rewrites the manifest to match.
				entryFileNames: (chunk: { name: string }) =>
					chunk.name === RAZOR_ENTRY_NAME ? `${RAZOR_ENTRY_NAME}.js` : entryPattern,
				chunkFileNames: entryPattern,
				minify: RELEASE_MINIFY
			}
		}
	};
}

/**
 * After build, rewrites entry references in
 * umbraco-package.json to the hashed filenames from .vite/manifest.json.
 */
function umbracoManifestPlugin(packageVersion?: string) {
	let resolvedOutDir: string;

	return {
		name: 'le-løgin-manifest',
		configResolved(config: { build: { outDir: string } }) {
			resolvedOutDir = config.build.outDir;
		},
		closeBundle() {
			writePackageManifest(resolvedOutDir, packageVersion);
		}
	};
}

function writePackageManifest(directory: string, packageVersion?: string) {
	const viteManifestPath = join(directory, '.vite', 'manifest.json');
	if (!existsSync(viteManifestPath)) return;
	const viteManifest = readObject(viteManifestPath);
	const manifest = readObject(new URL('./public/umbraco-package.json', import.meta.url));
	manifest.version = packageVersion ?? manifest.version;
	let content = JSON.stringify(manifest, null, 4);
	for (const entry of Object.values(viteManifest)) {
		if (isEntry(entry)) content = content.replaceAll(`${entry.name}.js`, entry.file);
	}
	writeFileSync(join(directory, 'umbraco-package.json'), `${content}\n`, 'utf-8');
	rmSync(join(directory, '.vite'), { recursive: true });
}

function readObject(path: string | URL): Record<string, unknown> {
	const value: unknown = JSON.parse(readFileSync(path, 'utf-8'));
	if (!isRecord(value)) throw new Error(`Expected a JSON object in ${path}.`);
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEntry(value: unknown): value is { isEntry: true; name: string; file: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'isEntry' in value &&
		value.isEntry === true &&
		'name' in value &&
		typeof value.name === 'string' &&
		'file' in value &&
		typeof value.file === 'string'
	);
}
