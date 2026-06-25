import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import styles from './root-workspace.element.css?inline';
import { LeLøginScreenOverviewDashboard } from '../dashboard/overview-dashboard.element.js';
import { LeLøginScreenRuleRepository } from '../rules/rule.repository.js';
import type { LoginRule } from '../models/index.js';
import { cloneTemplate } from '../utils/template.js';

interface PopoverToggleEvent extends Event {
	newState: string;
}

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

const ruleMenuItemTemplate = document.createElement('template');
ruleMenuItemTemplate.innerHTML = /* html */ `<uui-menu-item></uui-menu-item>`;

const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;

function getRequiredById<T extends Element>(
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

export class LeLøginScreenRootWorkspace extends UmbElementMixin(HTMLElement) {
	#ruleRepository = new LeLøginScreenRuleRepository(this);
	#rules: Array<LoginRule> = [];
	#selectedRuleId: string | undefined = undefined;
	#popoverOpen = false;
	#ruleMenu: HTMLElement;
	#selectorButton: HTMLElement;
	#selectorLabel: HTMLElement;
	#expandSymbol: HTMLElement;

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });

		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];

		shadow.innerHTML = /* html */ `
			<umb-workspace-editor headline="Le Løgin" alias="LeLøgin.Workspace.Root">
				<login-screen-overview-dashboard id="dashboard"></login-screen-overview-dashboard>
				<uui-button slot="actions" look="secondary" id="rule-selector-button" popovertarget="le-løgin-rule-popover" hidden>
					<span id="rule-selector-label"></span>
					<uui-symbol-expand id="rule-expand"></uui-symbol-expand>
				</uui-button>
				<uui-popover-container slot="actions" id="le-løgin-rule-popover" placement="top-start">
					<umb-popover-layout>
						<uui-scroll-container id="rule-menu"></uui-scroll-container>
					</umb-popover-layout>
				</uui-popover-container>
			</umb-workspace-editor>
		`;

		this.#ruleMenu = getRequiredById(shadow, 'rule-menu', isHtmlElement, 'rule menu');
		this.#selectorButton = getRequiredById(
			shadow,
			'rule-selector-button',
			isHtmlElement,
			'rule selector button'
		);
		this.#selectorLabel = getRequiredById(
			shadow,
			'rule-selector-label',
			isHtmlElement,
			'rule selector label'
		);
		this.#expandSymbol = getRequiredById(
			shadow,
			'rule-expand',
			isHtmlElement,
			'rule expand symbol'
		);

		shadow
			.getElementById('le-løgin-rule-popover')
			?.addEventListener('toggle', this.#onPopoverToggle);
		this.#ruleMenu.addEventListener('click', this.#onRuleSelect);
	}

	override connectedCallback() {
		super.connectedCallback();
		this.#render();
		void this.#loadRules();
	}

	async #loadRules() {
		const { data } = await this.#ruleRepository.requestItems();
		this.#rules = [...(data ?? [])].sort((a, b) => a.priority - b.priority);
		// If the currently selected rule was deleted, fall back to "Active screen".
		if (
			this.#selectedRuleId !== undefined &&
			this.#rules.find((r) => r.id === this.#selectedRuleId) === undefined
		) {
			this.#selectedRuleId = undefined;
		}
		this.#render();
	}

	#selected(): LoginRule | undefined {
		if (this.#selectedRuleId === undefined) return undefined;
		return this.#rules.find((r) => r.id === this.#selectedRuleId);
	}

	#activeScreenLabel(): string {
		return this.localize.term('loginScreen_activeScreen');
	}

	#render() {
		const selected = this.#selected();
		const label = selected?.name ?? this.#activeScreenLabel();

		this.#selectorLabel.textContent = label;
		this.#selectorButton.setAttribute('label', label);
		// Hide the picker entirely when there's nothing to switch to.
		if (this.#rules.length === 0) {
			this.#selectorButton.setAttribute('hidden', '');
		} else {
			this.#selectorButton.removeAttribute('hidden');
		}

		const menuItems = [
			this.#buildRuleMenuItem(
				this.#activeScreenLabel(),
				undefined,
				this.#selectedRuleId === undefined
			),
			...this.#rules.map((rule) =>
				this.#buildRuleMenuItem(rule.name, rule.id, rule.id === this.#selectedRuleId)
			)
		];
		this.#ruleMenu.replaceChildren(...menuItems);

		const dashboard = this.shadowRoot?.getElementById('dashboard');
		if (dashboard instanceof LeLøginScreenOverviewDashboard) {
			dashboard.previewContext = selected;
		}

		this.#syncExpandIndicator();
	}

	#buildRuleMenuItem(label: string, ruleId: string | undefined, active: boolean): HTMLElement {
		const fragment = cloneTemplate(ruleMenuItemTemplate, 'rule menu item');
		const item = fragment.firstElementChild;
		if (!(item instanceof HTMLElement)) {
			throw new Error('Rule menu item template must have a single HTMLElement root.');
		}

		item.setAttribute('label', label);
		item.dataset['ruleId'] = ruleId ?? '';
		if (active) {
			item.setAttribute('active', '');
		} else {
			item.removeAttribute('active');
		}

		return item;
	}

	#onPopoverToggle = (event: Event) => {
		if (!this.#isPopoverToggleEvent(event)) {
			return;
		}
		this.#popoverOpen = event.newState === 'open';
		this.#syncExpandIndicator();
	};

	#onRuleSelect = (event: Event) => {
		if (!(event.target instanceof Element)) {
			return;
		}
		const target = event.target.closest<HTMLElement>('uui-menu-item[data-rule-id]');
		if (target === null) {
			return;
		}
		const raw = target.dataset['ruleId'];
		// Empty data-rule-id = the pinned "Active screen" item.
		const next = raw === undefined || raw === '' ? undefined : raw;
		if (next === this.#selectedRuleId) return;
		this.#selectedRuleId = next;
		this.#render();
	};

	#syncExpandIndicator() {
		if (this.#popoverOpen) {
			this.#expandSymbol.setAttribute('open', '');
		} else {
			this.#expandSymbol.removeAttribute('open');
		}
	}

	#isPopoverToggleEvent(event: Event): event is PopoverToggleEvent {
		return 'newState' in event && typeof event.newState === 'string';
	}
}

customElements.define('login-screen-root-workspace', LeLøginScreenRootWorkspace);

export default LeLøginScreenRootWorkspace;
