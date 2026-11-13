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
		getAbsolutePath() {
			return '/section/settings/workspace/login-screen-rule';
		}
		getActiveLocalPath() {
			return 'edit/rule-1';
		}
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
vi.mock('@umbraco-cms/backoffice/notification', () => ({ UMB_NOTIFICATION_CONTEXT: {} }));
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
import { willNavigateAwayFromWorkspace } from './unsaved-changes-guard.js';

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
		condition: { operator: 'all', conditions: [] }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('editor workspace contexts loadError state (3.12)', () => {
	it('sets loadError=true when asset load fails and false when asset is not found', async () => {
		const ctx = new LeLøginScreenAssetEditorWorkspaceContext(stubHost);
		assetRequestByUniqueMock.mockResolvedValueOnce({
			data: undefined,
			error: new Error('Network failure')
		});
		await ctx.loadAsset('asset-1');
		expect(readObservable(ctx.loadError)).toBe(true);

		assetRequestByUniqueMock.mockResolvedValueOnce({ data: undefined, error: undefined });
		await ctx.loadAsset('asset-missing');
		expect(readObservable(ctx.loadError)).toBe(false);
	});

	it('sets loadError=true when rule load fails and false when rule is not found', async () => {
		const ctx = new LeLøginScreenRuleEditorWorkspaceContext(stubHost);
		ruleRequestByUniqueMock.mockResolvedValueOnce({
			data: undefined,
			error: new Error('Network failure')
		});
		await ctx.loadRule('rule-1');
		expect(readObservable(ctx.loadError)).toBe(true);

		ruleRequestByUniqueMock.mockResolvedValueOnce({ data: undefined, error: undefined });
		await ctx.loadRule('rule-missing');
		expect(readObservable(ctx.loadError)).toBe(false);
	});
});

describe('editor workspace contexts unsaved-change tracking (3.17)', () => {
	it('tracks isDirty on asset editor context across load, updateDraft and save', async () => {
		const asset = makeAsset('asset-1', 'Original');
		const ctx = new LeLøginScreenAssetEditorWorkspaceContext(stubHost);
		expect(readObservable(ctx.isDirty)).toBe(false);

		assetRequestByUniqueMock.mockResolvedValueOnce({ data: asset, error: undefined });
		await ctx.loadAsset('asset-1');
		expect(readObservable(ctx.isDirty)).toBe(false);

		ctx.updateDraft({ name: 'Edited' });
		expect(readObservable(ctx.isDirty)).toBe(true);

		assetUpdateMock.mockResolvedValueOnce({ data: { ...asset, name: 'Edited' }, error: undefined });
		await ctx.requestSubmit();
		expect(readObservable(ctx.isDirty)).toBe(false);
	});

	it('tracks isDirty on rule editor context and keeps it dirty on applySavedEnabled', async () => {
		const rule = makeRule('rule-1', 'Original', ['asset-1']);
		const ctx = new LeLøginScreenRuleEditorWorkspaceContext(stubHost);
		expect(readObservable(ctx.isDirty)).toBe(false);

		ruleRequestByUniqueMock.mockResolvedValueOnce({ data: rule, error: undefined });
		await ctx.loadRule('rule-1');
		expect(readObservable(ctx.isDirty)).toBe(false);

		ctx.updateDraft({ name: 'Edited' });
		expect(readObservable(ctx.isDirty)).toBe(true);

		ctx.applySavedEnabled('rule-1', false);
		expect(readObservable(ctx.isDirty)).toBe(true);

		ruleUpdateMock.mockResolvedValueOnce({
			data: { ...rule, name: 'Edited', enabled: false },
			error: undefined
		});
		await ctx.requestSubmit();
		expect(readObservable(ctx.isDirty)).toBe(false);
	});
});

describe('willNavigateAwayFromWorkspace (3.17)', () => {
	it('detects navigation leaving the active workspace route', () => {
		const ctx = new LeLøginScreenRuleEditorWorkspaceContext(stubHost);
		expect(
			willNavigateAwayFromWorkspace(
				ctx.routes,
				'/section/settings/workspace/login-screen-rule/edit/rule-1'
			)
		).toBe(false);
		expect(
			willNavigateAwayFromWorkspace(
				ctx.routes,
				'/section/settings/workspace/login-screen-rule-list'
			)
		).toBe(true);
	});
});
