import { copyFile, mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'vite';
import { createClientConfig } from '../vite.config.ts';

const [version, outputDirectory] = process.argv.slice(2);
if (!version || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version) || !outputDirectory) {
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
