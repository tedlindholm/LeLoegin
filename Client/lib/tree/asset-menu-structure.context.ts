import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbMenuTreeStructureWorkspaceContextBase } from '@umbraco-cms/backoffice/menu';

const LOGIN_SCREEN_ASSET_TREE_REPOSITORY_ALIAS = 'LeLøgin.Repository.AssetTree';

export class LeLøginScreenAssetMenuStructureWorkspaceContext extends UmbMenuTreeStructureWorkspaceContextBase {
	constructor(host: UmbControllerHost) {
		super(host, { treeRepositoryAlias: LOGIN_SCREEN_ASSET_TREE_REPOSITORY_ALIAS });
	}
}

export default LeLøginScreenAssetMenuStructureWorkspaceContext;
