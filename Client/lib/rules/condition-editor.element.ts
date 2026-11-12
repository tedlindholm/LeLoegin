import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import styles from './condition-editor.element.css?inline';
import type {
	ConditionMetadata,
	LoginRuleCondition,
	LoginRuleConditionGroup,
	LoginRuleConditionOperator,
	LoginRuleConditionValue,
	LoginRuleField
} from './rule-condition.js';
import {
	changeConditionField,
	isLoginRuleConditionOperator,
	isLoginRuleField,
	normaliseValuesForOperator
} from './rule-condition.js';
import { cloneTemplate } from '../utils/template.js';
import {
	conditionControlRole,
	conditionRowIndex,
	conditionRowTemplate,
	fieldOptions,
	getEventTargetElement,
	getRequiredById,
	groupOperatorOptions,
	isConditionGroupOperator,
	isHtmlElement,
	isLabelElement,
	isSelectElement,
	isValueElement,
	operatorOptions,
	queryRequired,
	valueInputTemplate,
	valueLabel,
	valueSelectTemplate,
	type SelectElement,
	type ValueElement
} from './condition-editor.helpers.js';

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

	/**
	 * Gets the server condition metadata, or `null` before it has been set.
	 *
	 * @returns The current metadata
	 */
	get conditionMetadata(): ConditionMetadata | null {
		return this.#metadata;
	}

	/**
	 * Sets the server condition metadata that drives operator and value controls, and re-renders.
	 *
	 * @param value - The condition metadata
	 */
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
	 * Sets the condition group and re-renders. The value is deep-cloned, so later edits never
	 * mutate the caller's object.
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
		const shadow = this.shadowRoot;
		if (this.#conditionList === undefined && shadow !== null) this.#createShell(shadow);
		this.#render();
	}

	#createShell(shadow: ShadowRoot) {
		shadow.innerHTML = /* html */ `
			<div class="group-operator-row">
				<uui-label for="group-operator-select">${this.localize.term('loginScreen_conditionMatchLabel')}</uui-label>
				<uui-select id="group-operator-select"></uui-select>
			</div>
			<div id="condition-list" class="condition-list"></div>
			<uui-action-bar>
				<uui-button id="add-condition-btn" look="placeholder" label="${this.localize.term('loginScreen_addCondition')}">
					${this.localize.term('loginScreen_addCondition')}
				</uui-button>
			</uui-action-bar>
		`;

		const conditionList = getRequiredById(shadow, 'condition-list', isHtmlElement, 'condition list');
		const groupSelect = getRequiredById(
			shadow,
			'group-operator-select',
			isSelectElement,
			'group operator select'
		);
		const addConditionButton = getRequiredById(
			shadow,
			'add-condition-btn',
			isHtmlElement,
			'add condition button'
		);

		groupSelect.addEventListener('change', () => this.#changeGroupOperator(groupSelect.value));
		addConditionButton.addEventListener('click', () => this.#addCondition());
		conditionList.addEventListener('change', this.#onConditionChange);
		conditionList.addEventListener('input', this.#onConditionInput);
		conditionList.addEventListener('click', this.#onConditionClick);

		this.#conditionList = conditionList;
		this.#groupSelect = groupSelect;
	}

	#changeGroupOperator(value: string) {
		if (!isConditionGroupOperator(value)) return;
		this.#conditionGroup.operator = value;
		this.#emitChange();
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

		this.#groupSelect.options = groupOperatorOptions(this.localize, this.#conditionGroup.operator);
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
		fieldSelect.options = fieldOptions(this.localize, condition.field);
		fieldSelect.value = condition.field;

		const operatorSelect = queryRequired(
			row,
			'.operator-select',
			isSelectElement,
			'operator select'
		);
		operatorSelect.dataset.index = indexText;
		operatorSelect.options = operatorOptions(
			this.localize,
			this.#metadata,
			condition.field,
			condition.operator
		);
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
		const control =
			allowedValues !== undefined && allowedValues.length > 0
				? this.#buildValueSelect(condition, allowedValues)
				: this.#buildValueInput();
		control.className = 'value-input';
		control.dataset.role = 'value';
		control.dataset.index = indexText;
		control.value = condition.values[0]?.toString() ?? '';
		return control;
	}

	#buildValueSelect(
		condition: LoginRuleCondition,
		allowedValues: ReadonlyArray<LoginRuleConditionValue>
	): SelectElement {
		const select = cloneTemplate(valueSelectTemplate, 'value select').firstElementChild;
		if (!isSelectElement(select)) {
			throw new Error('Expected UUI select for enumerated condition values.');
		}
		const selectedText = condition.values[0]?.toString();
		select.options = allowedValues.map((value) => {
			const valueText = value.toString();
			return {
				name: valueLabel(this.localize, condition.field, valueText),
				value: valueText,
				selected: valueText === selectedText
			};
		});
		return select;
	}

	#buildValueInput(): ValueElement {
		const input = cloneTemplate(valueInputTemplate, 'value input').firstElementChild;
		if (!isValueElement(input)) {
			throw new Error('Expected UUI input for free-text condition values.');
		}
		input.setAttribute('placeholder', this.localize.term('loginScreen_conditionValuePlaceholder'));
		return input;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Delegated event handlers (wired once on #conditionList in connectedCallback)
	// ──────────────────────────────────────────────────────────────────────────

	#onConditionChange = (e: Event) => {
		const el = getEventTargetElement(e);
		if (el === null) return;
		const condition = this.#conditionFor(el);
		if (condition === undefined) return;
		switch (conditionControlRole(el)) {
			case 'field':
				if (isSelectElement(el)) this.#changeField(condition, el.value);
				break;
			case 'operator':
				if (isSelectElement(el)) this.#changeOperator(condition, el.value);
				break;
			case 'value':
				if (isValueElement(el)) this.#changeValue(condition, el.value);
				break;
		}
	};

	#onConditionInput = (e: Event) => {
		const el = getEventTargetElement(e);
		if (el === null || conditionControlRole(el) !== 'value' || !isValueElement(el)) return;
		const condition = this.#conditionFor(el);
		if (condition === undefined) return;
		const value = el.value;
		condition.values =
			this.#metadata !== null
				? normaliseValuesForOperator(condition.operator, condition.field, [value], this.#metadata)
				: [value];
		this.#emitChange();
	};

	#onConditionClick = (e: Event) => {
		const button = getEventTargetElement(e)?.closest<HTMLElement>('.remove-btn');
		if (button === null || button === undefined) return;
		const index = conditionRowIndex(button);
		if (index !== undefined) this.#removeCondition(index);
	};

	#conditionFor(el: Element): LoginRuleCondition | undefined {
		const index = conditionRowIndex(el);
		return index === undefined ? undefined : this.#conditionGroup.conditions[index];
	}

	#changeField(condition: LoginRuleCondition, newField: string) {
		if (!isLoginRuleField(newField) || this.#metadata === null) return;
		Object.assign(condition, changeConditionField(condition, newField, this.#metadata));
		this.#render();
		this.#emitChange();
	}

	#changeOperator(condition: LoginRuleCondition, newOperator: string) {
		if (!isLoginRuleConditionOperator(newOperator)) return;
		condition.operator = newOperator;
		if (this.#metadata !== null)
			condition.values = normaliseValuesForOperator(
				condition.operator,
				condition.field,
				condition.values,
				this.#metadata
			);
		this.#render();
		this.#emitChange();
	}

	#changeValue(condition: LoginRuleCondition, rawValue: string) {
		const allowedValues = this.#metadata?.fields.get(condition.field)?.allowedValues;
		condition.values = [allowedValues?.find((v) => v.toString() === rawValue) ?? rawValue];
		this.#emitChange();
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
}

customElements.define('login-screen-condition-editor', LeLøginScreenConditionEditor);

export default LeLøginScreenConditionEditor;
