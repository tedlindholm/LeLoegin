import {
	applyAuthViewCustomisation,
	type LoginAuthViewCustomisation
} from './auth-view-customiser.js';

interface AuthViewObservationState {
	frameHandle: number | undefined;
	isDisposed: boolean;
	isApplying: boolean;
	resizeObserver: ResizeObserver | undefined;
	resizeTarget: Element | undefined;
}

const AUTH_VIEW_OBSERVER_OPTIONS = {
	childList: true,
	subtree: true
} as const;

const beginAuthViewObservation = (observer: MutationObserver, shadowRoot: ShadowRoot) => {
	observer.observe(shadowRoot, AUTH_VIEW_OBSERVER_OPTIONS);
};

const applyObservedCustomisation = (
	observer: MutationObserver,
	shadowRoot: ShadowRoot,
	state: AuthViewObservationState,
	apply: () => void
) => {
	if (state.isDisposed || state.isApplying) {
		return;
	}

	state.isApplying = true;
	observer.disconnect();

	try {
		apply();
	} finally {
		state.isApplying = false;
		if (!state.isDisposed) {
			beginAuthViewObservation(observer, shadowRoot);
		}
	}
};

const scheduleObservedCustomisation = (
	observer: MutationObserver,
	shadowRoot: ShadowRoot,
	state: AuthViewObservationState,
	apply: () => void
) => {
	if (state.isDisposed || state.frameHandle !== undefined) {
		return;
	}

	state.frameHandle = requestAnimationFrame(() => {
		state.frameHandle = undefined;
		applyObservedCustomisation(observer, shadowRoot, state, apply);
	});
};

const disposeObservedCustomisation = (
	observer: MutationObserver,
	state: AuthViewObservationState
) => {
	state.isDisposed = true;
	if (state.frameHandle !== undefined) {
		cancelAnimationFrame(state.frameHandle);
	}

	observer.disconnect();
	state.resizeObserver?.disconnect();
	state.resizeObserver = undefined;
	state.resizeTarget = undefined;
};

/**
 * Tracks `#graphic` size changes so the crop-preview simulation re-runs whenever
 * the panel resizes (window resize, devtools open/close, mobile rotation, sidebar
 * toggles). Re-targets the observer if Umbraco re-renders `#graphic` and produces
 * a new element instance.
 */
const syncResizeObservation = (
	shadowRoot: ShadowRoot,
	state: AuthViewObservationState,
	apply: () => void
) => {
	const graphic = shadowRoot.getElementById('graphic');
	if (!(graphic instanceof Element)) {
		state.resizeObserver?.disconnect();
		state.resizeObserver = undefined;
		state.resizeTarget = undefined;
		return;
	}

	if (state.resizeTarget === graphic && state.resizeObserver !== undefined) {
		return;
	}

	state.resizeObserver?.disconnect();
	state.resizeObserver = new ResizeObserver(() => {
		if (state.isDisposed) return;
		apply();
	});
	state.resizeObserver.observe(graphic);
	state.resizeTarget = graphic;
};

/**
 * Observes and applies auth view customisation reactively.
 * Watches the shadow DOM for structural changes and the `#graphic` panel for
 * size changes, reapplying customisation as needed so the crop-preview maths
 * stay in sync with the actual rendered panel dimensions.
 *
 * @param authView - The auth view host element
 * @param getCustomisation - Callback returning the current customisation state
 * @returns A function to stop observing
 */
export const observeAuthViewCustomisation = (
	authView: HTMLElement,
	getCustomisation: () => LoginAuthViewCustomisation
) => {
	const apply = () => {
		applyAuthViewCustomisation(authView, getCustomisation());
	};

	const shadowRoot = authView.shadowRoot;
	if (shadowRoot === null) {
		apply();
		return () => undefined;
	}

	const state: AuthViewObservationState = {
		frameHandle: undefined,
		isDisposed: false,
		isApplying: false,
		resizeObserver: undefined,
		resizeTarget: undefined
	};

	const applyAndSyncResize = () => {
		apply();
		syncResizeObservation(shadowRoot, state, applyAndSyncResize);
	};

	const observer = new MutationObserver(() => {
		scheduleObservedCustomisation(observer, shadowRoot, state, applyAndSyncResize);
	});

	applyObservedCustomisation(observer, shadowRoot, state, applyAndSyncResize);

	return () => {
		disposeObservedCustomisation(observer, state);
	};
};
