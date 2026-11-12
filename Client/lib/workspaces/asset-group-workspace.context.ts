import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import { UmbBooleanState, UmbObjectState } from '@umbraco-cms/backoffice/observable-api';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UmbWorkspaceRouteManager } from '@umbraco-cms/backoffice/workspace';
import type { UmbWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import type { LoginImageAsset, LoginImageAssetKind } from '../models/index.js';
import {
	LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE
} from '../tree/types.js';

const GROUP_ID_TO_KIND: Record<string, LoginImageAssetKind> = {
	'login-screen-assets-welcome': 'background',
	'login-screen-assets-logos': 'logo'
};

const WORKSPACE_ALIAS = 'LeLøgin.Workspace.AssetGroup';

/** Context token for the asset group workspace; matches only a workspace context for an asset group. */
export const UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT = new UmbContextToken<
	UmbWorkspaceContext,
	LeLøginScreenAssetGroupWorkspaceContext
>(
	'UmbWorkspaceContext',
	undefined,
	(context): context is LeLøginScreenAssetGroupWorkspaceContext =>
		context.getEntityType?.() === LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE
);

/**
 * Workspace context for an asset group (background images or logos). Serves `edit/:unique`,
 * maps the group id to an asset kind and loads that kind's assets.
 */
export class LeLøginScreenAssetGroupWorkspaceContext extends UmbContextBase {
	/** Alias of the workspace manifest this context belongs to. */
	readonly workspaceAlias = WORKSPACE_ALIAS;
	/** Workspace routes; serves `edit/:unique`. */
	readonly routes = new UmbWorkspaceRouteManager(this);

	#repository: LeLøginScreenAssetRepository;
	#unique = new UmbObjectState<string | undefined>(undefined);
	#kind = new UmbObjectState<LoginImageAssetKind | undefined>(undefined);
	#assets = new UmbObjectState<Array<LoginImageAsset>>([]);
	#isLoading = new UmbBooleanState(false);

	/** Id of the group, from the route. */
	readonly unique = this.#unique.asObservable();
	/** The asset kind the group holds, or `undefined` for an unknown group id. */
	readonly kind = this.#kind.asObservable();
	/** The group's assets. */
	readonly assets = this.#assets.asObservable();
	/** True while the group's assets load. */
	readonly isLoading = this.#isLoading.asObservable();
	#localize = new UmbLocalizationController(this);

	/**
	 * Provides the context and registers the edit route.
	 *
	 * @param host - The workspace's controller host.
	 */
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
				}
			}
		]);
	}

	/** @returns The asset group entity type. */
	getEntityType() {
		return LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE;
	}

	/** @returns Id of the group, or `undefined` before a route has matched. */
	getUnique() {
		return this.#unique.getValue();
	}

	/**
	 * Localised name of the group, used as the workspace headline.
	 *
	 * @returns The name, or an empty string when the group is unknown.
	 * @throws {Error} When the kind is a value this method does not handle.
	 */
	getName() {
		const kind = this.#kind.getValue();
		switch (kind) {
			case 'background':
				return this.#localize.term('loginScreen_assetsWelcomeImages');
			case 'logo':
				return this.#localize.term('loginScreen_assetsLogos');
			case undefined:
				return '';
			default: {
				const unhandledKind: never = kind;
				throw new Error(`Le Løgin cannot name the asset group '${String(unhandledKind)}'.`);
			}
		}
	}

	/** @returns Backoffice path of the upload workspace for the group's kind; background when unknown. */
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
