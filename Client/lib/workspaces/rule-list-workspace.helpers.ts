type ElementGuard<T extends Element> = (value: Element | null) => value is T;

/**
 * Queries an element by `id` inside `root`, throwing when missing or of the wrong type.
 *
 * @param root - Shadow root to search.
 * @param id - Element id without `#`.
 * @param guard - Type guard for the expected element.
 * @param description - Human-readable name for the error message.
 * @returns The matched element.
 */
export function getRequiredById<T extends Element>(
	root: ShadowRoot,
	id: string,
	guard: ElementGuard<T>,
	description: string
): T {
	const element = root.getElementById(id);
	if (!guard(element)) {
		throw new Error(`Expected ${description} with id "${id}".`);
	}
	return element;
}

/**
 * Queries a descendant matching `selector` inside `root`, throwing when missing or of the wrong type.
 *
 * @param root - Parent node to search.
 * @param selector - CSS selector.
 * @param guard - Type guard for the expected element.
 * @param description - Human-readable name for the error message.
 * @returns The matched element.
 */
export function queryRequired<T extends Element>(
	root: ParentNode,
	selector: string,
	guard: ElementGuard<T>,
	description: string
): T {
	const element = root.querySelector(selector);
	if (!guard(element)) {
		throw new Error(`Expected ${description} for selector "${selector}".`);
	}
	return element;
}

/** Returns `event.target` when it is an `Element`, otherwise `null`. */
export function getEventTargetElement(event: Event): Element | null {
	return event.target instanceof Element ? event.target : null;
}

/** Moves `sourceId` to the position currently occupied by `targetId`, or returns `undefined` if unchanged. */
export function reorderRuleIds(
	ids: ReadonlyArray<string>,
	sourceId: string,
	targetId: string
): Array<string> | undefined {
	if (sourceId === targetId) return undefined;
	const from = ids.indexOf(sourceId);
	const to = ids.indexOf(targetId);
	if (from === -1 || to === -1) return undefined;
	const reordered = [...ids];
	reordered.splice(from, 1);
	reordered.splice(to, 0, sourceId);
	return reordered;
}

/** Swaps `id` with its neighbour at `index + delta`, or returns `undefined` when out of bounds. */
export function swapAdjacentRuleIds(
	ids: ReadonlyArray<string>,
	id: string,
	delta: -1 | 1
): Array<string> | undefined {
	const from = ids.indexOf(id);
	const to = from + delta;
	const fromId = ids[from];
	const toId = ids[to];
	if (from === -1 || fromId === undefined || toId === undefined) return undefined;
	const reordered = [...ids];
	reordered[from] = toId;
	reordered[to] = fromId;
	return reordered;
}

