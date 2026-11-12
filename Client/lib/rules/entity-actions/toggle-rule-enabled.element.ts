import '@umbraco-cms/backoffice/components';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UmbActionExecutedEvent } from '@umbraco-cms/backoffice/event';
import type { ManifestEntityAction } from '@umbraco-cms/backoffice/entity-action';
import type { LoginRule } from '../../models/index.js';
import { UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT } from '../../workspaces/rule-editor-workspace.context.js';
import { UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT } from '../rule-workspace.context.js';
import type { LeLøginScreenToggleRuleEnabledEntityAction } from './toggle-rule-enabled-entity-action.js';
import { LeLøginScreenRuleRepository } from '../rule.repository.js';

export class LeLøginScreenToggleRuleEnabledElement extends UmbElementMixin(HTMLElement) {
	#api: LeLøginScreenToggleRuleEnabledEntityAction | undefined;
	#unique: string | null = null;
	#enabled: boolean | null = null;
	#rules: Array<LoginRule> = [];
	#menuItem: HTMLElement;
	#icon: Element;

	manifest?: ManifestEntityAction;
	entityType?: string | null;

	get unique() {
		return this.#unique;
	}
	set unique(value: string | null | undefined) {
		this.#unique = value ?? null;
		const match = this.#rules.find((r) => r.id === this.#unique);
		if (match !== undefined) {
			this.#enabled = match.enabled;
			this.#update();
		} else {
			void this.#loadEnabled();
		}
	}

	set api(value: LeLøginScreenToggleRuleEnabledEntityAction | undefined) {
		this.#api = value;
	}

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		shadow.innerHTML = `<uui-menu-item><umb-icon slot="icon" name="icon-check"></umb-icon></uui-menu-item>`;
		const menuItem = shadow.querySelector('uui-menu-item');
		const icon = shadow.querySelector('umb-icon');
		if (!(menuItem instanceof HTMLElement) || icon === null) {
			throw new Error('Toggle rule menu item template is missing its menu item or icon.');
		}
		this.#menuItem = menuItem;
		this.#icon = icon;

		this.#menuItem.addEventListener('click-label', (e) => {
			e.stopPropagation();
			void this.#api?.execute().then(() => this.dispatchEvent(new UmbActionExecutedEvent()));
		});
		this.#menuItem.addEventListener('click', (e) => {
			e.stopPropagation();
		});

		this.consumeContext(UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT, (ctx) => {
			if (!ctx) return;
			this.observe(ctx.currentRule, (rule) => {
				if (rule !== null && rule !== undefined) {
					this.#enabled = rule.enabled;
					this.#update();
				}
			});
		});

		this.consumeContext(UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT, (ctx) => {
			if (!ctx) return;
			this.observe(ctx.rules, (rules) => {
				this.#rules = rules ?? [];
				const match = this.#rules.find((r) => r.id === this.#unique);
				if (match !== undefined) {
					this.#enabled = match.enabled;
					this.#update();
				}
			});
		});
	}

	override connectedCallback() {
		super.connectedCallback();
		this.#update();
	}

	/**
	 * In the sidebar tree neither the rule list nor the rule editor is in scope, so the rule's
	 * current state is read from the server to show the right icon.
	 */
	async #loadEnabled() {
		const unique = this.#unique;
		if (unique === null || this.#enabled !== null) return;
		const { data } = await new LeLøginScreenRuleRepository(this).requestByUnique(unique);
		if (data === undefined || unique !== this.#unique || this.#enabled !== null) return;
		this.#enabled = data.enabled;
		this.#update();
	}

	#update() {
		this.#menuItem.setAttribute('label', this.localize.term('loginScreen_toggleEnabled'));
		this.#icon.setAttribute('name', this.#enabled === true ? 'icon-block' : 'icon-check');
	}
}

customElements.define('login-screen-toggle-rule-enabled', LeLøginScreenToggleRuleEnabledElement);
export default LeLøginScreenToggleRuleEnabledElement;
