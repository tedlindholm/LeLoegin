import '@umbraco-cms/backoffice/auth';
import '@umbraco-cms/backoffice/workspace';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import styles from './asset-upload-workspace.element.css?inline';
import {
	UMB_LOGIN_SCREEN_ASSET_UPLOAD_WORKSPACE_CONTEXT,
	type LeLøginScreenAssetUploadWorkspaceContext
} from './asset-upload-workspace.context.js';
import { cloneTemplate } from '../utils/template.js';
import './image-upload-preview.element.js';
import type { LoginScreenImageUploadPreviewElement } from './image-upload-preview.element.js';

interface FileDropzoneElement extends HTMLElement {
	browse(): void;
}

interface FileDropzoneFolder {
	folderName: string;
	folders: FileDropzoneFolder[];
	files: File[];
}

interface FileDropzoneDetail {
	files: File[];
	folders: FileDropzoneFolder[];
}

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

const uploadFieldTemplate = document.createElement('template');
uploadFieldTemplate.innerHTML = /* html */ `
	<uui-box>
		<uui-form-layout-item>
			<uui-label id="asset-file-label" slot="label" for="asset-file" required></uui-label>
			<div id="image-field"></div>
		</uui-form-layout-item>
	</uui-box>
`;

const fileDropzoneTemplate = document.createElement('template');
fileDropzoneTemplate.innerHTML = /* html */ `
	<uui-file-dropzone id="asset-file" standalone accept="image/*" disallow-folder-upload>
		<uui-button id="browse-button" look="placeholder"></uui-button>
	</uui-file-dropzone>
`;

const selectedFileTemplate = document.createElement('template');
selectedFileTemplate.innerHTML = /* html */ `
	<uui-ref-node standalone>
		<uui-action-bar slot="actions">
			<uui-button id="remove-file-button" compact>
				<uui-icon name="icon-trash"></uui-icon>
			</uui-button>
		</uui-action-bar>
	</uui-ref-node>
`;

const isFileDropzoneElement = (
	element: Element | null | undefined
): element is FileDropzoneElement => {
	// Tag-name guard: a property-existence check (`'browse' in element`) fails for
	// un-upgraded template clones. UUI is LitElement-based; the upgrade-fix pass
	// picks up our property writes when the element connects.
	return element instanceof HTMLElement && element.localName === 'uui-file-dropzone';
};

const isHtmlElement = (element: Element | null): element is HTMLElement =>
	element instanceof HTMLElement;

function getRequiredById<T extends Element>(
	root: ParentNode,
	id: string,
	guard: ElementGuard<T>,
	description: string
): T {
	const element = root.querySelector(`#${id}`);
	if (!guard(element)) {
		throw new Error(`Expected ${description} with id "${id}".`);
	}
	return element;
}

const isFileDropzoneEvent = (event: Event): event is Event & { detail: FileDropzoneDetail } => {
	if (!('detail' in event)) {
		return false;
	}
	const candidate = (event as CustomEvent).detail;
	return (
		typeof candidate === 'object' &&
		candidate !== null &&
		'files' in candidate &&
		'folders' in candidate
	);
};

const formatFileSize = (value: number): string => {
	if (value < 1024) {
		return `${value} B`;
	}
	const kilobytes = value / 1024;
	if (kilobytes < 1024) {
		return `${kilobytes.toFixed(1)} KB`;
	}
	return `${(kilobytes / 1024).toFixed(1)} MB`;
};

/**
 * Asset upload workspace — dedicated upload page for new login screen assets.
 */
export class LeLøginScreenAssetUploadWorkspace extends UmbElementMixin(HTMLElement) {
	#workspaceContext: LeLøginScreenAssetUploadWorkspaceContext | undefined;
	#notificationContext: typeof UMB_NOTIFICATION_CONTEXT.TYPE | undefined;
	#selectedFile: File | undefined;
	#layout: HTMLElement;

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
		this.#layout = shadow.getElementById('layout') as HTMLElement;

		this.consumeContext(UMB_NOTIFICATION_CONTEXT, (ctx) => {
			this.#notificationContext = ctx;
		});

		this.consumeContext(UMB_LOGIN_SCREEN_ASSET_UPLOAD_WORKSPACE_CONTEXT, (workspaceContext) => {
			if (workspaceContext === undefined) {
				return;
			}

			this.#workspaceContext = workspaceContext;

			this.observe(workspaceContext.selectedFile, (file) => {
				this.#selectedFile = file;
				this.#render();
			});

			this.observe(workspaceContext.rejectMessage, (message) => {
				if (message.length > 0) {
					this.#notificationContext?.peek('danger', { data: { message } });
				}
			});
		});
	}

	override connectedCallback() {
		super.connectedCallback();
		this.#render();
	}

	#render() {
		this.#layout.replaceChildren(this.#buildUploadField());
	}

	#buildUploadField(): HTMLElement {
		const fragment = cloneTemplate(uploadFieldTemplate, 'upload field');
		const field = getRequiredById(fragment, 'image-field', isHtmlElement, 'image field container');
		const label = getRequiredById(fragment, 'asset-file-label', isHtmlElement, 'asset file label');
		label.textContent = this.localize.term('grid_media');
		field.replaceChildren(this.#buildImageField());
		const box = fragment.firstElementChild;
		if (!(box instanceof HTMLElement)) {
			throw new Error('Upload field template must have a single HTMLElement root.');
		}
		return box;
	}

	#buildImageField(): HTMLElement {
		if (this.#selectedFile === undefined) {
			return this.#buildFileDropzone();
		}

		return this.#buildSelectedFileNode(this.#selectedFile);
	}

	#buildFileDropzone(): HTMLElement {
		const fragment = cloneTemplate(fileDropzoneTemplate, 'file dropzone');
		const dropzone = getRequiredById(
			fragment,
			'asset-file',
			isFileDropzoneElement,
			'file dropzone'
		);
		const browseButton = getRequiredById(fragment, 'browse-button', isHtmlElement, 'browse button');
		const uploadLabel = this.localize.term('media_clickToUpload');
		dropzone.setAttribute('label', uploadLabel);
		dropzone.addEventListener('change', (event) => this.#handleDropzoneChange(event));
		dropzone.addEventListener('reject', (event) => this.#handleDropzoneReject(event));

		browseButton.setAttribute('label', uploadLabel);
		browseButton.textContent = uploadLabel;
		browseButton.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopImmediatePropagation();
			dropzone.browse();
		});

		return dropzone;
	}

	#buildSelectedFileNode(file: File): HTMLElement {
		const preview = document.createElement(
			'login-screen-image-upload-preview'
		) as LoginScreenImageUploadPreviewElement;
		preview.file = file;

		const fragment = cloneTemplate(selectedFileTemplate, 'selected file');
		const refNode = fragment.firstElementChild;
		if (!(refNode instanceof HTMLElement)) {
			throw new Error('Selected file template must have a single HTMLElement root.');
		}

		const ext = file.name.includes('.')
			? '.' + file.name.slice(file.name.lastIndexOf('.') + 1)
			: '';
		const detail = [formatFileSize(file.size), ext].filter(Boolean).join(' · ');
		refNode.setAttribute('name', file.name);
		refNode.setAttribute('detail', detail);

		const removeButton = getRequiredById(
			refNode,
			'remove-file-button',
			isHtmlElement,
			'remove file button'
		);
		removeButton.setAttribute('label', this.localize.term('content_uploadClear'));
		removeButton.addEventListener('click', () => {
			this.#workspaceContext?.setSelectedFile(undefined);
		});

		const container = document.createElement('div');
		container.id = 'selected-file-container';
		container.append(preview, refNode);
		return container;
	}

	#handleDropzoneChange(event: Event) {
		if (!isFileDropzoneEvent(event)) {
			return;
		}

		const [file] = event.detail.files;
		if (file === undefined) {
			this.#workspaceContext?.setRejectMessage(
				this.localize.term('loginScreen_uploadSelectionInvalid')
			);
			return;
		}

		this.#workspaceContext?.setSelectedFile(file);
	}

	#handleDropzoneReject(event: Event) {
		if (!isFileDropzoneEvent(event)) {
			return;
		}

		const message =
			event.detail.files.length > 0
				? this.localize.term('loginScreen_uploadImagesOnly')
				: this.localize.term('loginScreen_uploadSelectionInvalid');

		this.#workspaceContext?.setRejectMessage(message);
	}
}

customElements.define('login-screen-asset-upload-workspace', LeLøginScreenAssetUploadWorkspace);

export default LeLøginScreenAssetUploadWorkspace;
