import styles from './image-upload-preview.element.css?inline';

/** The shape Umbraco's file upload expects of a preview element. */
export interface UmbFileUploadPreviewElement extends HTMLElement {
	/** The file being uploaded. */
	file?: File;
	/** Server path of an existing file, when previewing one already stored. */
	path?: string;
}

/**
 * Upload preview that shows the chosen image file from an object URL, in its own shadow root.
 * Revokes the object URL when the file changes or the element is removed.
 */
export class LoginScreenImageUploadPreviewElement
	extends HTMLElement
	implements UmbFileUploadPreviewElement
{
	#objectUrl?: string;
	#file?: File;

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];
	}

	/** The image to preview. Setting it revokes any previous object URL; `undefined` clears the preview. */
	set file(value: File | undefined) {
		if (this.#objectUrl !== undefined) {
			URL.revokeObjectURL(this.#objectUrl);
			this.#objectUrl = undefined;
		}
		this.#file = value;
		if (value !== undefined) {
			this.#objectUrl = URL.createObjectURL(value);
			this.#render();
		} else {
			this.shadowRoot?.replaceChildren();
		}
	}

	get file(): File | undefined {
		return this.#file;
	}

	/** Revokes the object URL so the file can be released. */
	override disconnectedCallback() {
		if (this.#objectUrl !== undefined) {
			URL.revokeObjectURL(this.#objectUrl);
			this.#objectUrl = undefined;
		}
	}

	#render() {
		if (this.#objectUrl === undefined || this.shadowRoot === null) {
			return;
		}
		const img = document.createElement('img');
		img.src = this.#objectUrl;
		img.alt = '';
		this.shadowRoot.replaceChildren(img);
	}
}

customElements.define('login-screen-image-upload-preview', LoginScreenImageUploadPreviewElement);
export default LoginScreenImageUploadPreviewElement;
