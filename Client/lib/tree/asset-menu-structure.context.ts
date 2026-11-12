import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbMenuTreeStructureWorkspaceContextBase } from '@umbraco-cms/backoffice/menu';

const LOGIN_SCREEN_ASSET_TREE_REPOSITORY_ALIAS = 'LeLøgin.Repository.AssetTree';

/**
 * Menu-structure workspace context for the asset and asset-upload workspaces. Resolves the
 * workspace's position in the Le Løgin asset tree so the sidebar highlights the right item and
 * the breadcrumb footer app can render.
 */
export class LeLøginScreenAssetMenuStructureWorkspaceContext extends UmbMenuTreeStructureWorkspaceContextBase {
	/**
	 * @param host - The workspace controller host that owns this context.
	 */
	constructor(host: UmbControllerHost) {
		super(host, { treeRepositoryAlias: LOGIN_SCREEN_ASSET_TREE_REPOSITORY_ALIAS });
	}
}

/** Default export so the manifest's lazy `api` import resolves the context class. */
export default LeLøginScreenAssetMenuStructureWorkspaceContext;
