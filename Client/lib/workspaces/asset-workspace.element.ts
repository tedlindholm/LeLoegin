import '@umbraco-cms/backoffice/auth';
import '@umbraco-cms/backoffice/workspace';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { umbOpenModal } from '@umbraco-cms/backoffice/modal';
import styles from './asset-workspace.element.css?inline';
import {
	normaliseOptionalInputValue,
	buildWorkspaceBody,
	measureLogoPosition,
	measureGreetingPosition,
	computeFocalPointFromDrag,
	ZOOM_MIN,
	ZOOM_MAX,
} from './asset-workspace.helpers.js';

const ZOOM_STEP = 1.1;
import {
	applyAuthViewCustomisation,
	observeAuthViewCustomisation
} from '../auth-view/auth-view-customiser.js';
import type { FocalPoint, LoginImageAsset } from '../models/index.ts';
import { isBackgroundLoginImageAsset, isLogoLoginImageAsset } from '../models/index.ts';
import {
	UMB_LOGIN_SCREEN_ASSET_EDITOR_WORKSPACE_CONTEXT,
	type LeLøginScreenAssetEditorWorkspaceContext
} from './asset-editor-workspace.context.js';
import { LOGO_PICKER_MODAL_TOKEN } from './logo-picker-modal.token.js';

interface ValueElement extends HTMLElement {
	value: string;
}

const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;
const isValueElement = (value: Element | null): value is ValueElement =>
	value instanceof HTMLElement && value.localName === 'uui-input';

// Spreadable optional field — collapses the noisy `...(x === undefined ? {} : { foo: x })`
// pattern at the call site so the customisation object reads like a flat record.
const optional = <K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> =>
	value === undefined ? {} : ({ [key]: value } as Record<K, V>);

function getRequiredById(root: ShadowRoot, id: string): HTMLElement {
	const element = root.getElementById(id);
	if (!isHtmlElement(element)) {
		throw new Error(`Expected HTMLElement with id "${id}".`);
	}
	return element;
}

function getEventTargetElement(event: Event): Element | null {
	return event.target instanceof Element ? event.target : null;
}

export class LeLøginScreenAssetWorkspace extends UmbElementMixin(HTMLElement) {
	#workspaceContext: LeLøginScreenAssetEditorWorkspaceContext | undefined;
	#asset: LoginImageAsset | null = null;
	#assets: Array<LoginImageAsset> = [];
	#assetId: string | undefined;
	#isLoading = true;
	#authPreview: HTMLElement | undefined;
	#stopObservingAuthPreview: (() => void) | undefined;
	#authPreviewMutationCleanup: (() => void) | undefined;
	#draftGreetingTextValue: string | undefined;
	#draftLogoAssetId: string | undefined;
	#draftFocalPoint: FocalPoint | undefined;
	#draftZoom = 1;
	#layout: HTMLElement;
	#authPreviewGraphic: HTMLElement | undefined;
	#backgroundDragCleanup: (() => void) | undefined;

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
		this.#layout = getRequiredById(shadow, 'layout');

		this.#layout.addEventListener('click', (e) => {
			const target = getEventTargetElement(e);
			if (target === null) {
				return;
			}
			if (target.closest('#asset-logo-picker-button') !== null) {
				void this.#openLogoPicker();
				return;
			}
			if (target.closest('#asset-zoom-in') !== null) {
				this.#applyZoomDelta(ZOOM_STEP);
				return;
			}
			if (target.closest('#asset-zoom-out') !== null) {
				this.#applyZoomDelta(1 / ZOOM_STEP);
				return;
			}
		});
		this.#layout.addEventListener('input', (e) => {
			const target = getEventTargetElement(e);
			if (target?.closest('#asset-greeting-inline') === null || !isValueElement(target)) return;
			const value = target.value;
			this.#draftGreetingTextValue = value;
			this.#workspaceContext?.updateDraft({ greetingText: normaliseOptionalInputValue(value) });
			this.#syncAuthPreview();
		});
		this.consumeContext(UMB_LOGIN_SCREEN_ASSET_EDITOR_WORKSPACE_CONTEXT, (ctx) => {
			if (ctx !== undefined) this.#setupWorkspaceObservers(ctx);
		});
	}

	#setupWorkspaceObservers(ctx: LeLøginScreenAssetEditorWorkspaceContext) {
		this.#workspaceContext = ctx;
		this.observe(ctx.currentAsset, (asset) => {
			this.#asset = asset ?? null;
			this.#applyAssetDraft(asset ?? null);
			this.#render();
		});
		this.observe(ctx.assets, (assets) => { this.#assets = assets; this.#render(); });
		this.observe(ctx.isLoading, (isLoading) => { this.#isLoading = isLoading; this.#render(); });
		this.observe(ctx.unique, (assetId) => { this.#assetId = assetId ?? undefined; this.#render(); });
	}

	override connectedCallback() { super.connectedCallback(); this.#render(); }

	override disconnectedCallback() {
		this.#disposeAuthPreviewObserver();
		this.#detachBackgroundDrag();
		super.disconnectedCallback();
	}

	#render() {
		const previewUrl = this.#asset?.id !== undefined ? this.#thumbnailUrl(this.#asset.id) : undefined;
		this.#layout.replaceChildren(...buildWorkspaceBody({
			localize: this.localize,
			isLoading: this.#isLoading,
			asset: this.#asset,
			previewUrl,
			logoAssets: this.#logoAssets(),
			greetingText: this.#currentGreetingText(),
			selectedLogoAssetId: this.#selectedLogoAssetId(),
			zoom: this.#draftZoom,
		}));
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
		const inBtn = this.shadowRoot?.querySelector<HTMLButtonElement>('#asset-zoom-in');
		const outBtn = this.shadowRoot?.querySelector<HTMLButtonElement>('#asset-zoom-out');
		if (inBtn !== null && inBtn !== undefined) inBtn.disabled = this.#draftZoom >= ZOOM_MAX;
		if (outBtn !== null && outBtn !== undefined) outBtn.disabled = this.#draftZoom <= ZOOM_MIN;
	}

	async #openLogoPicker() {
		const result = await umbOpenModal(this, LOGO_PICKER_MODAL_TOKEN, {
			data: {
				logoAssets: this.#logoAssets(),
				selectedLogoAssetId: this.#selectedLogoAssetId(),
			},
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
		if (!(authPreview instanceof HTMLElement) || this.#asset === null || this.#assetId === undefined) {
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
			this.#observeAuthPreviewMutations(authPreview);
		} else {
			applyAuthViewCustomisation(authPreview, this.#authPreviewCustomisation());
		}
		requestAnimationFrame(() => {
			this.#positionGreetingOverlay();
			this.#positionLogoPickerOverlay();
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
		if (shell === this.#authPreviewGraphic) return;
		this.#detachBackgroundDrag();
		this.#attachBackgroundDrag(shell);
	}

	#attachBackgroundDrag(shell: HTMLElement) {
		this.#authPreviewGraphic = shell;
		shell.style.cursor = 'grab';
		shell.style.touchAction = 'none';

		let startFocalPoint: FocalPoint | null = null;
		let startClientX = 0;
		let startClientY = 0;
		let containerSize = { width: 0, height: 0 };
		let activePointerId: number | null = null;

		const imageSize = () =>
			this.#asset !== null
				? { width: this.#asset.width, height: this.#asset.height }
				: { width: 0, height: 0 };

		const measureContainer = () => {
			// Prefer the auth-view's #graphic rect (matches the visible image frame),
			// fall back to the shell itself if the auth-view hasn't laid out yet.
			const graphic = this.#authPreview?.shadowRoot?.getElementById('graphic');
			const rect = (graphic instanceof HTMLElement ? graphic : shell).getBoundingClientRect();
			return { width: rect.width, height: rect.height };
		};

		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return;
			containerSize = measureContainer();
			startFocalPoint = { ...(this.#draftFocalPoint ?? { left: 0.5, top: 0.5 }) };
			startClientX = event.clientX;
			startClientY = event.clientY;
			activePointerId = event.pointerId;
			shell.setPointerCapture(event.pointerId);
			shell.style.cursor = 'grabbing';
			event.preventDefault();
		};

		const onPointerMove = (event: PointerEvent) => {
			if (activePointerId !== event.pointerId || startFocalPoint === null) return;
			const next = computeFocalPointFromDrag({
				image: imageSize(),
				container: containerSize,
				startFocalPoint,
				deltaX: event.clientX - startClientX,
				deltaY: event.clientY - startClientY,
				zoom: this.#draftZoom,
			});
			this.#applyDraggedFocalPoint(next);
		};

		const onPointerEnd = (event: PointerEvent) => {
			if (activePointerId !== event.pointerId) return;
			if (shell.hasPointerCapture(event.pointerId)) {
				shell.releasePointerCapture(event.pointerId);
			}
			activePointerId = null;
			startFocalPoint = null;
			shell.style.cursor = 'grab';
		};

		const onWheel = (event: WheelEvent) => {
			// ctrlKey is set both for actual Ctrl+wheel and for Mac touchpad pinch gestures
			// (the browser translates pinch into wheel events with ctrlKey=true). Plain
			// two-finger scrolling has ctrlKey=false and must pass through to the page.
			if (!event.ctrlKey) return;
			event.preventDefault();
			this.#applyZoomDelta(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
		};

		shell.addEventListener('pointerdown', onPointerDown);
		shell.addEventListener('pointermove', onPointerMove);
		shell.addEventListener('pointerup', onPointerEnd);
		shell.addEventListener('pointercancel', onPointerEnd);
		shell.addEventListener('wheel', onWheel, { passive: false });

		this.#backgroundDragCleanup = () => {
			shell.removeEventListener('pointerdown', onPointerDown);
			shell.removeEventListener('pointermove', onPointerMove);
			shell.removeEventListener('pointerup', onPointerEnd);
			shell.removeEventListener('pointercancel', onPointerEnd);
			shell.removeEventListener('wheel', onWheel);
			shell.style.cursor = '';
			shell.style.touchAction = '';
		};
	}

	#detachBackgroundDrag() {
		this.#backgroundDragCleanup?.();
		this.#backgroundDragCleanup = undefined;
		this.#authPreviewGraphic = undefined;
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

	#positionLogoPickerOverlay() {
		if (!this.#isBackgroundAssetLoaded() || this.#authPreview === undefined) return;
		const pos = measureLogoPosition(this.#authPreview);
		if (pos === null) return;
		const picker = this.shadowRoot?.querySelector<HTMLElement>('.preview-logo-picker');
		if (!picker) return;
		picker.style.setProperty('--logo-left', `${pos.leftPct.toFixed(1)}%`);
		picker.style.setProperty('--logo-top', `${pos.topPct.toFixed(1)}%`);
	}

	#isBackgroundAssetLoaded(): boolean {
		return this.#asset !== null && isBackgroundLoginImageAsset(this.#asset);
	}

	#authPreviewCustomisation() {
		if (!this.#isBackgroundAssetLoaded() || this.#assetId === undefined) {
			return { mode: 'preview' as const, previewHeight: '100%' };
		}
		// Image dimensions feed the crop+cover simulation in auth-view-customiser so the
		// editor previews the exact pixels ImageSharp.Web will produce at runtime. Missing
		// dimensions (legacy assets) leave the preview in the simpler fp%+cover fallback.
		return {
			imageUrl: this.#thumbnailUrl(this.#assetId),
			...optional('greetingText', normaliseOptionalInputValue(this.#currentGreetingText())),
			...optional('logoUrl', this.#selectedLogoPreviewUrl()),
			...optional('focalPoint', this.#draftFocalPoint),
			...optional('zoom', this.#draftZoom > 1 ? this.#draftZoom : undefined),
			...optional('imageWidth', this.#asset?.width),
			...optional('imageHeight', this.#asset?.height),
			hideGreeting: true,
			mode: 'preview' as const,
			previewHeight: '100%'
		};
	}

	#observeAuthPreviewMutations(authPreview: HTMLElement) {
		if (authPreview.shadowRoot === null) return;
		let rafHandle: number | undefined;
		const observer = new MutationObserver(() => {
			if (rafHandle !== undefined) cancelAnimationFrame(rafHandle);
			rafHandle = requestAnimationFrame(() => {
				rafHandle = undefined;
				this.#positionGreetingOverlay();
				this.#positionLogoPickerOverlay();
				this.#syncBackgroundDragTarget();
			});
		});
		observer.observe(authPreview.shadowRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'hidden', 'class', 'style'] });
		this.#authPreviewMutationCleanup = () => { observer.disconnect(); if (rafHandle !== undefined) cancelAnimationFrame(rafHandle); };
	}

	#disposeAuthPreviewObserver() {
		this.#stopObservingAuthPreview?.();
		this.#stopObservingAuthPreview = undefined;
		this.#authPreviewMutationCleanup?.();
		this.#authPreviewMutationCleanup = undefined;
	}

	#thumbnailUrl(assetId: string): string {
		return `/umbraco/le-løgin/api/v1/assets/${encodeURIComponent(assetId)}/thumbnail`;
	}

	#applyAssetDraft(asset: LoginImageAsset | null) {
		const bg = asset !== null && isBackgroundLoginImageAsset(asset) ? asset : null;
		this.#draftGreetingTextValue = bg !== null ? bg.greetingText ?? '' : undefined;
		this.#draftLogoAssetId = bg !== null ? bg.logoAssetId ?? '' : undefined;
		this.#draftFocalPoint = bg?.focalPoint;
		this.#draftZoom = bg?.zoom ?? 1;
	}

	#logoAssets() { return this.#assets.filter(isLogoLoginImageAsset); }
	#currentGreetingText() { return this.#draftGreetingTextValue ?? ''; }

	#selectedLogoAssetId() {
		if (this.#asset === null || !isBackgroundLoginImageAsset(this.#asset)) return '';
		return this.#draftLogoAssetId ?? '';
	}

	#selectedLogoPreviewUrl() {
		const id = this.#selectedLogoAssetId();
		if (id.length === 0) return undefined;
		return this.#thumbnailUrl(id);
	}
}

customElements.define('login-screen-asset-workspace', LeLøginScreenAssetWorkspace);
export default LeLøginScreenAssetWorkspace;
