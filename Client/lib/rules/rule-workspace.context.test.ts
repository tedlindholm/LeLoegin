import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginRule } from '../models/index.js';

const { requestItemsMock, requestByUniqueMock, updateMock, deleteMock, notifyPeekMock, FakeState } =
	vi.hoisted(() => {
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
		}

		return {
			requestItemsMock: vi.fn(),
			requestByUniqueMock: vi.fn(),
			updateMock: vi.fn(),
			deleteMock: vi.fn(),
			notifyPeekMock: vi.fn(),
			FakeState
		};
	});

vi.mock('@umbraco-cms/backoffice/class-api', () => ({
	UmbContextBase: class {
		getContext() {
			return Promise.resolve({ peek: notifyPeekMock });
		}
	}
}));

vi.mock('@umbraco-cms/backoffice/context-api', () => ({
	UmbContextToken: class {}
}));

vi.mock('@umbraco-cms/backoffice/observable-api', () => ({
	UmbArrayState: FakeState,
	UmbBooleanState: FakeState
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

vi.mock('./rule.repository.js', () => ({
	LeLøginScreenRuleRepository: class {
		requestItems = requestItemsMock;
		requestByUnique = requestByUniqueMock;
		update = updateMock;
		delete = deleteMock;
	}
}));

vi.mock('../utils/request-structure-reload.js', () => ({
	requestStructureReload: vi.fn()
}));

import { LeLøginScreenRuleWorkspaceContext } from './rule-workspace.context.js';

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

function makeRule(id: string, name: string, priority: number, enabled = true): LoginRule {
	return {
		id,
		name,
		priority,
		enabled,
		assetIds: ['asset-1'],
		condition: { operator: 'all', conditions: [] }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('rule workspace context concurrency and notifications (3.6 & 3.16)', () => {
	it('fetches latest rule before setEnabled so concurrent edits are not reverted (3.6)', async () => {
		const ctx = new LeLøginScreenRuleWorkspaceContext(stubHost);
		const cached = makeRule('rule-1', 'Old Name', 100, true);
		const latest = { ...cached, name: 'Renamed By Another Editor', assetIds: ['asset-2'] };

		requestItemsMock.mockResolvedValueOnce({ data: [cached], error: undefined });
		await ctx.load();

		requestByUniqueMock.mockResolvedValueOnce({ data: latest, error: undefined });
		updateMock.mockResolvedValueOnce({ data: { ...latest, enabled: false }, error: undefined });

		await ctx.setEnabled('rule-1', false);

		expect(requestByUniqueMock).toHaveBeenCalledWith('rule-1');
		expect(updateMock).toHaveBeenCalledWith('rule-1', { ...latest, enabled: false });
	});

	it('fetches latest rules before reorder PUTs so concurrent edits are not reverted (3.6)', async () => {
		const ctx = new LeLøginScreenRuleWorkspaceContext(stubHost);
		const r1 = makeRule('rule-1', 'First', 100);
		const r2 = makeRule('rule-2', 'Second', 200);
		const latestR2 = { ...r2, name: 'Updated Second' };

		requestItemsMock.mockResolvedValueOnce({ data: [r1, r2], error: undefined });
		await ctx.load();

		requestByUniqueMock
			.mockResolvedValueOnce({ data: latestR2, error: undefined })
			.mockResolvedValueOnce({ data: r1, error: undefined });
		updateMock.mockResolvedValue({ data: r1, error: undefined });

		await ctx.reorder(['rule-2', 'rule-1']);

		expect(updateMock).toHaveBeenCalledWith('rule-2', { ...latestR2, priority: 100 });
		expect(updateMock).toHaveBeenCalledWith('rule-1', { ...r1, priority: 200 });
	});

	it('does not emit a duplicate danger toast when repository delete fails (3.16)', async () => {
		const ctx = new LeLøginScreenRuleWorkspaceContext(stubHost);
		deleteMock.mockResolvedValueOnce({ data: false, error: new Error('HTTP 500') });

		await ctx.delete('rule-1');

		expect(notifyPeekMock).not.toHaveBeenCalledWith('danger', expect.anything());
	});
});

