import type { FocalPoint } from '../models/index.ts';
import { computeFocalPointFromDrag } from './focal-point-drag.js';

interface Size {
	width: number;
	height: number;
}

/** What the drag controller reads from, and reports back to, the asset workspace. */
export interface BackgroundDragHost {
	/** Natural size of the background image. */
	imageSize(): Size;
	/** Size of the visible image frame, measured when a drag starts. */
	measureContainer(): Size;
	/** The current focal point; `undefined` means the centre. */
	focalPoint(): FocalPoint | undefined;
	/** The current zoom factor. */
	zoom(): number;
	/** Called on every pointer move during a drag with the new focal point. */
	onFocalPointChange(focalPoint: FocalPoint): void;
	/** Called when the user pinches or Ctrl+scrolls; `zoomIn` is false for zooming out. */
	onZoom(zoomIn: boolean): void;
}

interface ActiveDrag {
	pointerId: number;
	startFocalPoint: FocalPoint;
	startClientX: number;
	startClientY: number;
	containerSize: Size;
}

/**
 * Lets the user drag the background preview to move its focal point, and pinch or
 * Ctrl+scroll it to zoom. Listens on `shell` until `dispose()` is called.
 */
export class LeLøginBackgroundDragController {
	/** The element that receives the drag and zoom gestures. */
	readonly shell: HTMLElement;
	#host: BackgroundDragHost;
	#drag: ActiveDrag | null = null;

	/**
	 * Starts listening for gestures and sets the grab cursor on `shell`.
	 *
	 * @param shell - The element to drag.
	 * @param host - Supplies sizes and current values, and receives the changes.
	 */
	constructor(shell: HTMLElement, host: BackgroundDragHost) {
		this.shell = shell;
		this.#host = host;
		shell.style.cursor = 'grab';
		shell.style.touchAction = 'none';
		shell.addEventListener('pointerdown', this.#onPointerDown);
		shell.addEventListener('pointermove', this.#onPointerMove);
		shell.addEventListener('pointerup', this.#onPointerEnd);
		shell.addEventListener('pointercancel', this.#onPointerEnd);
		shell.addEventListener('wheel', this.#onWheel, { passive: false });
	}

	/** Removes the listeners, restores the shell's cursor and touch styles, and ends any drag. */
	dispose() {
		const shell = this.shell;
		shell.removeEventListener('pointerdown', this.#onPointerDown);
		shell.removeEventListener('pointermove', this.#onPointerMove);
		shell.removeEventListener('pointerup', this.#onPointerEnd);
		shell.removeEventListener('pointercancel', this.#onPointerEnd);
		shell.removeEventListener('wheel', this.#onWheel);
		shell.style.cursor = '';
		shell.style.touchAction = '';
		this.#drag = null;
	}

	#onPointerDown = (event: PointerEvent) => {
		if (event.button !== 0) return;
		this.#drag = {
			pointerId: event.pointerId,
			startFocalPoint: { ...(this.#host.focalPoint() ?? { left: 0.5, top: 0.5 }) },
			startClientX: event.clientX,
			startClientY: event.clientY,
			containerSize: this.#host.measureContainer()
		};
		this.shell.setPointerCapture(event.pointerId);
		this.shell.style.cursor = 'grabbing';
		event.preventDefault();
	};

	#onPointerMove = (event: PointerEvent) => {
		const drag = this.#drag;
		if (drag === null || drag.pointerId !== event.pointerId) return;
		const next = computeFocalPointFromDrag({
			image: this.#host.imageSize(),
			container: drag.containerSize,
			startFocalPoint: drag.startFocalPoint,
			deltaX: event.clientX - drag.startClientX,
			deltaY: event.clientY - drag.startClientY,
			zoom: this.#host.zoom()
		});
		this.#host.onFocalPointChange(next);
	};

	#onPointerEnd = (event: PointerEvent) => {
		if (this.#drag?.pointerId !== event.pointerId) return;
		if (this.shell.hasPointerCapture(event.pointerId)) {
			this.shell.releasePointerCapture(event.pointerId);
		}
		this.#drag = null;
		this.shell.style.cursor = 'grab';
	};

	#onWheel = (event: WheelEvent) => {
		// ctrlKey is set both for actual Ctrl+wheel and for Mac touchpad pinch gestures
		// (the browser translates pinch into wheel events with ctrlKey=true). Plain
		// two-finger scrolling has ctrlKey=false and must pass through to the page.
		if (!event.ctrlKey) return;
		event.preventDefault();
		this.#host.onZoom(event.deltaY < 0);
	};
}
