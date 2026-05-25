import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import { UmbBooleanState, UmbObjectState } from '@umbraco-cms/backoffice/observable-api';
import { UmbWorkspaceRouteManager } from '@umbraco-cms/backoffice/workspace';
import type { UmbWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import type { LoginImageAsset, LoginImageAssetKind } from '../models/index.js';
import {
	LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE,
} from '../tree/types.js';

const GROUP_ID_TO_KIND: Record<string, LoginImageAssetKind> = {
	'login-screen-assets-welcome': 'background',
	'login-screen-assets-logos': 'logo',
};

const WORKSPACE_ALIAS = 'LeLøgin.Workspace.AssetGroup';

export const UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT =
	new UmbContextToken<UmbWorkspaceContext, LeLøginScreenAssetGroupWorkspaceContext>(
		'UmbWorkspaceContext',
		undefined,
		(context): context is LeLøginScreenAssetGroupWorkspaceContext =>
			context.getEntityType?.() === LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE
	);

export class LeLøginScreenAssetGroupWorkspaceContext extends UmbContextBase {
	readonly workspaceAlias = WORKSPACE_ALIAS;
	readonly routes = new UmbWorkspaceRouteManager(this);

	#repository: LeLøginScreenAssetRepository;
	#unique = new UmbObjectState<string | undefined>(undefined);
	#kind = new UmbObjectState<LoginImageAssetKind | undefined>(undefined);
	#assets = new UmbObjectState<Array<LoginImageAsset>>([]);
	#isLoading = new UmbBooleanState(false);

	readonly unique = this.#unique.asObservable();
	readonly kind = this.#kind.asObservable();
	readonly assets = this.#assets.asObservable();
	readonly isLoading = this.#isLoading.asObservable();

	constructor(host: UmbControllerHost) {
		super(host, UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT);
		this.#repository = new LeLøginScreenAssetRepository(this);
		this.routes.setRoutes([
			{
				path: 'edit/:unique',
				component: () => import('./asset-group-workspace.element.js'),
				setup: async (_component, info) => {
					const unique = info.match.params['unique'];
					this.#unique.setValue(unique);
					const kind = GROUP_ID_TO_KIND[unique ?? ''];
					this.#kind.setValue(kind);
					await this.#loadAssets(kind);
				},
			},
		]);
	}

	getEntityType() {
		return LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE;
	}

	getUnique() {
		return this.#unique.getValue();
	}

	getName() {
		const kind = this.#kind.getValue();
		if (kind === 'background') return 'Welcome images';
		if (kind === 'logo') return 'Logos';
		return '';
	}

	getUploadPath(): string {
		const kind = this.#kind.getValue();
		const entityType =
			kind === 'logo'
				? LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE
				: LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE;
		return `/umbraco/section/settings/workspace/${entityType}/edit/null`;
	}

	async #loadAssets(kind: LoginImageAssetKind | undefined) {
		if (kind === undefined) return;
		this.#isLoading.setValue(true);
		try {
			const { data } = await this.#repository.requestItems();
			this.#assets.setValue((data ?? []).filter((a) => a.kind === kind));
		} finally {
			this.#isLoading.setValue(false);
		}
	}
}

export { LeLøginScreenAssetGroupWorkspaceContext as api };
