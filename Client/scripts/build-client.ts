import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'vite';
import { createClientConfig } from '../vite.config.ts';

const isDigits = (text: string) => text.length > 0 && [...text].every((c) => c >= '0' && c <= '9');
const isIdentifierText = (text: string) =>
	text.length > 0 &&
	[...text].every(
		(c) =>
			(c >= '0' && c <= '9') ||
			(c >= 'a' && c <= 'z') ||
			(c >= 'A' && c <= 'Z') ||
			c === '_' ||
			c === '.' ||
			c === '-'
	);

/** `major.minor.patch`, optionally followed by `-prerelease` and `+build`. */
const isPackageVersion = (value: string) => {
	const [withoutBuild = '', build, ...extra] = value.split('+');
	if (extra.length > 0 || (build !== undefined && !isIdentifierText(build))) return false;
	const dash = withoutBuild.indexOf('-');
	const core = dash < 0 ? withoutBuild : withoutBuild.slice(0, dash);
	if (dash >= 0 && !isIdentifierText(withoutBuild.slice(dash + 1))) return false;
	const parts = core.split('.');
	return parts.length === 3 && parts.every(isDigits);
};

const [version, outputDirectory] = process.argv.slice(2);
if (!version || !isPackageVersion(version) || !outputDirectory) {
	throw new Error('Expected a package version and an output directory.');
}

const destination = resolve(outputDirectory);
await assertSafeOutputDirectory(destination);
await mkdir(dirname(destination), { recursive: true });
const staging = await mkdtemp(join(tmpdir(), 'lelogin-build-'));
try {
	const config = createClientConfig(version);
	await build({
		...config,
		configFile: false,
		root: resolve(import.meta.dirname, '..'),
		build: { ...config.build, outDir: staging }
	});
	const files = await readdir(staging, { recursive: true });
	await mkdir(destination, { recursive: true });
	for (const file of files.filter((file) => file !== 'umbraco-package.json')) {
		if ((await stat(join(staging, file))).isFile()) {
			await publish(file);
		}
	}
	// Publish the manifest last so every entry it names is already available.
	await publish('umbraco-package.json');
	// Only now that the new manifest is live, remove files from earlier builds. Entry and chunk
	// names are hashed, so without this they would accumulate and be packed with the package.
	await removeFilesNotIn(new Set(files));
} finally {
	await rm(staging, { recursive: true, force: true });
}

async function publish(file: string) {
	const target = join(destination, file);
	await mkdir(dirname(target), { recursive: true });
	const temporary = `${target}.${randomUUID()}.tmp`;
	try {
		await copyFile(join(staging, file), temporary);
		await rename(temporary, target);
	} finally {
		await rm(temporary, { force: true });
	}
}

async function removeFilesNotIn(published: Set<string>) {
	for (const file of await readdir(destination, { recursive: true })) {
		if (published.has(file)) continue;
		const path = join(destination, file);
		if ((await stat(path)).isFile()) {
			await rm(path, { force: true });
		}
	}
}

function isInsideDirectory(parent: string, child: string) {
	const rel = relative(parent, child);
	return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'));
}

function isEnoentError(error: unknown) {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function readDirectoryIfExists(directory: string): Promise<Array<string> | undefined> {
	try {
		return await readdir(directory);
	} catch (error) {
		if (isEnoentError(error)) return undefined;
		throw error;
	}
}

async function hasLeLoginManifest(directory: string) {
	try {
		const raw = await readFile(join(directory, 'umbraco-package.json'), 'utf8');
		return isLeLoginManifest(JSON.parse(raw));
	} catch {
		return false;
	}
}

async function assertSafeOutputDirectory(directory: string) {
	const clientRoot = resolve(import.meta.dirname, '..');
	if (isInsideDirectory(clientRoot, directory)) {
		throw new Error('Refusing to build into the Client source directory.');
	}

	const entries = await readDirectoryIfExists(directory);
	if (!entries || entries.length === 0) return;

	if (!entries.includes('umbraco-package.json')) {
		throw new Error(
			'Refusing to build into a non-empty directory that does not contain a Le Løgin umbraco-package.json.'
		);
	}

	if (!(await hasLeLoginManifest(directory))) {
		throw new Error(
			'Refusing to build into a non-empty directory whose umbraco-package.json does not belong to Le Løgin.'
		);
	}
}

function isLeLoginManifest(manifest: unknown): boolean {
	if (typeof manifest !== 'object' || manifest === null) return false;
	if ('id' in manifest && manifest.id === 'le-løgin') return true;
	if ('name' in manifest && manifest.name === 'Le Løgin') return true;
	if ('extensions' in manifest && Array.isArray(manifest.extensions)) {
		return manifest.extensions.some((ext: unknown) => {
			if (typeof ext !== 'object' || ext === null || !('js' in ext)) return false;
			return typeof ext.js === 'string' && ext.js.startsWith('/App_Plugins/le-løgin/');
		});
	}
	return false;
}
