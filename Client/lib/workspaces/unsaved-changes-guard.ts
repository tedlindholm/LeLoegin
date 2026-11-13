import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { umbConfirmModal } from '@umbraco-cms/backoffice/modal';
import type { UmbWorkspaceRouteManager } from '@umbraco-cms/backoffice/workspace';

interface WillChangeStateDetail {
	url: string;
}

function isWillChangeStateEvent(event: Event): event is CustomEvent<WillChangeStateDetail> {
	if (!('detail' in event)) return false;
	const detail: unknown = event.detail;
	return (
		typeof detail === 'object' &&
		detail !== null &&
		'url' in detail &&
		typeof detail.url === 'string'
	);
}

/**
 * Determines whether a pending navigation leaves the workspace that owns `routeManager`.
 *
 * @param routeManager - The workspace's route manager.
 * @param newUrl - The URL the navigation is heading towards.
 * @returns True when the navigation leaves the current workspace route.
 */
export function willNavigateAwayFromWorkspace(
	routeManager: UmbWorkspaceRouteManager,
	newUrl: string | URL
): boolean {
	const basePath = routeManager.getAbsolutePath();
	if (basePath === undefined) return false;
	const localPath = routeManager.getActiveLocalPath();
	if (localPath === '') return false;
	const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
	const newPath = (newUrl instanceof URL ? newUrl : new URL(newUrl, origin)).pathname;
	const absolutePath = `${basePath}/${localPath}`;
	return !(newPath === absolutePath || newPath.startsWith(`${absolutePath}/`));
}

/**
 * Prompts the user before leaving a dirty workspace via in-app routing (`willchangestate`)
 * or browser tab/window navigation (`beforeunload`).
 */
export class LeLøginScreenUnsavedChangesGuard {
	#host: UmbControllerHost;
	#routes: UmbWorkspaceRouteManager;
	#hasUnsavedChanges: () => boolean;
	#localize: UmbLocalizationController;
	#allowNavigateAway = false;

	/**
	 * Registers navigation guards on `window`. Call {@link dispose} from the workspace context's `destroy`.
	 *
	 * @param host - The workspace context acting as controller host.
	 * @param routes - The workspace's route manager.
	 * @param hasUnsavedChanges - Returns true when the workspace has unpersisted edits.
	 */
	constructor(
		host: UmbControllerHost,
		routes: UmbWorkspaceRouteManager,
		hasUnsavedChanges: () => boolean
	) {
		this.#host = host;
		this.#routes = routes;
		this.#hasUnsavedChanges = hasUnsavedChanges;
		this.#localize = new UmbLocalizationController(host);

		if (typeof window !== 'undefined') {
			window.addEventListener('willchangestate', this.#onWillNavigate);
			window.addEventListener('beforeunload', this.#onBeforeUnload);
		}
	}

	/** Allows the next navigation check to run normally (e.g. after loading a different entity). */
	reset() {
		this.#allowNavigateAway = false;
	}

	/** Removes the `window` event listeners. */
	dispose() {
		if (typeof window !== 'undefined') {
			window.removeEventListener('willchangestate', this.#onWillNavigate);
			window.removeEventListener('beforeunload', this.#onBeforeUnload);
		}
	}

	#onBeforeUnload = (event: BeforeUnloadEvent) => {
		if (!this.#hasUnsavedChanges()) return;
		event.preventDefault();
		event.returnValue = '';
	};

	#onWillNavigate = (event: Event) => {
		if (this.#allowNavigateAway || !isWillChangeStateEvent(event)) return;
		if (!this.#hasUnsavedChanges()) return;
		const newUrl = event.detail.url;
		if (!willNavigateAwayFromWorkspace(this.#routes, newUrl)) return;

		event.preventDefault();
		void this.#confirmAndNavigate(newUrl);
	};

	async #confirmAndNavigate(url: string) {
		try {
			await umbConfirmModal(this.#host, {
				headline: this.#localize.term('prompt_unsavedChanges'),
				content: this.#localize.term('prompt_unsavedChangesWarning'),
				color: 'danger',
				confirmLabel: this.#localize.term('prompt_discardChanges'),
				cancelLabel: this.#localize.term('prompt_stay')
			});
			this.#allowNavigateAway = true;
			window.history.pushState({}, '', url);
		} catch {
			// User chose to stay on the page.
		}
	}
}

