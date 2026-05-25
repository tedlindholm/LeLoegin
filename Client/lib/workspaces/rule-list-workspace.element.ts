import '@umbraco-cms/backoffice/components';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { escapeHTML } from '@umbraco-cms/backoffice/utils';
import styles from './rule-list-workspace.element.css?inline';
import type { LoginRule } from '../models/index.js';
import { buildRuleWorkspacePath, LOGIN_SCREEN_RULE_CREATE_WORKSPACE_PATH } from '../rules/entity-types.js';
import { LeLøginScreenRuleWorkspaceContext } from '../rules/rule-workspace.context.js';
import { cloneTemplate } from '../utils/template.js';

interface ToggleElement extends HTMLElement {
	checked: boolean;
	label: string;
}

interface RefNodeElement extends HTMLElement {
	name: string;
	href: string;
}

interface LabelElement extends HTMLElement {
	label: string;
}

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

const isHtmlElement = (el: Element | null): el is HTMLElement => el instanceof HTMLElement;
const isTemplateElement = (el: Element | null): el is HTMLTemplateElement => el instanceof HTMLTemplateElement;
// Tag-name guards: a property-existence check is unreliable both for un-upgraded
// template clones (the custom properties don't exist yet) AND for freshly upgraded
// UUI elements where the initial property values may be undefined rather than the
// expected type. UUI elements are LitElement-based — reactive-element's upgrade-fix
// pass on connection absorbs any property writes we make after the cast.
const isToggleElement = (el: Element | null): el is ToggleElement =>
	el instanceof HTMLElement && el.localName === 'uui-toggle';
const isRefNodeElement = (el: Element | null): el is RefNodeElement =>
	el instanceof HTMLElement && el.localName === 'uui-ref-node';
const isLabelElement = (el: Element | null): el is LabelElement =>
	el instanceof HTMLElement && el.localName === 'uui-button';

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

export class LeLøginScreenRuleListWorkspace extends UmbElementMixin(HTMLElement) {
	#workspaceContext = new LeLøginScreenRuleWorkspaceContext(this);
	#rules: Array<LoginRule> = [];
	#isLoading = true;
	#loadError = false;
	#dragSourceId: string | null = null;
	#listBox: HTMLElement | undefined;
	#rowTemplate: HTMLTemplateElement | undefined;

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];

		this.observe(this.#workspaceContext.rules, (rules) => {
			this.#rules = [...(rules ?? [])].sort((a, b) => a.priority - b.priority);
			this.#render();
		});
		this.observe(this.#workspaceContext.isLoading, (loading) => { this.#isLoading = loading; this.#render(); });
		this.observe(this.#workspaceContext.loadError, (err) => { this.#loadError = err; this.#render(); });
	}

	override connectedCallback() {
		super.connectedCallback();
		if (this.#listBox === undefined) {
			const shadow = this.shadowRoot;
			if (shadow === null) return;
			shadow.innerHTML = /* html */ `
				<umb-workspace-editor
					headline="${escapeHTML(this.localize.term('loginScreen_rules'))}"
					alias="LeLøgin.Workspace.RuleList"
					enforceNoFooter>
					<div id="layout">
						<div id="actions">
							<uui-button look="outline" href="${LOGIN_SCREEN_RULE_CREATE_WORKSPACE_PATH}" label="${escapeHTML(this.localize.term('general_create'))}">
								${escapeHTML(this.localize.term('general_create'))}
							</uui-button>
						</div>
						<uui-box id="list-box"></uui-box>
					</div>
					<template id="row-template">
						<div class="rule-row">
							<div class="drag-handle" draggable="true">
								<uui-icon name="icon-navigation"></uui-icon>
							</div>
							<uui-ref-node class="ref"></uui-ref-node>
							<uui-toggle class="enabled-toggle"></uui-toggle>
							<uui-button class="delete-btn" look="default" color="danger" compact>
								<uui-icon name="icon-trash"></uui-icon>
							</uui-button>
						</div>
					</template>
				</umb-workspace-editor>
			`;
			this.#listBox = getRequiredById(shadow, 'list-box', isHtmlElement, 'list box');
			this.#rowTemplate = getRequiredById(shadow, 'row-template', isTemplateElement, 'row template');
			this.#listBox.addEventListener('dragstart', this.#onDragStartDelegate);
			this.#listBox.addEventListener('dragend', this.#onDragEndDelegate);
			this.#listBox.addEventListener('dragover', this.#onDragOverDelegate);
			this.#listBox.addEventListener('drop', this.#onDropDelegate);
			this.#listBox.addEventListener('dragenter', this.#onDragEnterDelegate);
			this.#listBox.addEventListener('change', this.#onEnabledToggleDelegate);
			this.#listBox.addEventListener('click', this.#onDeleteDelegate);
		}
		this.#render();
		void this.#workspaceContext.load();
	}

	#render() {
		if (this.#listBox === undefined) return;

		if (this.#isLoading) {
			this.#listBox.replaceChildren(document.createElement('uui-loader-circle'));
			return;
		}

		if (this.#loadError) {
			const message = document.createElement('p');
			message.className = 'empty-state';
			message.style.color = 'var(--uui-color-danger)';
			message.textContent = 'Failed to load rules. Check browser console for details.';
			this.#listBox.replaceChildren(message);
			return;
		}

		if (this.#rules.length === 0) {
			const message = document.createElement('p');
			message.className = 'empty-state';
			message.textContent = this.localize.term('loginScreen_rulesEmpty');
			this.#listBox.replaceChildren(message);
			return;
		}

		const list = document.createElement('div');
		list.className = 'rule-list';

		for (const rule of this.#rules) {
			list.append(this.#buildRow(rule));
		}

		this.#listBox.replaceChildren(list);
	}

	#buildRow(rule: LoginRule): HTMLElement {
		if (this.#rowTemplate === undefined) {
			throw new Error('Rule row template is not initialised.');
		}

		const fragment = cloneTemplate(this.#rowTemplate, 'rule row');

		const row = fragment.firstElementChild;
		if (!(row instanceof HTMLElement)) {
			throw new Error('Rule row template must have a single HTMLElement root.');
		}

		row.dataset.id = rule.id;

		const handle = queryRequired(row, '.drag-handle', isHtmlElement, 'drag handle');
		handle.dataset.id = rule.id;

		const refNode = queryRequired(row, '.ref', isRefNodeElement, 'reference node');
		refNode.name = rule.name || '—';
		refNode.href = buildRuleWorkspacePath(rule.id);

		const toggle = queryRequired(row, '.enabled-toggle', isToggleElement, 'enabled toggle');
		toggle.checked = rule.enabled;
		toggle.label = this.localize.term('webhooks_enabled');
		toggle.dataset.id = rule.id;

		const deleteButton = queryRequired(row, '.delete-btn', isLabelElement, 'delete button');
		deleteButton.label = this.localize.term('general_delete');
		deleteButton.dataset.id = rule.id;

		return row;
	}

	#onDragStartDelegate = (e: Event) => {
		const target = getEventTargetElement(e);
		if (!(e instanceof DragEvent) || target === null) return;
		const handle = target.closest<HTMLElement>('.drag-handle[draggable]');
		if (handle !== null) this.#onDragStart(e, handle);
	};

	#onDragEndDelegate = () => this.#onDragEnd();

	#onDragOverDelegate = (e: Event) => {
		const target = getEventTargetElement(e);
		if (!(e instanceof DragEvent) || target === null || target.closest('.rule-row') === null) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	};

	#onDropDelegate = (e: Event) => {
		const target = getEventTargetElement(e);
		if (!(e instanceof DragEvent) || target === null) return;
		const row = target.closest<HTMLElement>('.rule-row[data-id]');
		if (row !== null) this.#onDrop(e, row);
	};

	#onDragEnterDelegate = (e: Event) => {
		const target = getEventTargetElement(e);
		if (target === null) return;
		const row = target.closest<HTMLElement>('.rule-row');
		if (row === null) return;
		this.shadowRoot?.querySelectorAll('.rule-row.drag-over').forEach((r) => r.classList.remove('drag-over'));
		row.classList.add('drag-over');
	};

	#onEnabledToggleDelegate = (e: Event) => {
		const target = getEventTargetElement(e);
		if (target?.closest('.enabled-toggle') !== null) this.#onEnabledToggle(e);
	};

	#onDeleteDelegate = (e: Event) => {
		const target = getEventTargetElement(e);
		if (target === null) return;
		const btn = target.closest<HTMLElement>('.delete-btn[data-id]');
		if (btn === null) return;
		const id = btn.dataset.id;
		if (id !== undefined) void this.#workspaceContext.delete(id);
	};

	#onDragStart(event: DragEvent, handle: HTMLElement) {
		const id = handle.dataset.id;
		if (id === undefined) return;
		this.#dragSourceId = id;
		if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); }
		handle.closest<HTMLElement>('.rule-row')?.classList.add('dragging');
	}

	#onDrop(event: DragEvent, row: HTMLElement) {
		event.preventDefault();
		row.classList.remove('drag-over');
		const targetId = row.dataset.id;
		if (this.#dragSourceId === null || targetId === undefined || targetId === this.#dragSourceId) return;
		const ids = this.#rules.map((r) => r.id);
		const from = ids.indexOf(this.#dragSourceId);
		const to = ids.indexOf(targetId);
		if (from === -1 || to === -1) return;
		const reordered = [...ids];
		reordered.splice(from, 1);
		reordered.splice(to, 0, this.#dragSourceId);
		this.#dragSourceId = null;
		void this.#workspaceContext.reorder(reordered);
	}

	#onDragEnd() {
		this.#dragSourceId = null;
		this.shadowRoot?.querySelectorAll<HTMLElement>('.rule-row').forEach((row) => {
			row.classList.remove('dragging', 'drag-over');
		});
	}

	#onEnabledToggle(event: Event) {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !isToggleElement(target)) return;
		const ruleId = target.dataset.id;
		if (ruleId === undefined) return;
		void this.#workspaceContext.setEnabled(ruleId, target.checked);
	}
}

customElements.define('login-screen-rule-list-workspace', LeLøginScreenRuleListWorkspace);
export default LeLøginScreenRuleListWorkspace;
