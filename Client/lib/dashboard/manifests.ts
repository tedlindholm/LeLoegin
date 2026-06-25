import type { ManifestDashboard } from '@umbraco-cms/backoffice/dashboard';
import { createLeLøginScreenManagePermissionCondition } from '../user-permissions/constants.js';

const manageLeLøginScreenCondition = createLeLøginScreenManagePermissionCondition();

const overviewDashboardManifest = {
	type: 'dashboard',
	alias: 'LeLøgin.Dashboard.Overview',
	name: 'Login Screen Overview Dashboard',
	element: () => import('./overview-dashboard.element.js'),
	weight: 100,
	meta: {
		label: '#loginScreen_overview',
		pathname: 'login-screen-overview'
	},
	conditions: [
		{
			alias: 'Umb.Condition.SectionAlias',
			match: 'Umb.Section.Settings'
		},
		manageLeLøginScreenCondition
	]
} satisfies ManifestDashboard;

export const manifests = [overviewDashboardManifest] satisfies ReadonlyArray<ManifestDashboard>;
