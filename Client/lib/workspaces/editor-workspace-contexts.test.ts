import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginImageAsset, LoginRule } from '../models/index.js';

const {
	assetRequestByUniqueMock,
	assetRequestItemsMock,
	assetUpdateMock,
	ruleRequestByUniqueMock,
	ruleCreateMock,
	ruleUpdateMock,
	conditionMetadataMock,
	requestChildrenReloadMock,
	requestStructureReloadMock,
	FakeState
} = vi.hoisted(() => {
	class FakeState<T> {
		#value: T;
		constructor(initial: T) {
			this.#value = initial;
		}
		getValue(): T {
			return this.#value;
		}
		setValue(next: T) {
			this.#value = next;
		}
		asObservable() {
			return {
				getValue: () => this.#value,
				subscribe: (observer: (value: T) => void) => {
					observer(this.#value);
					return { unsubscribe: () => {} };
				}
			};
		}
		asObservablePart<U>(selector: (value: T) => U) {
			return {
				getValue: () => selector(this.#value)
			};
		}
	}

	return {
		assetRequestByUniqueMock: vi.fn(),
		assetRequestItemsMock: vi.fn(),
		assetUpdateMock: vi.fn(),
		ruleRequestByUniqueMock: vi.fn(),
		ruleCreateMock: vi.fn(),
		ruleUpdateMock: vi.fn(),
		conditionMetadataMock: vi.fn(),
		requestChildrenReloadMock: vi.fn(),
		requestStructureReloadMock: vi.fn(),
		FakeState
	};
});

vi.mock('@umbraco-cms/backoffice/class-api', () => ({
	UmbContextBase: class {
		getContext() {
			return Promise.resolve(undefined);
		}
		observe() {}
	}
}));

vi.mock('@umbraco-cms/backoffice/context-api', () => ({
	UmbContextToken: class {}
}));

vi.mock('@umbraco-cms/backoffice/observable-api', () => ({
	UmbArrayState: FakeState,
	UmbBooleanState: FakeState,
	UmbObjectState: FakeState,
	UmbStringState: FakeState
}));

vi.mock('@umbraco-cms/backoffice/workspace', () => ({
	UmbWorkspaceRouteManager: class {
		setRoutes() {}
	}
}));

vi.mock('@umbraco-cms/backoffice/entity', () => ({
	UmbEntityContext: class {
		setEntityType() {}
		setUnique() {}
	}
}));

vi.mock('@umbraco-cms/backoffice/utils', () => ({
	UmbStateManager: class {
		getStates() {
			return [];
		}
		addState() {}
		removeState() {}
	}
}));

vi.mock('@umbraco-cms/backoffice/localization-api', () => ({
	UmbLocalizationController: class {
		term(key: string) {
			return key;
		}
	}
}));

vi.mock('@umbraco-cms/backoffice/notification', () => ({
	UMB_NOTIFICATION_CONTEXT: {}
}));

vi.mock('@umbraco-cms/backoffice/modal', () => ({
	umbConfirmModal: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../assets/asset.repository.js', () => ({
	LeLøginScreenAssetRepository: class {
		requestByUnique = assetRequestByUniqueMock;
		requestItems = assetRequestItemsMock;
		update = assetUpdateMock;
	}
}));

vi.mock('../rules/rule.repository.js', () => ({
	LeLøginScreenRuleRepository: class {
		requestByUnique = ruleRequestByUniqueMock;
		create = ruleCreateMock;
		update = ruleUpdateMock;
	}
}));

vi.mock('../rules/condition-metadata.data-source.js', () => ({
	LeLøginScreenConditionMetadataDataSource: class {
		getConditionMetadata = conditionMetadataMock;
	}
}));

vi.mock('../utils/request-structure-reload.js', () => ({
	requestChildrenReload: requestChildrenReloadMock,
	requestStructureReload: requestStructureReloadMock
}));

import { LeLøginScreenAssetEditorWorkspaceContext } from './asset-editor-workspace.context.js';
import { LeLøginScreenRuleEditorWorkspaceContext } from './rule-editor-workspace.context.js';

const stubHost: UmbControllerHost = {
	getHostElement: () => {
		throw new Error('Not expected in unit test');
	},
	addUmbController: () => {},
	removeUmbController: () => {},
	removeUmbControllerByAlias: () => {},
	hasUmbController: () => false,
	getUmbControllers: () => []
};

function readObservable<T>(observable: {
	subscribe: (observer: (value: T) => void) => { unsubscribe: () => void };
}): T | undefined {
	let current: T | undefined;
	const sub = observable.subscribe((value) => {
		current = value;
	});
	sub.unsubscribe();
	return current;
}

function makeAsset(id: string, name: string): LoginImageAsset {
	return {
		id,
		name,
		kind: 'background',
		storagePath: `assets/${id}.jpg`,
		width: 800,
		height: 600,
		altText: `${name} alt`,
		greetingText: `${name} greeting`,
		focalPoint: { left: 0.5, top: 0.5 },
		zoom: 1,
		createdAt: '2026-11-13T00:00:00Z',
		updatedAt: '2026-11-13T00:00:00Z'
	};
}

function makeRule(id: string, name: string, assetIds: Array<string>): LoginRule {
	return {
		id,
		name,
		priority: 1,
		enabled: true,
		assetIds,
		condition: {
			operator: 'all',
			conditions: []
		}
	};
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('asset editor workspace context (3.2)', () => {
	it('ignores a stale asset save response after another asset has been opened', async () => {
		const assetA = makeAsset('asset-a', 'Asset A');
		const assetB = makeAsset('asset-b', 'Asset B');
		const ctx = new LeLøginScreenAssetEditorWorkspaceContext(stubHost);

		assetRequestByUniqueMock.mockResolvedValueOnce({ data: assetA, error: undefined });
		await ctx.loadAsset('asset-a');
		ctx.updateDraft({ name: 'Asset A edited' });

		const pendingSave = deferred<{ data: LoginImageAsset; error: undefined }>();
		assetUpdateMock.mockReturnValueOnce(pendingSave.promise);

		const submitPromise = ctx.requestSubmit();

		assetRequestByUniqueMock.mockResolvedValueOnce({ data: assetB, error: undefined });
		await ctx.loadAsset('asset-b');

		pendingSave.resolve({
			data: { ...assetA, name: 'Asset A saved' },
			error: undefined
		});
		await submitPromise;

		expect(ctx.getUnique()).toBe('asset-b');
		expect(ctx.getName()).toBe('Asset B');
		expect(readObservable(ctx.currentAsset)?.id).toBe('asset-b');
		expect(readObservable(ctx.currentAsset)?.name).toBe('Asset B');
	});
});

describe('rule editor workspace context (3.2 & 3.5)', () => {
	it('ignores a stale rule save response after another rule has been opened', async () => {
		const ruleA = makeRule('rule-a', 'Rule A', ['asset-1']);
		const ruleB = makeRule('rule-b', 'Rule B', ['asset-2']);
		const ctx = new LeLøginScreenRuleEditorWorkspaceContext(stubHost);

		ruleRequestByUniqueMock.mockResolvedValueOnce({ data: ruleA, error: undefined });
		await ctx.loadRule('rule-a');
		ctx.updateDraft({ name: 'Rule A edited' });

		const pendingSave = deferred<{ data: LoginRule; error: undefined }>();
		ruleUpdateMock.mockReturnValueOnce(pendingSave.promise);

		const submitPromise = ctx.requestSubmit();

		ruleRequestByUniqueMock.mockResolvedValueOnce({ data: ruleB, error: undefined });
		await ctx.loadRule('rule-b');

		pendingSave.resolve({
			data: { ...ruleA, name: 'Rule A saved' },
			error: undefined
		});
		await submitPromise;

		expect(ctx.getUnique()).toBe('rule-b');
		expect(ctx.getName()).toBe('Rule B');
		expect(ctx.getDraft()?.id).toBe('rule-b');
		expect(ctx.getDraft()?.name).toBe('Rule B');
	});
});

describe('rule editor workspace context enable/disable (3.5)', () => {
	it('preserves unsaved edits in the emitted rule draft when applySavedEnabled runs', async () => {
		const rule = makeRule('rule-1', 'Rule 1', ['asset-1']);
		const ctx = new LeLøginScreenRuleEditorWorkspaceContext(stubHost);

		ruleRequestByUniqueMock.mockResolvedValueOnce({ data: rule, error: undefined });
		await ctx.loadRule('rule-1');

		ctx.updateDraft({ assetIds: ['asset-1', 'asset-2'], name: 'Unsaved rename' });
		ctx.applySavedEnabled('rule-1', false);

		expect(readObservable(ctx.currentRule)).toMatchObject({
			id: 'rule-1',
			name: 'Unsaved rename',
			assetIds: ['asset-1', 'asset-2'],
			enabled: false
		});
		expect(ctx.getDraft()).toMatchObject({
			id: 'rule-1',
			name: 'Unsaved rename',
			assetIds: ['asset-1', 'asset-2'],
			enabled: false
		});
	});
});

describe('editor workspace contexts trim names on save (3.15)', () => {
	it('trims asset name before submitting update', async () => {
		const asset = makeAsset('asset-1', 'Original');
		const ctx = new LeLøginScreenAssetEditorWorkspaceContext(stubHost);
		assetRequestByUniqueMock.mockResolvedValueOnce({ data: asset, error: undefined });
		await ctx.loadAsset('asset-1');
		ctx.updateDraft({ name: '  Trimmed Asset  ' });
		assetUpdateMock.mockResolvedValueOnce({
			data: { ...asset, name: 'Trimmed Asset' },
			error: undefined
		});

		await ctx.requestSubmit();

		expect(assetUpdateMock).toHaveBeenCalledWith(
			'asset-1',
			expect.objectContaining({ name: 'Trimmed Asset' })
		);
	});

	it('trims rule name before submitting update', async () => {
		const rule = makeRule('rule-1', 'Original', ['asset-1']);
		const ctx = new LeLøginScreenRuleEditorWorkspaceContext(stubHost);
		ruleRequestByUniqueMock.mockResolvedValueOnce({ data: rule, error: undefined });
		await ctx.loadRule('rule-1');
		ctx.updateDraft({ name: '  Trimmed Rule  ' });
		ruleUpdateMock.mockResolvedValueOnce({
			data: { ...rule, name: 'Trimmed Rule' },
			error: undefined
		});

		await ctx.requestSubmit();

		expect(ruleUpdateMock).toHaveBeenCalledWith(
			'rule-1',
			expect.objectContaining({ name: 'Trimmed Rule' })
		);
	});
});
