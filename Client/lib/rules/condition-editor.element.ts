import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import styles from './condition-editor.element.css?inline';
import type {
	ConditionMetadata,
	LoginRuleCondition,
	LoginRuleConditionGroup,
	LoginRuleConditionGroupOperator,
	LoginRuleConditionOperator,
	LoginRuleField
} from './rule-condition.js';
import { isLoginRuleConditionOperator, isLoginRuleField, normaliseValuesForOperator } from './rule-condition.js';
import { cloneTemplate } from '../utils/template.js';

interface SelectOption {
	name: string;
	value: string;
	selected?: boolean;
}

interface SelectElement extends HTMLElement {
	options: Array<SelectOption>;
	value: string;
}

interface ValueElement extends HTMLElement {
	value: string;
}

interface LabelElement extends HTMLElement {
	label: string;
}

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

const conditionRowTemplate = document.createElement('template');
conditionRowTemplate.innerHTML = /* html */ `
	<div class="condition-row">
		<uui-select class="field-select"></uui-select>
		<uui-select class="operator-select"></uui-select>
		<uui-input class="value-input"></uui-input>
		<uui-button class="remove-btn" look="outline" color="danger" compact></uui-button>
	</div>
`;

// Creating UUI form controls via createElement throws NotSupportedError because
// their constructor sets attributes synchronously, which the spec forbids on the
// create-an-element path. Template instantiation creates the element with state
// "undefined" without running the constructor; cloneTemplate's upgrade pass then
// runs the constructor in upgrade context, where the attribute-list check doesn't
// apply.
const valueSelectTemplate = document.createElement('template');
valueSelectTemplate.innerHTML = /* html */ `<uui-select></uui-select>`;

const valueInputTemplate = document.createElement('template');
valueInputTemplate.innerHTML = /* html */ `<uui-input></uui-input>`;

const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;
// Tag-name guards: see asset-workspace.helpers.ts for the rationale. Property
// existence checks are unreliable for both un-upgraded template clones and freshly
// upgraded UUI elements with undefined initial properties.
const isSelectElement = (value: Element | null): value is SelectElement =>
	value instanceof HTMLElement && value.localName === 'uui-select';
const isValueElement = (value: Element | null): value is ValueElement =>
	value instanceof HTMLElement
		&& (value.localName === 'uui-input' || value.localName === 'uui-select');
const isLabelElement = (value: Element | null): value is LabelElement =>
	value instanceof HTMLElement && value.localName === 'uui-button';
const isConditionGroupOperator = (value: string): value is LoginRuleConditionGroupOperator =>
	value === 'all' || value === 'any';

function getRequiredById<T extends Element>(
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

function queryRequired<T extends Element>(
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

function getEventTargetElement(event: Event): Element | null {
	return event.target instanceof Element ? event.target : null;
}

function parseIndex(value: string | undefined): number | undefined {
	const index = Number.parseInt(value ?? '', 10);
	return Number.isNaN(index) ? undefined : index;
}

/**
 * Fired when the condition group changes.
 * The event `detail` contains the updated `LoginRuleConditionGroup`.
 */
export type ConditionEditorChangeEvent = CustomEvent<LoginRuleConditionGroup>;

/**
 * Self-contained condition editor element for building login screen rule conditions.
 *
 * Renders a group operator (all/any) selector, a list of condition rows (field, operator, value),
 * and add/remove controls. Emits a `condition-change` event whenever the condition group is mutated.
 *
 * @fires condition-change - Dispatched when any part of the condition group changes
 *
 * @example
 * ```html
 * <login-screen-condition-editor></login-screen-condition-editor>
 * ```
 *
 * @example
 * ```typescript
 * const editor = document.createElement('login-screen-condition-editor');
 * editor.conditionGroup = myConditionGroup;
 * editor.addEventListener('condition-change', (event) => {
 *   console.log('Updated conditions:', event.detail);
 * });
 * ```
 */
export class LeLøginScreenConditionEditor extends UmbElementMixin(HTMLElement) {
	#conditionGroup: LoginRuleConditionGroup = {
		operator: 'all',
		conditions: []
	};

	#metadata: ConditionMetadata | null = null;
	#conditionList: HTMLElement | undefined;
	#groupSelect: SelectElement | undefined;

	get conditionMetadata(): ConditionMetadata | null {
		return this.#metadata;
	}

	set conditionMetadata(value: ConditionMetadata) {
		this.#metadata = value;
		this.#render();
	}

	/**
	 * Gets the current condition group state.
	 *
	 * @returns The current condition group
	 */
	get conditionGroup(): LoginRuleConditionGroup {
		return this.#conditionGroup;
	}

	/**
	 * Sets the condition group and re-renders.
	 *
	 * @param value - The new condition group state
	 */
	set conditionGroup(value: LoginRuleConditionGroup) {
		this.#conditionGroup = structuredClone(value);
		this.#render();
	}

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });

		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];
	}

	override connectedCallback() {
		super.connectedCallback();

		if (this.#conditionList === undefined) {
			const shadow = this.shadowRoot;
			if (shadow === null) return;
			shadow.innerHTML = /* html */ `
				<div class="group-operator-row">
					<uui-label for="group-operator-select">${this.localize.term('loginScreen_conditionMatchLabel')}</uui-label>
					<uui-select id="group-operator-select"></uui-select>
				</div>
				<div id="condition-list" class="condition-list"></div>
				<uui-action-bar>
					<uui-button id="add-condition-btn" look="outline" label="${this.localize.term('loginScreen_addCondition')}">
						${this.localize.term('loginScreen_addCondition')}
					</uui-button>
				</uui-action-bar>
			`;

			this.#conditionList = getRequiredById(shadow, 'condition-list', isHtmlElement, 'condition list');
			this.#groupSelect = getRequiredById(shadow, 'group-operator-select', isSelectElement, 'group operator select');
			const addConditionButton = getRequiredById(shadow, 'add-condition-btn', isHtmlElement, 'add condition button');

			this.#groupSelect.addEventListener('change', () => {
				const value = this.#groupSelect?.value;
				if (value === undefined || !isConditionGroupOperator(value)) {
					return;
				}
				this.#conditionGroup.operator = value;
				this.#emitChange();
			});

			addConditionButton.addEventListener('click', () => this.#addCondition());
			this.#conditionList.addEventListener('change', this.#onConditionChange);
			this.#conditionList.addEventListener('input', this.#onConditionInput);
			this.#conditionList.addEventListener('click', this.#onConditionClick);
		}

		this.#render();
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Rendering
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Updates the condition list zone and group operator select.
	 */
	#render() {
		if (this.#conditionList === undefined || this.#groupSelect === undefined) {
			return;
		}

		this.#groupSelect.options = this.#groupOperatorOptions();
		this.#groupSelect.value = this.#conditionGroup.operator;

		if (this.#conditionGroup.conditions.length === 0) {
			const message = document.createElement('p');
			message.className = 'empty-state';
			message.textContent = this.localize.term('loginScreen_conditionEmptyState');
			this.#conditionList.replaceChildren(message);
			return;
		}

		const rows = this.#conditionGroup.conditions.map((condition, index) =>
			this.#buildConditionRow(condition, index)
		);
		this.#conditionList.replaceChildren(...rows);
	}

	/**
	 * Builds a single condition row with field, operator, value, and remove button.
	 *
	 * @param condition - The condition data for the row
	 * @param index - The index of the condition within the group
	 * @returns The DOM node for the condition row
	 */
	#buildConditionRow(condition: LoginRuleCondition, index: number): HTMLElement {
		const fragment = cloneTemplate(conditionRowTemplate, 'condition row');

		const row = fragment.firstElementChild;
		if (!(row instanceof HTMLElement)) {
			throw new Error('Condition row template must have a single HTMLElement root.');
		}

		const indexText = index.toString();
		row.dataset.index = indexText;

		const fieldSelect = queryRequired(row, '.field-select', isSelectElement, 'field select');
		fieldSelect.dataset.index = indexText;
		fieldSelect.options = this.#fieldOptions(condition.field);
		fieldSelect.value = condition.field;

		const operatorSelect = queryRequired(row, '.operator-select', isSelectElement, 'operator select');
		operatorSelect.dataset.index = indexText;
		operatorSelect.options = this.#operatorOptions(condition.field, condition.operator);
		operatorSelect.value = condition.operator;

		const placeholderValueInput = queryRequired(row, '.value-input', isHtmlElement, 'value input');
		placeholderValueInput.replaceWith(this.#buildValueControl(condition, indexText));

		const removeButton = queryRequired(row, '.remove-btn', isLabelElement, 'remove button');
		const removeLabel = this.localize.term('general_remove');
		removeButton.dataset.index = indexText;
		removeButton.label = removeLabel;
		removeButton.textContent = removeLabel;

		return row;
	}

	#buildValueControl(condition: LoginRuleCondition, indexText: string): HTMLElement {
		const allowedValues = this.#metadata?.fields.get(condition.field)?.allowedValues;
		if (allowedValues !== undefined && allowedValues.length > 0) {
			const fragment = cloneTemplate(valueSelectTemplate, 'value select');
			const select = fragment.firstElementChild;
			if (!isSelectElement(select)) {
				throw new Error('Expected UUI select for enumerated condition values.');
			}

			select.className = 'value-input';
			select.dataset.index = indexText;
			select.options = [...allowedValues].map((value) => {
				const valueText = value.toString();
				return {
					name: this.#valueLabel(condition.field, valueText),
					value: valueText,
					selected: valueText === condition.values[0]?.toString()
				};
			});
			select.value = condition.values[0]?.toString() ?? '';
			return select;
		}

		const fragment = cloneTemplate(valueInputTemplate, 'value input');
		const input = fragment.firstElementChild;
		if (!isValueElement(input)) {
			throw new Error('Expected UUI input for free-text condition values.');
		}

		input.className = 'value-input';
		input.dataset.index = indexText;
		input.setAttribute('placeholder', this.localize.term('loginScreen_conditionValuePlaceholder'));
		input.value = condition.values[0]?.toString() ?? '';
		return input;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Delegated event handlers (wired once on #conditionList in connectedCallback)
	// ──────────────────────────────────────────────────────────────────────────

	#onConditionChange = (e: Event) => {
		const el = getEventTargetElement(e);
		if (el === null) return;
		const row = el.closest<HTMLElement>('.condition-row');
		if (row === null) return;
		const index = parseIndex(row.dataset.index);
		if (index === undefined) return;
		const condition = this.#conditionGroup.conditions[index];
		if (condition === undefined) return;
		if (el.classList.contains('field-select')) {
			if (!isSelectElement(el)) return;
			const newField = el.value;
			if (!isLoginRuleField(newField)) return;
			condition.field = newField;
			if (this.#metadata !== null) condition.values = normaliseValuesForOperator(condition.operator, condition.field, condition.values, this.#metadata);
			this.#render();
			this.#emitChange();
		} else if (el.classList.contains('operator-select')) {
			if (!isSelectElement(el)) return;
			const newOperator = el.value;
			if (!isLoginRuleConditionOperator(newOperator)) return;
			condition.operator = newOperator;
			if (this.#metadata !== null) condition.values = normaliseValuesForOperator(condition.operator, condition.field, condition.values, this.#metadata);
			this.#render();
			this.#emitChange();
		} else if (el.classList.contains('value-input')) {
			if (!isValueElement(el)) return;
			const rawValue = el.value;
			const allowedValues = this.#metadata?.fields.get(condition.field)?.allowedValues;
			const typed = allowedValues?.find((v) => v.toString() === rawValue) ?? rawValue;
			condition.values = [typed];
			this.#emitChange();
		}
	};

	#onConditionInput = (e: Event) => {
		const el = getEventTargetElement(e);
		if (el === null || !el.classList.contains('value-input') || !isValueElement(el)) return;
		const row = el.closest<HTMLElement>('.condition-row');
		if (row === null) return;
		const index = parseIndex(row.dataset.index);
		if (index === undefined) return;
		const condition = this.#conditionGroup.conditions[index];
		if (condition === undefined) return;
		const value = el.value;
		condition.values = this.#metadata !== null
			? normaliseValuesForOperator(condition.operator, condition.field, [value], this.#metadata)
			: [value];
		this.#emitChange();
	};

	#onConditionClick = (e: Event) => {
		const target = getEventTargetElement(e);
		if (target === null) return;
		const btn = target.closest<HTMLElement>('.remove-btn');
		if (btn === null) return;
		const row = btn.closest<HTMLElement>('.condition-row');
		if (row === null) return;
		const index = parseIndex(row.dataset.index);
		if (index !== undefined) this.#removeCondition(index);
	};

	#valueLabel(field: LoginRuleField, value: string): string {
		if (field === 'weekday') {
			const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
			const i = days.indexOf(value);
			if (i !== -1) return this.localize.date(new Date(2023, 0, i + 1), { weekday: 'long' });
		}
		if (field === 'month') {
			const monthNum = parseInt(value, 10);
			if (monthNum >= 1 && monthNum <= 12) return this.localize.date(new Date(2023, monthNum - 1, 1), { month: 'long' });
		}
		return value.charAt(0).toUpperCase() + value.slice(1);
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Actions
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Adds a new default condition to the group and re-renders.
	 */
	#addCondition() {
		const defaultField: LoginRuleField = 'weekday';
		const fieldMeta = this.#metadata?.fields.get(defaultField);
		const defaultOperator: LoginRuleConditionOperator = fieldMeta?.operators[0] ?? 'is';
		const defaultValue = fieldMeta?.defaultValue ?? 'monday';
		this.#conditionGroup.conditions.push({
			id: globalThis.crypto.randomUUID(),
			field: defaultField,
			operator: defaultOperator,
			values: [defaultValue]
		});
		this.#render();
		this.#emitChange();
	}

	/**
	 * Removes a condition by index and re-renders.
	 *
	 * @param index - The index of the condition to remove
	 */
	#removeCondition(index: number) {
		this.#conditionGroup.conditions.splice(index, 1);
		this.#render();
		this.#emitChange();
	}

	/**
	 * Dispatches a `condition-change` event with the current condition group state.
	 */
	#emitChange() {
		this.dispatchEvent(
			new CustomEvent<LoginRuleConditionGroup>('condition-change', {
				detail: structuredClone(this.#conditionGroup),
				bubbles: true,
				composed: true
			})
		);
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Options
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Builds the group operator (all/any) options list.
	 *
	 * @returns Array of select options for the group operator
	 */
	#groupOperatorOptions(): Array<SelectOption> {
		const current = this.#conditionGroup.operator;
		return [
			{
				name: this.localize.term('loginScreen_conditionMatchAll'),
				value: 'all',
				selected: current === 'all'
			},
			{
				name: this.localize.term('loginScreen_conditionMatchAny'),
				value: 'any',
				selected: current === 'any'
			}
		];
	}

	/**
	 * Builds the field options list (weekday, month).
	 *
	 * @param selected - The currently selected field value
	 * @returns Array of select options for the field
	 */
	#fieldOptions(selected: LoginRuleField): Array<SelectOption> {
		return [
			{
				name: this.localize.term('loginScreen_fieldWeekday'),
				value: 'weekday',
				selected: selected === 'weekday'
			},
			{
				name: this.localize.term('loginScreen_fieldMonth'),
				value: 'month',
				selected: selected === 'month'
			}
		];
	}

	/**
	 * Builds the operator options list for a given field, derived from server metadata.
	 *
	 * @param field - The field whose allowed operators should be listed
	 * @param selected - The currently selected operator value
	 * @returns Array of select options for the operator
	 */
	#operatorOptions(field: LoginRuleField, selected: LoginRuleConditionOperator): Array<SelectOption> {
		const ops: ReadonlyArray<LoginRuleConditionOperator> =
			this.#metadata?.fields.get(field)?.operators ?? ['is', 'isNot'];
		return [...ops].map((op) => ({
			name: this.#operatorLabel(op),
			value: op,
			selected: op === selected
		}));
	}

	#operatorLabel(operator: LoginRuleConditionOperator): string {
		switch (operator) {
			case 'is':
				return this.localize.term('loginScreen_operatorIs');
			case 'isNot':
				return this.localize.term('loginScreen_operatorIsNot');
			case 'in':
				return this.localize.term('loginScreen_operatorIn');
			case 'notIn':
				return this.localize.term('loginScreen_operatorNotIn');
			case 'between':
				return this.localize.term('loginScreen_operatorBetween');
			case 'notBetween':
				return this.localize.term('loginScreen_operatorNotBetween');
		}
	}
}

customElements.define('login-screen-condition-editor', LeLøginScreenConditionEditor);

export default LeLøginScreenConditionEditor;
