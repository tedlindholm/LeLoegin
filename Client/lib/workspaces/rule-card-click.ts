/**
 * True when a click's event path runs through a link. An asset card's name is a link that opens
 * the asset, and following it must not toggle the image in the rule.
 *
 * @param path - The click's composed event path.
 * @returns True when any node in the path is an `a` element.
 */
export const isLinkInEventPath = (path: ReadonlyArray<unknown>): boolean =>
	path.some(
		(node) =>
			typeof node === 'object' && node !== null && 'localName' in node && node.localName === 'a'
	);

/**
 * Computes the updated asset-id list in response to a UUI `selected` or `deselected` event.
 *
 * @param currentIds - Currently selected asset ids.
 * @param assetId - Id of the card that changed selection.
 * @param action - Whether the card was selected or deselected.
 * @returns The updated asset-id array.
 */
export const updateSelectedAssetIds = (
	currentIds: ReadonlyArray<string>,
	assetId: string,
	action: 'selected' | 'deselected'
): Array<string> => {
	if (action === 'selected') {
		return currentIds.includes(assetId) ? [...currentIds] : [...currentIds, assetId];
	}
	return currentIds.filter((id) => id !== assetId);
};

/**
 * Extracts `data-asset-id` from a `uui-card-media` selection event, ignoring link clicks.
 *
 * @param event - The DOM event (`selected`, `deselected`, or `click`).
 * @returns The card's `data-asset-id`, or `undefined` if the event was not on a card.
 */
export const extractSelectedCardAssetId = (event: Event): string | undefined => {
	if (!(event.target instanceof Element) || isLinkInEventPath(event.composedPath())) {
		return undefined;
	}

	const card = event.target.closest<HTMLElement>('uui-card-media[data-asset-id]');
	return card?.dataset['assetId'];
};
