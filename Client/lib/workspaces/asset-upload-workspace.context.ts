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
import { requestChildrenReload } from '../utils/request-structure-reload.js';
import { setStringStateAlways } from '../utils/repeat-state.js';
import { assetGroupEntity } from '../tree/asset-tree.data-source.js';

const buildAssetEditWorkspacePath = (assetId: string): string =>
	`/umbraco/section/settings/workspace/login-screen-asset/edit/${encodeURIComponent(assetId)}`;

const BACKGROUND_WORKSPACE_ALIAS = 'LeLøgin.Workspace.AssetUpload.Background';
const LOGO_WORKSPACE_ALIAS = 'LeLøgin.Workspace.AssetUpload.Logo';

/** Context token for the upload workspaces; matches the background and the logo upload contexts. */
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
	/** Workspace routes; serves `edit/:unique`, which resets the form for a new upload. */
	readonly routes = new UmbWorkspaceRouteManager(this);
	// Marker the umb-entity-detail-workspace-editor uses to claim this context.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly IS_ENTITY_DETAIL_WORKSPACE_CONTEXT = true;
	/** Loading states the workspace editor reads; the upload adds none. */
	readonly loading = new UmbStateManager(this);
	/** Forbidden states the workspace editor reads; the upload adds none. */
	readonly forbidden = new UmbStateManager(this);

	/** Alias of the workspace manifest this context belongs to. */
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

	/** Name the new asset will get. */
	readonly name = this.#name.asObservable();
	/** The chosen file, or `undefined` when none is chosen or it was rejected. */
	readonly selectedFile = this.#selectedFile.asObservable();
	/** Why the last chosen file was rejected; empty when it was not. */
	readonly rejectMessage = this.#rejectMessage.asObservable();
	/** A draft id, so Umbraco's Save button is enabled before the asset exists. */
	readonly unique = this.#unique.asObservable();
	/** The upload entity type for this context's kind. */
	readonly entityType: ReturnType<UmbStringState<string>['asObservable']>;
	/** Always true: this workspace only creates assets. */
	readonly isNew = this.#isNew.asObservable();
	/** Truthy placeholder so the workspace editor does not show its not-found view. */
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

	/**
	 * Provides the context and registers the upload route.
	 *
	 * @param host - The workspace's controller host.
	 * @param options - The asset kind to upload, and the entity type and workspace alias that match it.
	 */
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

	/** @returns The upload entity type for this context's kind. */
	getEntityType() {
		return this.#entityType;
	}

	/** @returns The draft id set when the route matched. */
	getUnique() {
		return this.#unique.getValue();
	}

	/** @returns The name the new asset will get. */
	getName(): string {
		return this.#name.getValue();
	}

	/**
	 * Sets the name the new asset will get.
	 *
	 * @param name - The name.
	 */
	setName(name: string) {
		this.#name.setValue(name);
	}

	/** @returns Always true. */
	getIsNew(): boolean {
		return this.#isNew.getValue();
	}

	/** @returns The kind of asset this context uploads. */
	getKind(): LoginImageAssetKind {
		return this.#kind;
	}

	/**
	 * Chooses the file to upload and clears any rejection. When no name has been entered, the
	 * name defaults to the file name without its extension.
	 *
	 * @param file - The file, or `undefined` to clear the choice.
	 */
	setSelectedFile(file: File | undefined) {
		this.#selectedFile.setValue(file);
		this.#rejectMessage.setValue('');

		if (file !== undefined && this.#name.getValue().length === 0) {
			// Default the name to the file name without its extension.
			const extensionStart = file.name.lastIndexOf('.');
			this.#name.setValue(extensionStart > 0 ? file.name.slice(0, extensionStart) : file.name);
		}
	}

	/**
	 * Clears the chosen file and reports why it was rejected. Repeating the same message still
	 * notifies observers.
	 *
	 * @param message - The localised reason.
	 */
	setRejectMessage(message: string) {
		this.#selectedFile.setValue(undefined);
		// A second identical rejection must show its message again.
		setStringStateAlways(this.#rejectMessage, message);
	}

	/**
	 * Uploads the chosen file under the entered name, showing a notification for the outcome.
	 * On success, reloads the asset group in the tree and navigates to the new asset's workspace.
	 *
	 * @returns True when the asset was uploaded.
	 */
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
		const group = assetGroupEntity(this.#kind);
		await requestChildrenReload(this, group.unique, group.entityType);
		// Navigate within the backoffice, as Umbraco's router does, so the success notification
		// above is not lost to a full page reload.
		window.history.pushState({}, '', buildAssetEditWorkspacePath(data.id));
		return true;
	}

	async #notify(color: 'positive' | 'danger', message: string) {
		const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
		notificationContext?.peek(color, { data: { message } });
	}
}

/** Upload workspace context for background images. */
export class LeLøginScreenAssetUploadBackgroundWorkspaceContext extends LeLøginScreenAssetUploadWorkspaceContextBase {
	/** @param host - The workspace's controller host. */
	constructor(host: UmbControllerHost) {
		super(host, {
			kind: 'background',
			entityType: LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
			workspaceAlias: BACKGROUND_WORKSPACE_ALIAS
		});
	}
}

/** Upload workspace context for logos. */
export class LeLøginScreenAssetUploadLogoWorkspaceContext extends LeLøginScreenAssetUploadWorkspaceContextBase {
	/** @param host - The workspace's controller host. */
	constructor(host: UmbControllerHost) {
		super(host, {
			kind: 'logo',
			entityType: LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE,
			workspaceAlias: LOGO_WORKSPACE_ALIAS
		});
	}
}

/** Either upload workspace context, as consumers see it through the context token. */
export type LeLøginScreenAssetUploadWorkspaceContext = LeLøginScreenAssetUploadWorkspaceContextBase;
