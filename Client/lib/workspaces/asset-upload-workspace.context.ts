import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import {
	UmbBooleanState,
	UmbObjectState,
	UmbStringState
} from '@umbraco-cms/backoffice/observable-api';
import { UmbWorkspaceRouteManager } from '@umbraco-cms/backoffice/workspace';
import type { UmbWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbStateManager } from '@umbraco-cms/backoffice/utils';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { LeLøginScreenAssetWorkspaceContext } from '../assets/asset-workspace.context.js';
import type { LoginImageAssetKind } from '../models/index.js';
import {
	LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE
} from '../tree/types.js';

const buildAssetEditWorkspacePath = (assetId: string): string =>
	`/umbraco/section/settings/workspace/login-screen-asset/edit/${encodeURIComponent(assetId)}`;

const BACKGROUND_WORKSPACE_ALIAS = 'LeLøgin.Workspace.AssetUpload.Background';
const LOGO_WORKSPACE_ALIAS = 'LeLøgin.Workspace.AssetUpload.Logo';

export const UMB_LOGIN_SCREEN_ASSET_UPLOAD_WORKSPACE_CONTEXT = new UmbContextToken<
	UmbWorkspaceContext,
	LeLøginScreenAssetUploadWorkspaceContextBase
>(
	'UmbWorkspaceContext',
	undefined,
	(context): context is LeLøginScreenAssetUploadWorkspaceContextBase => {
		const entityType = context.getEntityType?.();
		return (
			entityType === LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE ||
			entityType === LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE
		);
	}
);

/**
 * Routable workspace context for uploading a new login screen asset.
 *
 * The kind (background vs logo) is determined by the concrete subclass so the
 * workspace alias / entity type from the manifest matches the action invoked.
 */
abstract class LeLøginScreenAssetUploadWorkspaceContextBase extends UmbContextBase {
	readonly routes = new UmbWorkspaceRouteManager(this);
	// Marker the umb-entity-detail-workspace-editor uses to claim this context.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly IS_ENTITY_DETAIL_WORKSPACE_CONTEXT = true;
	readonly loading = new UmbStateManager(this);
	readonly forbidden = new UmbStateManager(this);

	readonly workspaceAlias: string;
	readonly #kind: LoginImageAssetKind;
	readonly #entityType: string;
	#assetWorkspaceContext: LeLøginScreenAssetWorkspaceContext;

	#name = new UmbStringState('');
	#selectedFile = new UmbObjectState<File | undefined>(undefined);
	#rejectMessage = new UmbStringState('');
	#unique = new UmbObjectState<string | undefined>(undefined);
	#entityTypeState: UmbStringState<string>;
	#isNew = new UmbBooleanState(true);
	#createUnderParent = new UmbObjectState<UmbEntityModel | undefined>(undefined);
	// `data` is read by umb-entity-detail-workspace-editor: a falsy value renders
	// the "not found" view, so we keep it set to a truthy placeholder while creating.
	#data = new UmbObjectState<{ entityType: string }>({ entityType: '' });
	#localize = new UmbLocalizationController(this);

	readonly name = this.#name.asObservable();
	readonly selectedFile = this.#selectedFile.asObservable();
	readonly rejectMessage = this.#rejectMessage.asObservable();
	readonly unique = this.#unique.asObservable();
	readonly entityType: ReturnType<UmbStringState<string>['asObservable']>;
	readonly isNew = this.#isNew.asObservable();
	readonly data = this.#data.asObservable();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParent = this.#createUnderParent.asObservable();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParentEntityUnique = this.#createUnderParent.asObservablePart(
		(parent) => parent?.unique
	);
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParentEntityType = this.#createUnderParent.asObservablePart(
		(parent) => parent?.entityType
	);

	constructor(
		host: UmbControllerHost,
		options: { kind: LoginImageAssetKind; entityType: string; workspaceAlias: string }
	) {
		super(host, UMB_LOGIN_SCREEN_ASSET_UPLOAD_WORKSPACE_CONTEXT);
		this.workspaceAlias = options.workspaceAlias;
		this.#kind = options.kind;
		this.#entityType = options.entityType;
		this.#entityTypeState = new UmbStringState(options.entityType);
		this.entityType = this.#entityTypeState.asObservable();
		this.#data.setValue({ entityType: options.entityType });
		this.#assetWorkspaceContext = new LeLøginScreenAssetWorkspaceContext(this);
		this.#createUnderParent.setValue({
			unique: null,
			entityType: LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE
		});

		this.routes.setRoutes([
			{
				path: 'edit/:unique',
				component: () => import('./asset-upload-workspace.element.js'),
				setup: () => {
					this.#name.setValue('');
					this.#selectedFile.setValue(undefined);
					this.#rejectMessage.setValue('');
					// UmbSubmitWorkspaceAction disables the Save button while unique is
					// undefined; we don't have a server entity yet, so use a draft UUID.
					this.#unique.setValue(globalThis.crypto.randomUUID());
				}
			}
		]);
	}

	getEntityType() {
		return this.#entityType;
	}

	getUnique() {
		return this.#unique.getValue();
	}

	getName(): string {
		return this.#name.getValue();
	}

	setName(name: string) {
		this.#name.setValue(name);
	}

	getIsNew(): boolean {
		return this.#isNew.getValue();
	}

	getKind(): LoginImageAssetKind {
		return this.#kind;
	}

	setSelectedFile(file: File | undefined) {
		this.#selectedFile.setValue(file);
		this.#rejectMessage.setValue('');

		if (file !== undefined && this.#name.getValue().length === 0) {
			this.#name.setValue(file.name.replace(/\.[^.]+$/, ''));
		}
	}

	setRejectMessage(message: string) {
		this.#selectedFile.setValue(undefined);
		this.#rejectMessage.setValue(message);
	}

	async requestSubmit(): Promise<boolean> {
		const file = this.#selectedFile.getValue();
		const name = this.#name.getValue().trim();

		if (file === undefined) {
			await this.#notify('danger', this.#localize.term('loginScreen_uploadSelectionInvalid'));
			return false;
		}

		if (name.length === 0) {
			await this.#notify('danger', this.#localize.term('loginScreen_assetNameRequired'));
			return false;
		}

		const { data, error } = await this.#assetWorkspaceContext.upload(file, name, this.#kind);
		if (error || data === undefined) {
			await this.#notify('danger', this.#localize.term('loginScreen_uploadFailed'));
			return false;
		}

		await this.#notify('positive', this.#localize.term('loginScreen_uploadSuccess'));
		window.location.href = buildAssetEditWorkspacePath(data.id);
		return true;
	}

	async #notify(color: 'positive' | 'danger', message: string) {
		const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
		notificationContext?.peek(color, { data: { message } });
	}
}

export class LeLøginScreenAssetUploadBackgroundWorkspaceContext extends LeLøginScreenAssetUploadWorkspaceContextBase {
	constructor(host: UmbControllerHost) {
		super(host, {
			kind: 'background',
			entityType: LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
			workspaceAlias: BACKGROUND_WORKSPACE_ALIAS
		});
	}
}

export class LeLøginScreenAssetUploadLogoWorkspaceContext extends LeLøginScreenAssetUploadWorkspaceContextBase {
	constructor(host: UmbControllerHost) {
		super(host, {
			kind: 'logo',
			entityType: LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE,
			workspaceAlias: LOGO_WORKSPACE_ALIAS
		});
	}
}

export type LeLøginScreenAssetUploadWorkspaceContext = LeLøginScreenAssetUploadWorkspaceContextBase;
