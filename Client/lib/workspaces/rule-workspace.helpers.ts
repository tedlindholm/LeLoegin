import type { ConditionMetadata, LoginRuleConditionGroup } from '../rules/rule-condition.js';

/** The properties the rule workspace sets on `login-screen-condition-editor`. */
export interface ConditionEditorElement extends HTMLElement {
	/** Available condition types and their options, or `null` while loading. */
	conditionMetadata: ConditionMetadata | null;
	/** The condition group being edited. */
	conditionGroup: LoginRuleConditionGroup;
}

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

/** Type guard for any `HTMLElement`; rejects `null`. */
export const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;
/** Type guard for an `img` element; rejects `null`. */
export const isHtmlImageElement = (value: Element | null): value is HTMLImageElement =>
	value instanceof HTMLImageElement;
/** Type guard for the `login-screen-condition-editor` element; rejects `null`. */
export const isConditionEditorElement = (value: Element | null): value is ConditionEditorElement =>
	value instanceof HTMLElement && value.localName === 'login-screen-condition-editor';

/**
 * Finds an element by id and checks its type.
 *
 * @typeParam T - The element type the guard narrows to.
 * @param root - Where to search.
 * @param id - The element id, without `#`.
 * @param guard - Type guard the element must pass.
 * @param description - Names the element in the error message.
 * @returns The element.
 * @throws {Error} When no element has the id or it fails the guard.
 */
export function getRequiredById<T extends Element>(
	root: ParentNode,
	id: string,
	guard: ElementGuard<T>,
	description: string
): T {
	const element = root.querySelector(`#${id}`);
	if (!guard(element)) {
		throw new Error(`Expected ${description} with id "${id}".`);
	}
	return element;
}

/**
 * Finds the first element matching a selector and checks its type.
 *
 * @typeParam T - The element type the guard narrows to.
 * @param root - Where to search.
 * @param selector - CSS selector to match.
 * @param guard - Type guard the element must pass.
 * @param description - Names the element in the error message.
 * @returns The element.
 * @throws {Error} When nothing matches or the match fails the guard.
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

function hasProperty<K extends string>(
	value: object,
	key: K
): value is object & Record<K, unknown> {
	return key in value;
}

function isConditionGroup(value: unknown): value is LoginRuleConditionGroup {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	if (!hasProperty(value, 'operator') || !hasProperty(value, 'conditions')) {
		return false;
	}

	return (value.operator === 'all' || value.operator === 'any') && Array.isArray(value.conditions);
}

/**
 * Type guard for the condition editor's change event, whose detail is the updated condition group.
 *
 * @param event - The event to check.
 * @returns True when the event is a `CustomEvent` carrying a condition group.
 */
export function isConditionChangeEvent(event: Event): event is CustomEvent<LoginRuleConditionGroup> {
	return event instanceof CustomEvent && isConditionGroup(event.detail);
}
