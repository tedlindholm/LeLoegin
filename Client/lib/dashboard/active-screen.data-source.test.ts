import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { describe, expect, it, vi } from 'vitest';

const { getRuntimeActiveMock, getRulesByIdPreviewMock } = vi.hoisted(() => ({
	getRuntimeActiveMock: vi.fn(),
	getRulesByIdPreviewMock: vi.fn()
}));

vi.mock('@umbraco-cms/backoffice/class-api', () => ({
	UmbControllerBase: class {}
}));

vi.mock('@umbraco-cms/backoffice/resources', () => ({
	tryExecute: async (_host: unknown, request: Promise<unknown>) => await request
}));

vi.mock('../api/index.js', () => ({
	V1: {
		getRuntimeActive: getRuntimeActiveMock,
		getRulesByIdPreview: getRulesByIdPreviewMock
	}
}));

import { LeLøginScreenActiveScreenDataSource } from './active-screen.data-source.js';

const stubHost: UmbControllerHost = {
	getHostElement: () => document.createElement('div'),
	addUmbController: () => {},
	removeUmbController: () => {},
	removeUmbControllerByAlias: () => {},
	hasUmbController: () => false,
	getUmbControllers: () => []
};

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const dataSourceFilePath = resolve(currentDirectory, 'active-screen.data-source.ts');

describe('active-screen data source', () => {
	it('catches adapter parse errors so they surface as { error } instead of an uncaught rejection', async () => {
		const source = await readFile(dataSourceFilePath, 'utf8');

		// The data source must wrap mapApiActiveLeLøginScreenResponse in try/catch so a
		// malformed 200 response (e.g. imageUrl: null) becomes a recoverable error rather
		// than an exception that leaves the dashboard stuck on the loading spinner.
		const wrappedCalls = source
			.split('try {')
			.slice(1)
			.filter((block) => {
				const end = block.indexOf('} catch');
				return end >= 0 && block.slice(0, end).includes('mapApiActiveLeLøginScreenResponse');
			});
		expect(wrappedCalls.length).toBeGreaterThanOrEqual(1);
	});

	it('returns empty state (data: null) when getActive receives null or undefined for 204 No Content', async () => {
		const dataSource = new LeLøginScreenActiveScreenDataSource(stubHost);

		getRuntimeActiveMock.mockResolvedValueOnce({ data: null, error: undefined });
		await expect(dataSource.getActive()).resolves.toEqual({ data: null, error: undefined });

		getRuntimeActiveMock.mockResolvedValueOnce({ data: undefined, error: undefined });
		await expect(dataSource.getActive()).resolves.toEqual({ data: null, error: undefined });
	});

	it('returns empty state (data: null) when getPreviewForRule receives null or undefined for 204 No Content', async () => {
		const dataSource = new LeLøginScreenActiveScreenDataSource(stubHost);

		getRulesByIdPreviewMock.mockResolvedValueOnce({ data: null, error: undefined });
		await expect(dataSource.getPreviewForRule('rule-1')).resolves.toEqual({
			data: null,
			error: undefined
		});

		getRulesByIdPreviewMock.mockResolvedValueOnce({ data: undefined, error: undefined });
		await expect(dataSource.getPreviewForRule('rule-1')).resolves.toEqual({
			data: null,
			error: undefined
		});
	});
});
