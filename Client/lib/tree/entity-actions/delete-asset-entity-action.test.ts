import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { MetaEntityActionDefaultKind, UmbEntityActionArgs } from '@umbraco-cms/backoffice/entity-action';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestByUniqueMock, requestItemsMock, deleteMock, confirmModalMock, notifyPeekMock } =
	vi.hoisted(() => ({
		requestByUniqueMock: vi.fn(),
		requestItemsMock: vi.fn(),
		deleteMock: vi.fn(),
		confirmModalMock: vi.fn(),
		notifyPeekMock: vi.fn()
	}));

vi.mock('@umbraco-cms/backoffice/entity-action', () => ({
	UmbEntityActionBase: class {
		args: { unique?: string; entityType: string };
		constructor(_host: unknown, args: { unique?: string; entityType: string }) {
			this.args = args;
		}
		getContext() {
			return Promise.resolve({ peek: notifyPeekMock, dispatchEvent: () => {} });
		}
	},
	UmbEntityDeletedEvent: class {}
}));

vi.mock('@umbraco-cms/backoffice/action', () => ({
	UMB_ACTION_EVENT_CONTEXT: {}
}));

vi.mock('@umbraco-cms/backoffice/localization-api', () => ({
	UmbLocalizationController: class {
		term(key: string) {
			return key;
		}
	}
}));

vi.mock('@umbraco-cms/backoffice/modal', () => ({
	umbConfirmModal: confirmModalMock
}));

vi.mock('@umbraco-cms/backoffice/notification', () => ({
	UMB_NOTIFICATION_CONTEXT: {}
}));

vi.mock('@umbraco-cms/backoffice/utils', () => ({
	escapeHTML: (value: string) => value
}));

vi.mock('../../assets/asset.repository.js', () => ({
	LeLøginScreenAssetRepository: class {
		requestByUnique = requestByUniqueMock;
		delete = deleteMock;
	}
}));

vi.mock('../../rules/rule.repository.js', () => ({
	LeLøginScreenRuleRepository: class {
		requestItems = requestItemsMock;
	}
}));

vi.mock('../../utils/request-structure-reload.js', () => ({
	requestStructureReload: vi.fn()
}));

import { LeLøginScreenDeleteAssetEntityAction } from './delete-asset-entity-action.js';

beforeEach(() => {
	vi.clearAllMocks();
});

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

const stubArgs: UmbEntityActionArgs<MetaEntityActionDefaultKind> = {
	unique: 'asset-1',
	entityType: 'login-screen-asset',
	meta: { icon: 'icon-trash', label: 'Delete' }
};

describe('delete asset entity action (3.9 & 3.16)', () => {
	it('aborts without opening confirmation when loading rules fails (3.9)', async () => {
		const action = new LeLøginScreenDeleteAssetEntityAction(stubHost, stubArgs);
		requestByUniqueMock.mockResolvedValueOnce({ data: { id: 'asset-1', name: 'Sky' }, error: undefined });
		requestItemsMock.mockResolvedValueOnce({ data: undefined, error: new Error('HTTP 500') });

		await action.execute();

		expect(confirmModalMock).not.toHaveBeenCalled();
		expect(deleteMock).not.toHaveBeenCalled();
	});

	it('aborts without opening confirmation when loading asset fails (3.9)', async () => {
		const action = new LeLøginScreenDeleteAssetEntityAction(stubHost, stubArgs);
		requestByUniqueMock.mockResolvedValueOnce({ data: undefined, error: new Error('HTTP 403') });
		requestItemsMock.mockResolvedValueOnce({ data: [], error: undefined });

		await action.execute();

		expect(confirmModalMock).not.toHaveBeenCalled();
		expect(deleteMock).not.toHaveBeenCalled();
	});

	it('does not emit a duplicate danger toast when delete fails (3.16)', async () => {
		const action = new LeLøginScreenDeleteAssetEntityAction(stubHost, stubArgs);
		requestByUniqueMock.mockResolvedValueOnce({ data: { id: 'asset-1', name: 'Sky' }, error: undefined });
		requestItemsMock.mockResolvedValueOnce({ data: [], error: undefined });
		confirmModalMock.mockResolvedValueOnce(undefined);
		deleteMock.mockResolvedValueOnce({ data: false, error: new Error('HTTP 500') });

		await action.execute();

		expect(notifyPeekMock).not.toHaveBeenCalledWith('danger', expect.anything());
	});
});
