import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const version = process.argv[2];

if (version === undefined || version.trim() === '') {
	console.error('Expected a package version argument.');
	process.exit(1);
}

const updateJsonFile = (relativePath, indentation) => {
	const filePath = resolve(process.cwd(), relativePath);
	const content = readFileSync(filePath, 'utf8');
	const json = JSON.parse(content);
	json.version = version;
	writeFileSync(filePath, `${JSON.stringify(json, null, indentation)}\n`, 'utf8');
	console.log(`Updated ${relativePath} to version ${version}.`);
};

updateJsonFile('package.json', '\t');
updateJsonFile('public/umbraco-package.json', 4);
