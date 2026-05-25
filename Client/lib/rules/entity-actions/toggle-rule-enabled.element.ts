import '@umbraco-cms/backoffice/components';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UmbActionExecutedEvent } from '@umbraco-cms/backoffice/event';
import type { ManifestEntityAction } from '@umbraco-cms/backoffice/entity-action';
import type { LoginRule } from '../../models/index.js';
import { UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT } from '../../workspaces/rule-editor-workspace.context.js';
import { UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT } from '../rule-workspace.context.js';
import type { LeLøginScreenToggleRuleEnabledEntityAction } from './toggle-rule-enabled-entity-action.js';

export class LeLøginScreenToggleRuleEnabledElement extends UmbElementMixin(HTMLElement) {
	#api: LeLøginScreenToggleRuleEnabledEntityAction | undefined;
	#unique: string | null = null;
	#enabled: boolean | null = null;
	#rules: Array<LoginRule> = [];
	#menuItem: HTMLElement & { label?: string };
	#icon: Element;

	manifest?: ManifestEntityAction;
	entityType?: string | null;

	get unique() { return this.#unique; }
	set unique(value: string | null | undefined) {
		this.#unique = value ?? null;
		const match = this.#rules.find((r) => r.id === this.#unique);
		if (match !== undefined) { this.#enabled = match.enabled; this.#update(); }
	}

	set api(value: LeLøginScreenToggleRuleEnabledEntityAction | undefined) {
		this.#api = value;
	}

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		shadow.innerHTML = `<uui-menu-item><umb-icon slot="icon" name="icon-check"></umb-icon></uui-menu-item>`;
		this.#menuItem = shadow.querySelector('uui-menu-item') as HTMLElement & { label?: string };
		this.#icon = shadow.querySelector('umb-icon')!;

		this.#menuItem.addEventListener('click-label', (e) => {
			e.stopPropagation();
			void this.#api?.execute().then(() => this.dispatchEvent(new UmbActionExecutedEvent()));
		});
		this.#menuItem.addEventListener('click', (e) => { e.stopPropagation(); });

		this.consumeContext(UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT, (ctx) => {
			if (!ctx) return;
			this.observe(ctx.currentRule, (rule) => {
				if (rule != null) { this.#enabled = rule.enabled; this.#update(); }
			});
		});

		this.consumeContext(UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT, (ctx) => {
			if (!ctx) return;
			this.observe(ctx.rules, (rules) => {
				this.#rules = rules ?? [];
				const match = this.#rules.find((r) => r.id === this.#unique);
				if (match !== undefined) { this.#enabled = match.enabled; this.#update(); }
			});
		});
	}

	override connectedCallback() { super.connectedCallback(); this.#update(); }

	#update() {
		this.#menuItem.setAttribute('label', this.localize.term('loginScreen_toggleEnabled'));
		this.#icon.setAttribute('name', this.#enabled === true ? 'icon-block' : 'icon-check');
	}
}

customElements.define('login-screen-toggle-rule-enabled', LeLøginScreenToggleRuleEnabledElement);
export default LeLøginScreenToggleRuleEnabledElement;
