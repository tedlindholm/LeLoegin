import { defineConfig } from 'oxlint';

export default defineConfig({
	ignorePatterns: [
		'dist/**',
		'node_modules/**',
		'lib/api/client/**',
		'lib/api/core/**',
		'lib/api/**/*.gen.ts'
	],
	categories: {
		correctness: 'error'
	},
	rules: {
		curly: 'off',
		eqeqeq: ['error', 'always'],
		'no-debugger': 'error',
		'no-var': 'error',
		'prefer-const': 'error',
		'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
		'max-lines-per-function': ['warn', { max: 40, skipBlankLines: true, skipComments: true }],
		'max-params': ['warn', { max: 4 }],
		'max-depth': ['warn', { max: 4 }],
		complexity: ['warn', { max: 10 }]
	}
});
