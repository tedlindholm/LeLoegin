import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const clientDirectory = resolve(import.meta.dirname, '..');
const temporaryDirectories: Array<string> = [];

async function temporaryDirectory() {
	const directory = await mkdtemp(join(tmpdir(), 'lelogin-client-build-'));
	temporaryDirectories.push(directory);
	return directory;
}

function buildClient(version: string, directory: string) {
	// process.execPath is the Node running Vitest, so the script gets the same TypeScript support.
	const child = spawn(process.execPath, ['scripts/build-client.ts', version, directory], {
		cwd: clientDirectory,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	let output = '';
	child.stdout.on('data', (data: Buffer) => {
		output += data.toString();
	});
	child.stderr.on('data', (data: Buffer) => {
		output += data.toString();
	});
	return new Promise<void>((resolveBuild, reject) => {
		child.on('error', reject);
		child.on('close', (code) =>
			code === 0 ? resolveBuild() : reject(new Error(`Client build failed (${code}): ${output}`))
		);
	});
}

function readVersion(manifest: string): unknown {
	const parsed: unknown = JSON.parse(manifest);
	return typeof parsed === 'object' && parsed !== null && 'version' in parsed
		? parsed.version
		: undefined;
}

/** `Array.isArray` narrows `unknown` to `any[]`; this keeps the elements `unknown`. */
const isUnknownArray = (value: unknown): value is ReadonlyArray<unknown> => Array.isArray(value);

/** The file names of the `js` entries a manifest asks Umbraco to import. */
function manifestEntryFiles(manifest: string): Array<string> {
	const parsed: unknown = JSON.parse(manifest);
	if (typeof parsed !== 'object' || parsed === null || !('extensions' in parsed)) return [];
	const extensions = parsed.extensions;
	if (!isUnknownArray(extensions)) return [];
	const files: Array<string> = [];
	for (const extension of extensions) {
		if (typeof extension === 'object' && extension !== null && 'js' in extension) {
			const js = extension.js;
			if (typeof js === 'string') files.push(js.slice(js.lastIndexOf('/') + 1));
		}
	}
	return files;
}

async function exists(path: string) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Checks repeatedly, while a build runs, that the published manifest parses and that every
 * entry it names exists. Each check is tracked so all of them finish before the test asserts.
 */
function watchPublishedManifest(directory: string) {
	const failures: Array<unknown> = [];
	const checks: Array<Promise<void>> = [];
	const check = async () => {
		try {
			const manifest = await readFile(join(directory, 'umbraco-package.json'), 'utf8');
			for (const file of manifestEntryFiles(manifest)) {
				if (await exists(join(directory, file))) continue;
				// Old entries are removed only after the new manifest is published. A check that
				// read the old manifest just before that can find its entry gone; that is only a
				// failure if the manifest still names the missing file.
				const current = await readFile(join(directory, 'umbraco-package.json'), 'utf8');
				if (current === manifest)
					throw new Error(`The published manifest names a missing entry: ${file}`);
			}
			const siblings = await readdir(join(directory, '..'));
			if (siblings.some((name) => name.startsWith('.lelogin-build-'))) {
				throw new Error('Staging must remain outside the public App_Plugins directory.');
			}
		} catch (error) {
			failures.push(error);
		}
	};
	const timer = setInterval(() => checks.push(check()), 5);
	return async () => {
		clearInterval(timer);
		checks.push(check());
		await Promise.all(checks);
		return failures;
	};
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

it('builds each major with its own version without changing the source manifest', async () => {
	const root = await temporaryDirectory();
	const template = await readFile(join(clientDirectory, 'public/umbraco-package.json'), 'utf8');
	const v17 = join(root, 'v17');
	const v18 = join(root, 'v18');
	await buildClient('17.7.0-rc.1', v17);
	await buildClient('18.0.0-rc.1', v18);
	expect(readVersion(await readFile(join(v17, 'umbraco-package.json'), 'utf8'))).toBe(
		'17.7.0-rc.1'
	);
	expect(readVersion(await readFile(join(v18, 'umbraco-package.json'), 'utf8'))).toBe(
		'18.0.0-rc.1'
	);
	expect(await readFile(join(clientDirectory, 'public/umbraco-package.json'), 'utf8')).toBe(
		template
	);
}, 60_000);

it('keeps the published manifest and its entries available throughout a rebuild, then removes stale files', async () => {
	const root = await temporaryDirectory();
	const directory = join(root, 'App_Plugins', 'le-løgin');
	const manifest =
		'{"version":"previous","extensions":[{"js":"/App_Plugins/le-løgin/old-entry.js"}]}';
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, 'umbraco-package.json'), manifest);
	await writeFile(join(directory, 'old-entry.js'), 'export const previous = true;');
	await writeFile(join(directory, 'old-chunk-abc123.js'), 'export const stale = true;');
	const stopWatching = watchPublishedManifest(directory);

	try {
		await buildClient('17.7.0-rc.1', directory);
	} finally {
		expect(await stopWatching()).toEqual([]);
	}

	const published = await readFile(join(directory, 'umbraco-package.json'), 'utf8');
	expect(readVersion(published)).toBe('17.7.0-rc.1');
	for (const file of manifestEntryFiles(published)) {
		expect(await exists(join(directory, file))).toBe(true);
	}
	const remaining = await readdir(directory);
	expect(remaining).not.toContain('old-entry.js');
	expect(remaining).not.toContain('old-chunk-abc123.js');
	expect(remaining.some((name) => name.startsWith('.') || name.endsWith('.tmp'))).toBe(false);
}, 60_000);

it('leaves published files untouched when the build arguments are invalid', async () => {
	const directory = await temporaryDirectory();
	await writeFile(join(directory, 'umbraco-package.json'), '{"version":"previous"}');
	await expect(buildClient('N/A', directory)).rejects.toThrow(
		'Expected a package version and an output directory.'
	);
	expect(await readFile(join(directory, 'umbraco-package.json'), 'utf8')).toBe(
		'{"version":"previous"}'
	);
});
