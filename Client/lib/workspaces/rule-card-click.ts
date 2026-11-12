/**
 * True when a click's event path runs through a link. An asset card's name is a link that opens
 * the asset, and following it must not toggle the image in the rule.
 */
export const isLinkInEventPath = (path: ReadonlyArray<unknown>): boolean =>
	path.some(
		(node) =>
			typeof node === 'object' && node !== null && 'localName' in node && node.localName === 'a'
	);
