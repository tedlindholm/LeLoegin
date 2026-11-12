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
