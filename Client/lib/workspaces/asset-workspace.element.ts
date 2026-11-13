import '@umbraco-cms/backoffice/auth';
import '@umbraco-cms/backoffice/workspace';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { umbOpenModal } from '@umbraco-cms/backoffice/modal';
import styles from './asset-workspace.element.css?inline';
import {
	isHtmlElement,
	isValueElement,
	normaliseOptionalInputValue,
	buildWorkspaceBody
} from './asset-workspace.helpers.js';
import { ZOOM_MIN, ZOOM_MAX } from './asset-zoom-controls.js';
import {
	applyAuthViewCustomisation,
	observeAuthViewCustomisation
} from '../auth-view/auth-view-customiser.js';
import {
	isBackgroundLoginImageAsset,
	isLogoLoginImageAsset,
	type FocalPoint,
	type LoginImageAsset
} from '../models/index.ts';
import { LeLøginAssetThumbnailController } from '../assets/asset-thumbnail.controller.js';
import {
	UMB_LOGIN_SCREEN_ASSET_EDITOR_WORKSPACE_CONTEXT,
	type LeLøginScreenAssetEditorWorkspaceContext
} from './asset-editor-workspace.context.js';
import { LOGO_PICKER_MODAL_TOKEN } from './logo-picker-modal.token.js';
import { LeLøginBackgroundDragController } from './background-drag.controller.js';
import {
	buildAssetPreviewCustomisation,
	measureGreetingPosition,
	observeAuthPreviewLayout
} from './asset-preview.helpers.js';

import { getEventTargetElement, getRequiredById } from './rule-list-workspace.helpers.js';

const ZOOM_STEP = 1.1;

/**
 * Asset edit workspace. A logo shows as a plain image; a background shows in a login-style
 * preview where the user drags to set the focal point, zooms, edits the greeting and picks a
 * logo. Changes go to the asset editor workspace context's draft.
 */
export class LeLøginScreenAssetWorkspace extends UmbElementMixin(HTMLElement) {
	#workspaceContext: LeLøginScreenAssetEditorWorkspaceContext | undefined;
	#asset: LoginImageAsset | null = null;
	#assets: Array<LoginImageAsset> = [];
	#assetId: string | undefined;
	#isLoading = true;
	#loadError = false;
	#authPreview: HTMLElement | undefined;
	#stopObservingAuthPreview: (() => void) | undefined;
	#authPreviewMutationCleanup: (() => void) | undefined;
	#draftGreetingTextValue: string | undefined;
	#draftLogoAssetId: string | undefined;
	#draftFocalPoint: FocalPoint | undefined;
	#draftZoom = 1;
	#layout: HTMLElement;
	#backgroundDrag: LeLøginBackgroundDragController | undefined;
	// Re-render when a thumbnail arrives: the preview image and the login-preview background both use it.
	#thumbnails = new LeLøginAssetThumbnailController(this, () => this.#render());

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];
		shadow.innerHTML = /* html */ `
			<umb-entity-detail-workspace-editor>
				<umb-workspace-header-name-editable slot="header"></umb-workspace-header-name-editable>
				<div id="layout"></div>
			</umb-entity-detail-workspace-editor>
		`;
		this.#layout = getRequiredById(shadow, 'layout', isHtmlElement, 'layout');

		this.#layout.addEventListener('click', this.#onLayoutClick);
		this.#layout.addEventListener('input', this.#onLayoutInput);
		this.consumeContext(UMB_LOGIN_SCREEN_ASSET_EDITOR_WORKSPACE_CONTEXT, (ctx) => {
			if (ctx !== undefined) this.#setupWorkspaceObservers(ctx);
		});
	}

	#onLayoutClick = (e: Event) => {
		const button = getEventTargetElement(e)?.closest(
			'#asset-logo-picker-button, #asset-zoom-in, #asset-zoom-out'
		);
		switch (button?.id) {
			case 'asset-logo-picker-button':
				void this.#openLogoPicker();
				break;
			case 'asset-zoom-in':
				this.#applyZoomDelta(ZOOM_STEP);
				break;
			case 'asset-zoom-out':
				this.#applyZoomDelta(1 / ZOOM_STEP);
				break;
		}
	};

	#onLayoutInput = (e: Event) => {
		const target = getEventTargetElement(e);
		if (target?.closest('#asset-greeting-inline') === null || !isValueElement(target)) return;
		const value = target.value;
		this.#draftGreetingTextValue = value;
		this.#workspaceContext?.updateDraft({ greetingText: normaliseOptionalInputValue(value) });
		this.#syncAuthPreview();
	};

	#setupWorkspaceObservers(ctx: LeLøginScreenAssetEditorWorkspaceContext) {
		this.#workspaceContext = ctx;
		this.observe(ctx.currentAsset, (asset) => {
			const isDifferentAsset = asset === null || asset.id !== this.#asset?.id;
			this.#asset = asset ?? null;
			if (isDifferentAsset) {
				this.#applyAssetDraft(this.#asset);
			}
			this.#render();
		});
		this.observe(ctx.assets, (assets) => {
			this.#assets = assets;
			this.#render();
		});
		this.observe(ctx.isLoading, (isLoading) => {
			this.#isLoading = isLoading;
			this.#render();
		});
		this.observe(ctx.loadError, (loadError) => {
			this.#loadError = loadError;
			this.#render();
		});
		this.observe(ctx.unique, (assetId) => {
			this.#assetId = assetId ?? undefined;
			this.#render();
		});
	}

	/** Renders the workspace when the element is attached. */
	override connectedCallback() {
		super.connectedCallback();
		this.#render();
	}

	/** Stops watching the preview layout and detaches the background drag controller. */
	override disconnectedCallback() {
		this.#disposeAuthPreviewObserver();
		this.#detachBackgroundDrag();
		super.disconnectedCallback();
	}

	#render() {
		const previewUrl =
			this.#asset?.id !== undefined ? this.#thumbnails.peek(this.#asset.id) : undefined;
		this.#layout.replaceChildren(
			...buildWorkspaceBody({
				localize: this.localize,
				isLoading: this.#isLoading,
				loadError: this.#loadError,
				asset: this.#asset,
				previewUrl,
				logoAssets: this.#logoAssets(),
				greetingText: this.#draftGreetingTextValue ?? '',
				selectedLogoAssetId: this.#selectedLogoAssetId(),
				zoom: this.#draftZoom
			})
		);
		this.#syncAuthPreview();
	}

	#applyZoomDelta(factor: number) {
		const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.#draftZoom * factor));
		if (newZoom === this.#draftZoom) return;
		this.#draftZoom = newZoom;
		this.#workspaceContext?.updateDraft({ zoom: newZoom });
		this.#syncAuthPreview();
		this.#updateZoomButtonStates();
	}

	#updateZoomButtonStates() {
		const root = this.shadowRoot;
		root?.querySelector('#asset-zoom-in')?.toggleAttribute('disabled', this.#draftZoom >= ZOOM_MAX);
		root
			?.querySelector('#asset-zoom-out')
			?.toggleAttribute('disabled', this.#draftZoom <= ZOOM_MIN);
	}

	async #openLogoPicker() {
		const result = await umbOpenModal(this, LOGO_PICKER_MODAL_TOKEN, {
			data: {
				logoAssets: this.#logoAssets(),
				selectedLogoAssetId: this.#selectedLogoAssetId()
			}
		}).catch(() => undefined);

		if (result !== undefined) {
			this.#draftLogoAssetId = result.logoAssetId;
			// Preserve an explicit empty selection so the API receives a clear request
			// instead of silently keeping the previously assigned logo.
			this.#workspaceContext?.updateDraft({ logoAssetId: result.logoAssetId });
			this.#render();
		}
	}

	#syncAuthPreview() {
		const authPreview = this.shadowRoot?.querySelector('#auth-preview');
		if (
			!(authPreview instanceof HTMLElement) ||
			this.#asset === null ||
			this.#assetId === undefined
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
			this.#authPreviewMutationCleanup = observeAuthPreviewLayout(authPreview, () => {
				this.#positionGreetingOverlay();
				this.#syncBackgroundDragTarget();
			});
		} else {
			applyAuthViewCustomisation(authPreview, this.#authPreviewCustomisation());
		}
		requestAnimationFrame(() => {
			this.#positionGreetingOverlay();
			this.#syncBackgroundDragTarget();
		});
	}

	#syncBackgroundDragTarget() {
		if (!this.#isBackgroundAssetLoaded()) {
			this.#detachBackgroundDrag();
			return;
		}
		// Attach to our own .preview-shell rather than the auth-view's internal #graphic:
		// the auth-view host is display:inline so pointer events never actually reach
		// inside its shadow tree. The shell is what catches hover at the visible image area.
		const shell = this.shadowRoot?.querySelector<HTMLElement>('.preview-shell');
		if (shell === null || shell === undefined) {
			this.#detachBackgroundDrag();
			return;
		}
		if (shell === this.#backgroundDrag?.shell) return;
		this.#detachBackgroundDrag();
		this.#backgroundDrag = new LeLøginBackgroundDragController(shell, {
			imageSize: () => ({ width: this.#asset?.width ?? 0, height: this.#asset?.height ?? 0 }),
			measureContainer: () => this.#measurePreviewFrame(shell),
			focalPoint: () => this.#draftFocalPoint,
			zoom: () => this.#draftZoom,
			onFocalPointChange: (focalPoint) => this.#applyDraggedFocalPoint(focalPoint),
			onZoom: (zoomIn) => this.#applyZoomDelta(zoomIn ? ZOOM_STEP : 1 / ZOOM_STEP)
		});
	}

	#measurePreviewFrame(shell: HTMLElement) {
		// Prefer the auth-view's #graphic rect (matches the visible image frame),
		// fall back to the shell itself if the auth-view hasn't laid out yet.
		const graphic = this.#authPreview?.shadowRoot?.getElementById('graphic');
		const rect = (graphic instanceof HTMLElement ? graphic : shell).getBoundingClientRect();
		return { width: rect.width, height: rect.height };
	}

	#detachBackgroundDrag() {
		this.#backgroundDrag?.dispose();
		this.#backgroundDrag = undefined;
	}

	#applyDraggedFocalPoint(focalPoint: FocalPoint) {
		this.#draftFocalPoint = focalPoint;
		this.#workspaceContext?.updateDraft({ focalPoint });
		if (this.#authPreview !== undefined) {
			applyAuthViewCustomisation(this.#authPreview, this.#authPreviewCustomisation());
		}
	}

	#positionGreetingOverlay() {
		if (!this.#isBackgroundAssetLoaded() || this.#authPreview === undefined) return;
		const pos = measureGreetingPosition(this.#authPreview);
		if (pos === null) return;
		const field = this.shadowRoot?.querySelector<HTMLElement>('.preview-greeting-field');
		if (!field) return;
		field.style.setProperty('--greeting-left', `${pos.leftPct.toFixed(1)}%`);
		field.style.setProperty('--greeting-top', `${pos.topPct.toFixed(1)}%`);
	}

	#isBackgroundAssetLoaded(): boolean {
		return this.#asset !== null && isBackgroundLoginImageAsset(this.#asset);
	}

	#authPreviewCustomisation() {
		const logoId = this.#selectedLogoAssetId();
		return buildAssetPreviewCustomisation(
			this.#isBackgroundAssetLoaded() && this.#assetId !== undefined
				? {
						imageUrl: this.#thumbnails.peek(this.#assetId),
						greetingText: normaliseOptionalInputValue(this.#draftGreetingTextValue ?? ''),
						logoUrl: logoId.length === 0 ? undefined : this.#thumbnails.peek(logoId),
						focalPoint: this.#draftFocalPoint,
						zoom: this.#draftZoom,
						imageWidth: this.#asset?.width,
						imageHeight: this.#asset?.height
					}
				: undefined,
			this.localize.term('loginScreen_previewOnly')
		);
	}

	#disposeAuthPreviewObserver() {
		this.#stopObservingAuthPreview?.();
		this.#stopObservingAuthPreview = undefined;
		this.#authPreviewMutationCleanup?.();
		this.#authPreviewMutationCleanup = undefined;
	}

	#applyAssetDraft(asset: LoginImageAsset | null) {
		const bg = asset !== null && isBackgroundLoginImageAsset(asset) ? asset : null;
		this.#draftGreetingTextValue = bg !== null ? (bg.greetingText ?? '') : undefined;
		this.#draftLogoAssetId = bg !== null ? (bg.logoAssetId ?? '') : undefined;
		this.#draftFocalPoint = bg?.focalPoint;
		this.#draftZoom = bg?.zoom ?? 1;
	}

	#logoAssets() {
		return this.#assets.filter(isLogoLoginImageAsset);
	}

	#selectedLogoAssetId() {
		if (this.#asset === null || !isBackgroundLoginImageAsset(this.#asset)) return '';
		return this.#draftLogoAssetId ?? '';
	}
}

customElements.define('login-screen-asset-workspace', LeLøginScreenAssetWorkspace);
export default LeLøginScreenAssetWorkspace;
