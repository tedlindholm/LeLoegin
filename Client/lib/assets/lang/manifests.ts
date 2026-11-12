import type { ManifestLocalization } from '@umbraco-cms/backoffice/localization';

const localisationManifests = [
	{
		type: 'localization',
		alias: 'LeLøgin.Localization.En',
		weight: -110,
		name: 'English',
		meta: {
			culture: 'en'
		},
		js: () => import('./en.js')
	},
	{
		type: 'localization',
		alias: 'LeLøgin.Localization.Da',
		weight: -110,
		name: 'Dansk',
		meta: {
			culture: 'da'
		},
		js: () => import('./da.js')
	},
	{
		type: 'localization',
		alias: 'LeLøgin.Localization.Sv',
		weight: -110,
		name: 'Svenska',
		meta: {
			culture: 'sv'
		},
		js: () => import('./sv.js')
	},
	{
		type: 'localization',
		alias: 'LeLøgin.Localization.Nb_NO',
		weight: -110,
		name: 'Norsk',
		meta: {
			culture: 'nb-no'
		},
		js: () => import('./nb-no.js')
	}
] satisfies ReadonlyArray<ManifestLocalization>;

/** Localisation extensions for every culture Le Løgin ships (en, da, sv, nb-no). */
export const manifests = [...localisationManifests];
