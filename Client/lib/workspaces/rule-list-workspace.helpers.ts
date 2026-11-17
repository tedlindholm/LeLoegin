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

/**
 * Returns existing `.rule-row` elements from `listBox` when their `data-id` sequence matches
 * `rules` in order, otherwise `undefined`.
 */
export function getMatchingRuleRows(
	listBox: HTMLElement | undefined,
	rules: ReadonlyArray<{ id: string }>
): Array<HTMLElement> | undefined {
	const list = listBox?.firstElementChild;
	if (!(list instanceof HTMLElement) || !list.classList.contains('rule-list')) return undefined;
	const rows = Array.from(list.children).filter(
		(child): child is HTMLElement => child instanceof HTMLElement
	);
	if (rows.length !== rules.length) return undefined;
	return rows.every((row, index) => row.dataset.id === rules[index]?.id) ? rows : undefined;
}

const RULE_ROW_TEMPLATE = /* html */ `
	<template id="row-template">
		<div class="rule-row">
			<div class="drag-handle" draggable="true">
				<uui-icon name="icon-navigation"></uui-icon>
			</div>
			<uui-ref-node class="ref"></uui-ref-node>
			<div class="move-actions">
				<uui-button class="move-up-btn" look="default" color="default" compact>
					<uui-icon name="icon-arrow-up"></uui-icon>
				</uui-button>
				<uui-button class="move-down-btn" look="default" color="default" compact>
					<uui-icon name="icon-arrow-down"></uui-icon>
				</uui-button>
			</div>
			<uui-toggle class="enabled-toggle" hide-label></uui-toggle>
			<uui-button class="delete-btn" look="default" color="default" compact>
				<uui-icon name="icon-trash"></uui-icon>
			</uui-button>
		</div>
	</template>
`;

/** Builds the static shadow DOM markup for the rule list workspace. */
export function buildRuleListShadowMarkup(
	headline: string,
	createLabel: string,
	createPath: string,
	escapeHtml: (value: string) => string
): string {
	const safeHeadline = escapeHtml(headline);
	const safeCreate = escapeHtml(createLabel);
	return /* html */ `
		<umb-workspace-editor headline="${safeHeadline}" alias="LeLøgin.Workspace.RuleList" enforceNoFooter>
			<div id="layout">
				<div id="actions">
					<uui-button look="outline" href="${createPath}" label="${safeCreate}">
						${safeCreate}
					</uui-button>
				</div>
				<uui-box id="list-box"></uui-box>
			</div>
			${RULE_ROW_TEMPLATE}
		</umb-workspace-editor>
	`;
}
