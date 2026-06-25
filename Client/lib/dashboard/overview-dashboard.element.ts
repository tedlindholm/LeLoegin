import '@umbraco-cms/backoffice/auth';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import styles from './overview-dashboard.element.css?inline';
import {
	applyAuthViewCustomisation,
	observeAuthViewCustomisation,
	type LoginAuthViewCustomisation
} from '../auth-view/auth-view-customiser.js';
import { LeLøginScreenActiveScreenRepository } from './active-screen.repository.js';
import type { ActiveLeLøginScreenResponse } from '../models/index.js';
import { cloneTemplate } from '../utils/template.js';
import { LOGIN_SCREEN_RULE_LIST_WORKSPACE_PATH } from '../rules/entity-types.js';

type LeLøginScreenOverviewState = 'loading' | 'loaded' | 'empty' | 'error';

export interface LeLøginScreenPreviewContext {
	readonly id: string;
	readonly name: string;
}

const previewShellTemplate = document.createElement('template');
previewShellTemplate.innerHTML = /* html */ `<div class="preview-shell"><umb-auth-view id="auth-preview"></umb-auth-view></div>`;

function getRequiredById(root: ShadowRoot, id: string): HTMLElement {
	const element = root.getElementById(id);
	if (!(element instanceof HTMLElement)) {
		throw new Error(`Expected HTMLElement with id "${id}".`);
	}
	return element;
}

const optional = <K extends string, V>(
	key: K,
	value: V | undefined
): Record<K, V> | Record<string, never> =>
	value === undefined ? {} : ({ [key]: value } as Record<K, V>);

// Focal point is meaningful at zoom=1 (server omits cc=, client positions via fp%);
// at zoom>1 the server has already cropped around the focal point so the preview
// must position center/center to match runtime.
const cropFocalPoint = (activeImage: ActiveLeLøginScreenResponse | undefined) =>
	activeImage?.zoom !== undefined && activeImage.zoom > 1 ? undefined : activeImage?.focalPoint;

const logoThumbnailUrl = (logoAssetId: string | undefined) =>
	logoAssetId === undefined
		? undefined
		: `/umbraco/le-løgin/api/v1/assets/${encodeURIComponent(logoAssetId)}/thumbnail`;

/**
 * Overview dashboard for the Login Screen section.
 * Shows the current active image preview.
 */
export class LeLøginScreenOverviewDashboard extends UmbElementMixin(HTMLElement) {
	#repository = new LeLøginScreenActiveScreenRepository(this);
	#state: LeLøginScreenOverviewState = 'loading';
	#activeImage: ActiveLeLøginScreenResponse | undefined;
	#authPreview: HTMLElement | undefined;
	#stopObservingAuthPreview: (() => void) | undefined;
	#previewContext: LeLøginScreenPreviewContext | undefined;
	#previewBox: HTMLElement;

	set previewContext(value: LeLøginScreenPreviewContext | undefined) {
		const previous = this.#previewContext;
		this.#previewContext = value;
		// Refetch when the selection changes: clearing → show active screen,
		// picking a rule → show that rule's resolved screen regardless of current context.
		if (previous?.id !== value?.id) {
			void this.#loadActiveState();
		} else {
			this.#render();
		}
	}

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });

		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];

		shadow.innerHTML = /* html */ `<div id="layout"><uui-box id="preview-box"></uui-box></div>`;
		this.#previewBox = getRequiredById(shadow, 'preview-box');
	}

	override connectedCallback() {
		super.connectedCallback();
		this.#render();
		void this.#loadActiveState();
	}

	override disconnectedCallback() {
		this.#disposeAuthPreviewObserver();
		super.disconnectedCallback();
	}

	#render() {
		if (this.#previewContext !== undefined) {
			this.#previewBox.setAttribute('headline', this.#previewContext.name);
		} else {
			this.#previewBox.removeAttribute('headline');
		}
		if (this.#state === 'loading') {
			this.#previewBox.replaceChildren(document.createElement('uui-loader-circle'));
			this.#syncAuthPreview();
			return;
		}

		if (this.#state === 'empty') {
			const wrapper = document.createElement('div');
			wrapper.className = 'empty-state';

			const message = document.createElement('p');
			message.textContent = this.localize.term('loginScreen_noActiveImage');
			wrapper.append(message);

			const action = document.createElement('uui-button');
			action.setAttribute('look', 'primary');
			action.setAttribute('color', 'default');
			action.setAttribute('href', LOGIN_SCREEN_RULE_LIST_WORKSPACE_PATH);
			action.setAttribute('label', this.localize.term('loginScreen_goToRules'));
			wrapper.append(action);

			this.#previewBox.replaceChildren(wrapper);
			this.#syncAuthPreview();
			return;
		}

		if (this.#state === 'error') {
			const message = document.createElement('p');
			message.className = 'empty-state';
			message.textContent = this.localize.term('loginScreen_activeImageLoadFailed');
			this.#previewBox.replaceChildren(message);
			this.#syncAuthPreview();
			return;
		}

		if (this.#activeImage === undefined) {
			this.#previewBox.replaceChildren();
			this.#syncAuthPreview();
			return;
		}

		const previewShell = cloneTemplate(previewShellTemplate, 'preview shell');
		this.#previewBox.replaceChildren(previewShell);
		this.#syncAuthPreview();
	}

	async #loadActiveState() {
		this.#state = 'loading';
		this.#render();

		// Capture the selection at fetch time so a fast-changing picker doesn't render
		// a stale response over a newer one.
		const selectedAtFetch = this.#previewContext;
		const { data, error } =
			selectedAtFetch === undefined
				? await this.#repository.requestActive()
				: await this.#repository.requestPreviewForRule(selectedAtFetch.id);

		// Drop the response if the user has since changed selection.
		if (selectedAtFetch?.id !== this.#previewContext?.id) return;

		if (error) {
			this.#activeImage = undefined;
			this.#state = 'error';
			this.#render();
			return;
		}

		if (data === null) {
			this.#activeImage = undefined;
			this.#state = 'empty';
			this.#render();
			return;
		}

		this.#activeImage = data;
		this.#state = 'loaded';
		this.#render();
	}

	#syncAuthPreview() {
		const authPreview = this.shadowRoot?.querySelector('#auth-preview');

		if (
			!(authPreview instanceof HTMLElement) ||
			this.#activeImage === undefined ||
			this.#state !== 'loaded'
		) {
			this.#disposeAuthPreviewObserver();
			this.#authPreview = undefined;
			return;
		}

		if (authPreview !== this.#authPreview) {
			this.#disposeAuthPreviewObserver();
			this.#authPreview = authPreview;
			this.#stopObservingAuthPreview = observeAuthViewCustomisation(authPreview, () =>
				this.#authPreviewCustomisation()
			);
			return;
		}

		applyAuthViewCustomisation(authPreview, this.#authPreviewCustomisation());
	}

	#authPreviewCustomisation(): LoginAuthViewCustomisation {
		const activeImage = this.#activeImage;
		// Explicitly pass the asset's logo through so the preview shows the *previewed*
		// logo, not whichever logo Umbraco's `/login-logo` endpoint resolves for the
		// current backoffice request — the middleware decides based on runtime context,
		// which can disagree with the rule the user is previewing here.
		return {
			...optional('imageUrl', activeImage?.imageUrl),
			...optional('greetingText', activeImage?.greetingText),
			...optional('focalPoint', cropFocalPoint(activeImage)),
			...optional('logoUrl', logoThumbnailUrl(activeImage?.logoAssetId)),
			mode: 'preview',
			previewHeight: '100%'
		};
	}

	#disposeAuthPreviewObserver() {
		this.#stopObservingAuthPreview?.();
		this.#stopObservingAuthPreview = undefined;
	}
}

customElements.define('login-screen-overview-dashboard', LeLøginScreenOverviewDashboard);

export default LeLøginScreenOverviewDashboard;
