export interface UmbFileUploadPreviewElement extends HTMLElement {
	file?: File;
	path?: string;
}

const styles = `
	:host {
		display: block;
		border-radius: var(--uui-border-radius);
		overflow: hidden;
		background: var(--uui-color-surface-alt);
	}

	img {
		display: block;
		width: 100%;
		max-height: 300px;
		object-fit: contain;
	}
`;

export class LoginScreenImageUploadPreviewElement extends HTMLElement implements UmbFileUploadPreviewElement {
	#objectUrl?: string;
	#file?: File;

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];
	}

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
