import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { umbConfirmModalMock } = vi.hoisted(() => ({
	umbConfirmModalMock: vi.fn()
}));

vi.mock('@umbraco-cms/backoffice/localization-api', () => ({
	UmbLocalizationController: class {
		term(key: string) {
			return key;
		}
	}
}));

vi.mock('@umbraco-cms/backoffice/modal', () => ({
	umbConfirmModal: umbConfirmModalMock
}));

import { LeLøginScreenUnsavedChangesGuard } from './unsaved-changes-guard.js';

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

function createFakeWindow() {
	const listeners = new Map<string, Set<(event: Event) => void>>();
	const pushState = vi.fn();
	return {
		location: { origin: 'https://example.test' },
		history: { pushState },
		addEventListener(type: string, listener: (event: Event) => void) {
			const set = listeners.get(type) ?? new Set();
			set.add(listener);
			listeners.set(type, set);
		},
		removeEventListener(type: string, listener: (event: Event) => void) {
			listeners.get(type)?.delete(listener);
		},
		dispatch(type: string, event: Event) {
			for (const listener of listeners.get(type) ?? []) {
				listener(event);
			}
		},
		listenerCount(type: string) {
			return listeners.get(type)?.size ?? 0;
		}
	};
}

function createFakeRoutes() {
	return {
		getAbsolutePath: () => '/section/settings/workspace/login-screen-rule',
		getActiveLocalPath: () => 'edit/rule-1'
	};
}

describe('LeLøginScreenUnsavedChangesGuard', () => {
	let fakeWindow: ReturnType<typeof createFakeWindow>;

	beforeEach(() => {
		vi.clearAllMocks();
		fakeWindow = createFakeWindow();
		vi.stubGlobal('window', fakeWindow);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('allows navigation without prompting when there are no unsaved changes', () => {
		const guard = new LeLøginScreenUnsavedChangesGuard(stubHost, createFakeRoutes(), () => false);
		const navEvent = new CustomEvent('willchangestate', {
			cancelable: true,
			detail: { url: '/section/settings/workspace/login-screen-rule-list' }
		});
		fakeWindow.dispatch('willchangestate', navEvent);

		expect(navEvent.defaultPrevented).toBe(false);
		expect(umbConfirmModalMock).not.toHaveBeenCalled();
		guard.dispose();
	});

	it('prompts on willchangestate when dirty and pushes history state only when confirmed', async () => {
		umbConfirmModalMock.mockResolvedValueOnce(undefined);
		const guard = new LeLøginScreenUnsavedChangesGuard(stubHost, createFakeRoutes(), () => true);
		const targetUrl = '/section/settings/workspace/login-screen-rule-list';
		const navEvent = new CustomEvent('willchangestate', {
			cancelable: true,
			detail: { url: targetUrl }
		});

		fakeWindow.dispatch('willchangestate', navEvent);
		expect(navEvent.defaultPrevented).toBe(true);
		expect(umbConfirmModalMock).toHaveBeenCalledTimes(1);

		await Promise.resolve();
		await Promise.resolve();
		expect(fakeWindow.history.pushState).toHaveBeenCalledWith({}, '', targetUrl);

		guard.dispose();
		expect(fakeWindow.listenerCount('willchangestate')).toBe(0);
		expect(fakeWindow.listenerCount('beforeunload')).toBe(0);
	});
});
