import '@umbraco-cms/backoffice/collection';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import styles from './asset-group-workspace.element.css?inline';
import {
	UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT,
	type LeLøginScreenAssetGroupWorkspaceContext
} from './asset-group-workspace.context.js';

const COLLECTION_ALIAS = 'LeLøgin.Collection.AssetGroup';

export class LeLøginScreenAssetGroupWorkspace extends UmbElementMixin(HTMLElement) {
	#ctx: LeLøginScreenAssetGroupWorkspaceContext | undefined;
	#editor: HTMLElement | undefined;

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];

		this.consumeContext(UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT, (ctx) => {
			if (ctx === undefined) return;
			this.#ctx = ctx;
			this.observe(ctx.kind, () => this.#updateHeadline());
		});
	}

	override connectedCallback() {
		super.connectedCallback();
		const shadow = this.shadowRoot;
		if (this.#editor === undefined && shadow !== null) {
			shadow.innerHTML = /* html */ `
				<umb-workspace-editor alias="LeLøgin.Workspace.AssetGroup" enforceNoFooter>
					<div id="actions" slot="action-menu">
						<uui-button id="upload-btn" look="outline"></uui-button>
					</div>
					<umb-collection alias="${COLLECTION_ALIAS}"></umb-collection>
				</umb-workspace-editor>
			`;
			const editor = shadow.querySelector('umb-workspace-editor');
			if (!(editor instanceof HTMLElement)) {
				throw new Error('Asset group workspace template is missing its workspace editor.');
			}
			this.#editor = editor;
			this.#updateHeadline();
			this.#updateUploadButton();
		}
	}

	#updateHeadline() {
		if (this.#editor === undefined) return;
		const name = this.#ctx?.getName() ?? '';
		// setAttribute and textContent take plain text; escaping here would show entities literally.
		this.#editor.setAttribute('headline', name);
		this.#updateUploadButton();
	}

	#updateUploadButton() {
		const btn = this.shadowRoot?.getElementById('upload-btn');
		if (btn === null || btn === undefined || this.#ctx === undefined) return;
		const uploadLabel = this.localize.term('general_upload');
		btn.setAttribute('label', uploadLabel);
		btn.textContent = uploadLabel;
		btn.setAttribute('href', this.#ctx.getUploadPath());
	}
}

customElements.define('login-screen-asset-group-workspace', LeLøginScreenAssetGroupWorkspace);
export default LeLøginScreenAssetGroupWorkspace;
