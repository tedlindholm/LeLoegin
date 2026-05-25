import chalk from 'chalk';
import { createClient, defaultPlugins } from '@hey-api/openapi-ts';
import { promises as fs } from 'node:fs';
import path from 'node:path';

console.log(chalk.green('Generating OpenAPI client...'));

const DEFAULT_SWAGGER_URL = 'https://localhost:44312/umbraco/swagger/le-løgin-api-v1/swagger.json';
const isCi = process.env.CI === 'true';
const swaggerUrl = process.argv[2] ?? process.env.OPENAPI_URL ?? (isCi ? undefined : DEFAULT_SWAGGER_URL);
if (swaggerUrl === undefined) {
	console.error(chalk.red('ERROR: Missing URL to OpenAPI spec.'));
	console.error(
		chalk.red(
			'Provide OPENAPI_URL or pass the Swagger URL as the first CLI argument when running in CI/non-local environments.'
		)
	);
	process.exit(1);
}

const outputDirectory = 'lib/api';

const postGenerationTypeFixes = [
	{
		filePath: path.join(outputDirectory, 'client/client.gen.ts'),
		replacements: [
			[
				'      // TODO: we probably want to return error and improve types\n',
				''
			],
		],
	},
];

const applyPostGenerationTypeFixes = async () => {
	for (const fix of postGenerationTypeFixes) {
		const absolutePath = path.resolve(fix.filePath);
		let content = await fs.readFile(absolutePath, 'utf8');

		for (const [from, to] of fix.replacements) {
			if (content.includes(from)) {
				content = content.replace(from, to);
			}
		}

		await fs.writeFile(absolutePath, content, 'utf8');
	}
};

const shouldAllowInsecureLocalTls = /^https:\/\/localhost(?::\d+)?\//.test(swaggerUrl);
if (shouldAllowInsecureLocalTls) {
	// Ignore self-signed certificates for local development only.
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

console.log(`Fetching OpenAPI definition from ${chalk.yellow(swaggerUrl)}`);

fetch(swaggerUrl)
	.then(async (response) => {
		if (!response.ok) {
			console.error(chalk.red(`ERROR: ${response.status} ${response.statusText}`));
			return;
		}

		await createClient({
			input: swaggerUrl,
			output: outputDirectory,
			plugins: [
				...defaultPlugins,
				{
					name: '@hey-api/client-fetch',
					bundle: true,
					exportFromIndex: true,
					throwOnError: true,
					baseUrl: swaggerUrl.replace(/\/umbraco\/swagger\/.*$/, '')
				},
				{
					name: '@hey-api/typescript',
					enums: 'typescript'
				},
				{
					name: '@hey-api/sdk',
					asClass: true
				}
			]
		});

		await applyPostGenerationTypeFixes();

		console.log(chalk.green('Client generated successfully!'));
		console.log(chalk.green('Post-generation type fixes applied.'));
	})
	.catch((error) => {
		console.error(`ERROR: ${chalk.red(error.message)}`);
	});
