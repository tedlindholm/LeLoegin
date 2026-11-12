import type { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import type {
	ConditionMetadata,
	LoginRuleConditionGroupOperator,
	LoginRuleConditionOperator,
	LoginRuleField
} from './rule-condition.js';

/** An option for a `uui-select`. */
export interface SelectOption {
	/** Visible label. */
	name: string;
	/** Submitted value. */
	value: string;
	/** Whether the option is initially selected. */
	selected?: boolean;
}

/** Structural type for a `uui-select` element. */
export interface SelectElement extends HTMLElement {
	/** The options shown in the select. */
	options: Array<SelectOption>;
	/** The selected value. */
	value: string;
}

/** Structural type for a value control (`uui-input` or `uui-select`). */
export interface ValueElement extends HTMLElement {
	/** The control's current value. */
	value: string;
}

/** Structural type for a labelled control (`uui-button`). */
export interface LabelElement extends HTMLElement {
	/** The control's accessible label. */
	label: string;
}

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

type Localize = Pick<UmbLocalizationController, 'term' | 'date'>;

/** The control a condition row event came from, read from the control's `data-role`. */
export type ConditionControlRole = 'field' | 'operator' | 'value';

/** Template for one condition row: field select, operator select, value input and remove button. */
export const conditionRowTemplate = document.createElement('template');
conditionRowTemplate.innerHTML = /* html */ `
	<div class="condition-row">
		<uui-select class="field-select" data-role="field"></uui-select>
		<uui-select class="operator-select" data-role="operator"></uui-select>
		<uui-input class="value-input"></uui-input>
		<uui-button class="remove-btn" look="outline" compact></uui-button>
	</div>
`;

// Creating UUI form controls via createElement throws NotSupportedError because
// their constructor sets attributes synchronously, which the spec forbids on the
// create-an-element path. Template instantiation creates the element with state
// "undefined" without running the constructor; cloneTemplate's upgrade pass then
// runs the constructor in upgrade context, where the attribute-list check doesn't
// apply.
/** Template for a select value control, used when the field has a fixed list of values. */
export const valueSelectTemplate = document.createElement('template');
valueSelectTemplate.innerHTML = /* html */ `<uui-select></uui-select>`;

/** Template for a free-text value control. */
export const valueInputTemplate = document.createElement('template');
valueInputTemplate.innerHTML = /* html */ `<uui-input></uui-input>`;

/**
 * Type guard for `HTMLElement`.
 *
 * @param value - The element to test
 * @returns `true` when the value is an `HTMLElement`
 */
export const isHtmlElement = (value: Element | null): value is HTMLElement =>
	value instanceof HTMLElement;
// Tag-name guards: see asset-workspace.helpers.ts for the rationale. Property
// existence checks are unreliable for both un-upgraded template clones and freshly
// upgraded UUI elements with undefined initial properties.
/**
 * Type guard for a `uui-select`, checked by tag name.
 *
 * @param value - The element to test
 * @returns `true` when the value is a `uui-select`
 */
export const isSelectElement = (value: Element | null): value is SelectElement =>
	value instanceof HTMLElement && value.localName === 'uui-select';
/**
 * Type guard for a value control (`uui-input` or `uui-select`), checked by tag name.
 *
 * @param value - The element to test
 * @returns `true` when the value is a value control
 */
export const isValueElement = (value: Element | null): value is ValueElement =>
	value instanceof HTMLElement &&
	(value.localName === 'uui-input' || value.localName === 'uui-select');
/**
 * Type guard for a labelled `uui-button`, checked by tag name.
 *
 * @param value - The element to test
 * @returns `true` when the value is a `uui-button`
 */
export const isLabelElement = (value: Element | null): value is LabelElement =>
	value instanceof HTMLElement && value.localName === 'uui-button';
/**
 * Type guard for {@link LoginRuleConditionGroupOperator}.
 *
 * @param value - The string to test
 * @returns `true` when the value is `all` or `any`
 */
export const isConditionGroupOperator = (
	value: string
): value is LoginRuleConditionGroupOperator => value === 'all' || value === 'any';

/**
 * Finds an element by id in a shadow root and narrows it with a guard.
 *
 * @typeParam T - The expected element type
 * @param root - The shadow root to search
 * @param id - The element id
 * @param guard - Type guard the element must pass
 * @param description - Human-readable name used in the error message
 * @returns The narrowed element
 * @throws {Error} When no element has the id or it fails the guard
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
 * Finds the first element matching a selector and narrows it with a guard.
 *
 * @typeParam T - The expected element type
 * @param root - The node to search within
 * @param selector - CSS selector
 * @param guard - Type guard the element must pass
 * @param description - Human-readable name used in the error message
 * @returns The narrowed element
 * @throws {Error} When nothing matches or the match fails the guard
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

/**
 * Reads an event's target as an `Element`.
 *
 * @param event - The event
 * @returns The target when it is an `Element`, otherwise `null`
 */
export function getEventTargetElement(event: Event): Element | null {
	return event.target instanceof Element ? event.target : null;
}

/**
 * Parses a base-10 integer index, typically from a `data-index` attribute.
 *
 * @param value - The string to parse
 * @returns The index, or `undefined` when missing or not a number
 */
export function parseIndex(value: string | undefined): number | undefined {
	const index = Number.parseInt(value ?? '', 10);
	return Number.isNaN(index) ? undefined : index;
}

/**
 * Index of the condition row an element sits in, or `undefined` outside a row.
 *
 * @param element - An element inside a `.condition-row`
 * @returns The row's `data-index`, or `undefined`
 */
export function conditionRowIndex(element: Element): number | undefined {
	const row = element.closest<HTMLElement>('.condition-row');
	return row === null ? undefined : parseIndex(row.dataset.index);
}

/**
 * Reads which condition control an element is from its `data-role` attribute.
 *
 * @param element - The element to inspect
 * @returns The control role, or `undefined` when absent or unrecognised
 */
export function conditionControlRole(element: Element): ConditionControlRole | undefined {
	if (!(element instanceof HTMLElement)) return undefined;
	const role = element.dataset.role;
	return role === 'field' || role === 'operator' || role === 'value' ? role : undefined;
}

/**
 * Builds the localised options for the group operator select.
 *
 * @param localize - Localisation controller
 * @param current - The operator to mark as selected
 * @returns The `all` and `any` options
 */
export function groupOperatorOptions(
	localize: Localize,
	current: LoginRuleConditionGroupOperator
): Array<SelectOption> {
	return [
		{
			name: localize.term('loginScreen_conditionMatchAll'),
			value: 'all',
			selected: current === 'all'
		},
		{
			name: localize.term('loginScreen_conditionMatchAny'),
			value: 'any',
			selected: current === 'any'
		}
	];
}

/**
 * Builds the localised options for a condition's field select.
 *
 * @param localize - Localisation controller
 * @param selected - The field to mark as selected
 * @returns The `weekday` and `month` options
 */
export function fieldOptions(localize: Localize, selected: LoginRuleField): Array<SelectOption> {
	return [
		{
			name: localize.term('loginScreen_fieldWeekday'),
			value: 'weekday',
			selected: selected === 'weekday'
		},
		{
			name: localize.term('loginScreen_fieldMonth'),
			value: 'month',
			selected: selected === 'month'
		}
	];
}

/**
 * Operator options for a field, derived from server metadata. Falls back to `is` and `isNot`
 * when metadata is not loaded or does not list the field.
 *
 * @param localize - Localisation controller
 * @param metadata - Server condition metadata, or `null` before it loads
 * @param field - The condition's field
 * @param selected - The operator to mark as selected
 * @returns Localised operator options
 */
export function operatorOptions(
	localize: Localize,
	metadata: ConditionMetadata | null,
	field: LoginRuleField,
	selected: LoginRuleConditionOperator
): Array<SelectOption> {
	const ops: ReadonlyArray<LoginRuleConditionOperator> = metadata?.fields.get(field)
		?.operators ?? ['is', 'isNot'];
	return [...ops].map((op) => ({
		name: operatorLabel(localize, op),
		value: op,
		selected: op === selected
	}));
}

function operatorLabel(localize: Localize, operator: LoginRuleConditionOperator): string {
	switch (operator) {
		case 'is':
			return localize.term('loginScreen_operatorIs');
		case 'isNot':
			return localize.term('loginScreen_operatorIsNot');
		case 'in':
			return localize.term('loginScreen_operatorIn');
		case 'notIn':
			return localize.term('loginScreen_operatorNotIn');
		case 'between':
			return localize.term('loginScreen_operatorBetween');
		case 'notBetween':
			return localize.term('loginScreen_operatorNotBetween');
	}
}

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Display label for a condition value: a localised weekday or month name, else the capitalised value.
 *
 * @param localize - Localisation controller, used for date formatting
 * @param field - The condition's field
 * @param value - A lower-case weekday name or a month number from 1 to 12
 * @returns The display label
 */
export function valueLabel(localize: Localize, field: LoginRuleField, value: string): string {
	switch (field) {
		case 'weekday': {
			const i = weekdays.indexOf(value);
			if (i !== -1) return localize.date(new Date(2023, 0, i + 1), { weekday: 'long' });
			break;
		}
		case 'month': {
			const monthNum = parseInt(value, 10);
			if (monthNum >= 1 && monthNum <= 12)
				return localize.date(new Date(2023, monthNum - 1, 1), { month: 'long' });
			break;
		}
	}
	return value.charAt(0).toUpperCase() + value.slice(1);
}
