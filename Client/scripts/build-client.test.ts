import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
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
	const process = spawn('node', ['scripts/build-client.ts', version, directory], {
		cwd: clientDirectory,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	let output = '';
	process.stdout.on('data', (data: Buffer) => {
		output += data.toString();
	});
	process.stderr.on('data', (data: Buffer) => {
		output += data.toString();
	});
	return new Promise<void>((resolveBuild, reject) => {
		process.on('error', reject);
		process.on('close', (code) =>
			code === 0 ? resolveBuild() : reject(new Error(`Client build failed (${code}): ${output}`))
		);
	});
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
	await Promise.all([buildClient('17.7.0-rc.1', v17), buildClient('18.0.0-rc.1', v18)]);
	expect(JSON.parse(await readFile(join(v17, 'umbraco-package.json'), 'utf8')).version).toBe(
		'17.7.0-rc.1'
	);
	expect(JSON.parse(await readFile(join(v18, 'umbraco-package.json'), 'utf8')).version).toBe(
		'18.0.0-rc.1'
	);
	expect(await readFile(join(clientDirectory, 'public/umbraco-package.json'), 'utf8')).toBe(
		template
	);
}, 30_000);

it('keeps the published manifest and old imports available throughout a rebuild', async () => {
	const root = await temporaryDirectory();
	const directory = join(root, 'App_Plugins', 'le-løgin');
	const manifest = '{"version":"previous","extensions":[{"js":"old-entry.js"}]}';
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, 'umbraco-package.json'), manifest);
	await writeFile(join(directory, 'old-entry.js'), 'export const previous = true;');
	const failures: Array<unknown> = [];
	const check = async () => {
		try {
			JSON.parse(await readFile(join(directory, 'umbraco-package.json'), 'utf8'));
			await readFile(join(directory, 'old-entry.js'));
			const siblings = await readdir(join(directory, '..'));
			if (siblings.some((name) => name.startsWith('.lelogin-build-'))) {
				throw new Error('Staging must remain outside the public App_Plugins directory.');
			}
		} catch (error) {
			failures.push(error);
		}
	};
	const timer = setInterval(() => {
		void check();
	}, 5);
	try {
		await buildClient('17.7.0-rc.1', directory);
	} finally {
		clearInterval(timer);
	}
	await check();
	expect(failures).toEqual([]);
	expect(await readFile(join(directory, 'old-entry.js'), 'utf8')).toContain('previous');
	expect((await readdir(directory)).some((name) => name.startsWith('.'))).toBe(false);
}, 30_000);

it('leaves published files untouched when the build arguments are invalid', async () => {
	const directory = await temporaryDirectory();
	await writeFile(join(directory, 'umbraco-package.json'), '{"version":"previous"}');
	await expect(buildClient('N/A', directory)).rejects.toThrow();
	expect(await readFile(join(directory, 'umbraco-package.json'), 'utf8')).toBe(
		'{"version":"previous"}'
	);
});
