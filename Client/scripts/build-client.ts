import { copyFile, mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
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
