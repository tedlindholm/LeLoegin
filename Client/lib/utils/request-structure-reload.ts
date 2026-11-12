import { UMB_ACTION_EVENT_CONTEXT } from '@umbraco-cms/backoffice/action';
import type { UmbClassInterface } from '@umbraco-cms/backoffice/class-api';
import {
	UmbRequestReloadChildrenOfEntityEvent,
	UmbRequestReloadStructureForEntityEvent
} from '@umbraco-cms/backoffice/entity-action';

/**
 * Asks Umbraco to refresh the tree around an entity that changed: the tree item that shows it,
 * or its parent's children. This is the event Umbraco's own entity actions dispatch.
 *
 * @param host - Any Umbraco class or element that can resolve contexts.
 * @param unique - The changed entity.
 * @param entityType - The changed entity's type.
 */
export const requestStructureReload = async (
	host: UmbClassInterface,
	unique: string,
	entityType: string
) => {
	const actionEventContext = await host.getContext(UMB_ACTION_EVENT_CONTEXT).catch(() => undefined);
	actionEventContext?.dispatchEvent(
		new UmbRequestReloadStructureForEntityEvent({ unique, entityType })
	);
};

/**
 * Asks Umbraco to reload the children shown under an entity, for example after a new item was
 * created beneath it.
 *
 * @param host - Any Umbraco class or element that can resolve contexts.
 * @param unique - The parent entity; `null` for a tree root.
 * @param entityType - The parent entity's type.
 */
export const requestChildrenReload = async (
	host: UmbClassInterface,
	unique: string | null,
	entityType: string
) => {
	const actionEventContext = await host.getContext(UMB_ACTION_EVENT_CONTEXT).catch(() => undefined);
	actionEventContext?.dispatchEvent(
		new UmbRequestReloadChildrenOfEntityEvent({ unique, entityType })
	);
};
