import { createLeLøginScreenManagePermissionCondition } from '../user-permissions/constants.js';

const SETTINGS_SECTION_ALIAS = 'Umb.Section.Settings';

export const LOGIN_SCREEN_SETTINGS_MENU_ALIAS = 'LeLøgin.Menu.Settings';

const manageLeLøginScreenCondition = createLeLøginScreenManagePermissionCondition();

const menuManifest: UmbExtensionManifest = {
	type: 'menu',
	alias: LOGIN_SCREEN_SETTINGS_MENU_ALIAS,
	name: 'Login Screen Settings Menu'
};

const sidebarManifest: UmbExtensionManifest = {
	type: 'sectionSidebarApp',
	kind: 'menu',
	alias: 'LeLøgin.SectionSidebarApp.Settings',
	name: 'Login Screen Settings Sidebar',
	weight: 200,
	meta: {
		label: 'Le Løgin',
		menu: LOGIN_SCREEN_SETTINGS_MENU_ALIAS
	},
	conditions: [
		{
			alias: 'Umb.Condition.SectionAlias',
			match: SETTINGS_SECTION_ALIAS
		},
		manageLeLøginScreenCondition
	]
};

const overviewMenuItem: UmbExtensionManifest = {
	type: 'menuItem',
	alias: 'LeLøgin.MenuItem.Overview',
	name: 'Login Screen Overview Settings Menu Item',
	weight: 100,
	meta: {
		label: '#loginScreen_overview',
		icon: 'icon-dashboard',
		entityType: 'login-screen-root',
		menus: [LOGIN_SCREEN_SETTINGS_MENU_ALIAS]
	},
	conditions: [manageLeLøginScreenCondition]
};

export const manifests: Array<UmbExtensionManifest> = [
	menuManifest,
	sidebarManifest,
	overviewMenuItem
];
