import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type UserConfig } from 'vite';

const OUT_DIR = '../wwwroot/App_Plugins/le-løgin';
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

/** Both entry filenames stay stable: `login.js` for the Razor login shell, `backoffice.js` for the package manifest. */
export default defineConfig(({ command }) => {
	const isWatchBuild = command === 'build' && process.argv.includes('--watch');
	return createClientConfig(isWatchBuild);
});

function createClientConfig(isWatchBuild: boolean) {
	const entryPattern = isWatchBuild ? '[name].js' : '[name]-[hash].js';

	return {
		test: {
			server: {
				deps: {
					inline: INLINE_TEST_DEPS
				}
			}
		},
		build: createBuildConfig(isWatchBuild, entryPattern),
		plugins: [umbracoManifestPlugin()]
	};
}

function createBuildConfig(
	isWatchBuild: boolean,
	entryPattern: string
): NonNullable<UserConfig['build']> {
	return {
		manifest: true,
		outDir: OUT_DIR,
		// Wiping outDir races a running Umbraco reading umbraco-package.json during rebuild.
		emptyOutDir: !isWatchBuild,
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
				// Watch builds stay unminified so the package can be read and breakpointed in
				// the backoffice; release builds get the full treatment.
				minify: isWatchBuild ? false : RELEASE_MINIFY
			}
		}
	};
}

/**
 * After build, rewrites entry references in
 * umbraco-package.json to the hashed filenames from .vite/manifest.json.
 */
function umbracoManifestPlugin() {
	let resolvedOutDir: string;

	return {
		name: 'le-løgin-manifest',
		configResolved(config: { build: { outDir: string } }) {
			resolvedOutDir = config.build.outDir;
		},
		closeBundle() {
			const viteManifestPath = join(resolvedOutDir, '.vite', 'manifest.json');
			if (!existsSync(viteManifestPath)) {
				return;
			}

			const viteManifest = JSON.parse(readFileSync(viteManifestPath, 'utf-8'));

			const umbracoManifestPath = join(resolvedOutDir, 'umbraco-package.json');
			if (!existsSync(umbracoManifestPath)) {
				return;
			}

			let manifest = readFileSync(umbracoManifestPath, 'utf-8');

			// Keep this compatible with any future hashed entry output.
			for (const entry of Object.values(viteManifest) as Array<{
				file: string;
				isEntry?: boolean;
				name?: string;
			}>) {
				if (!entry.isEntry || !entry.name) {
					continue;
				}
				manifest = manifest.replaceAll(`${entry.name}.js`, entry.file);
			}

			writeFileSync(umbracoManifestPath, manifest, 'utf-8');
			rmSync(join(resolvedOutDir, '.vite'), { recursive: true });
		}
	};
}
