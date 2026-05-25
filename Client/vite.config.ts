import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type UserConfig } from 'vite';

const OUT_DIR = '../wwwroot/App_Plugins/le-løgin';
const ENTRY_POINTS = {
	main: 'lib/index.ts'
};
const UUI_CSS_ALIAS = [
	{
		find: '@umbraco-ui/uui-css/lib',
		replacement: '@umbraco-ui/uui-css/lib/index.js'
	}
];
const INLINE_TEST_DEPS = [/^@umbraco-ui\//, /^@umbraco-cms\/backoffice\//];

/**
 * Custom vite config for Le Løgin — single backoffice entry point:
 *  - main.js → backofficeEntryPoint (section, dashboard, workspaces)
 *
 * The runtime/appEntryPoint was removed once login-screen customisation moved
 * fully server-side: image substitution is handled by LeLøginLogoMiddleware +
 * LeLøginBackgroundMiddleware, and the greeting override is contributed via
 * LeLøginPackageManifestReader. The browser only needs the backoffice bundle.
 *
 * The umbracoManifestPlugin rewrites main.js references in umbraco-package.json
 * to the hashed filename after build.
 */
export default defineConfig(({ command }) => {
	const isWatchBuild = command === 'build' && process.argv.includes('--watch');
	return createClientConfig(isWatchBuild);
});

function createClientConfig(isWatchBuild: boolean) {
	const entryPattern = isWatchBuild ? '[name].js' : '[name]-[hash].js';

	return {
		resolve: {
			alias: UUI_CSS_ALIAS
		},
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
		minify: 'oxc',
		cssMinify: 'lightningcss',
		cssCodeSplit: false,
		lib: {
			entry: ENTRY_POINTS,
			formats: ['es']
		},
		rolldownOptions: {
			external: [/^@umbraco/],
			output: {
				entryFileNames: entryPattern,
				chunkFileNames: entryPattern
			}
		}
	};
}

/**
 * After build, rewrites main.js and runtime.js references in
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

			// Replace each entry's stable name with the hashed output
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
