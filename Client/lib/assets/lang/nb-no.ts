/**
 * Language Alias: nb-no
 * Language Int Name: Norwegian Bokmål (NO)
 * Language Local Name: norsk bokmål (NO)
 * Language LCID: 20
 * Language Culture: nb-NO
 */
import type { LeLøginScreenLocalisationDictionary } from './types.js';

export default {
	user: {
		'permissionsEntityGroup_login-screen': 'Le Løgin'
	},
	loginScreen: {
		sectionName: 'Påloggingsskjerm',
		overview: 'Oversikt',
		assets: 'Bilder',
		assetTreeDeleteMessage: 'Er du sikker på at du vil slette <strong>%0%</strong>?',
		permissionManageLabel: 'Administrer Le Løgin',
		permissionManageDescription: 'Tillater tilgang til å se og bruke Le Løgin i Innstillinger.',
		backToAssets: 'Tilbake til bilder',
		loadingAssets: 'Laster inn bilder...',
		assetsEmpty: 'Ingen bilder ennå. Opprett ett for å komme i gang.',
		assetsWelcomeImages: 'Velkomstbilder',
		assetsWelcomeImagesEmpty: 'Ingen velkomstbilder ennå.',
		assetsLogos: 'Logoer',
		assetsLogosEmpty: 'Ingen logobilder ennå.',
		loadingAsset: 'Laster inn bilde...',
		noActiveImage:
			'Ingen aktiv påloggingsbilde. Legg til en regel uten betingelser som catch-all for å komme i gang.',
		loadingActiveImage: 'Laster inn aktivt bilde...',
		activeScreen: 'Aktiv skjerm',
		activeImageLoadFailed: 'Kunne ikke laste inn forhåndsvisningen av det aktive bildet.',
		assetNotFound: 'Det forespurte bildet ble ikke funnet.',
		assetSaveFailed: 'Kunne ikke lagre bildet.',
		assetSaved: 'Bildet er lagret.',
		assetNameRequired: 'Navn er påkrevd.',
		greetingText: 'Helsingstekst',
		greetingTextPlaceholder: 'Valgfri hilsen vist på påloggingsskjermen',
		logoAsset: 'Logobilde',
		logoAssetNone: 'Ingen logo',
		noLogoAssetAvailable: 'Ingen logobilder ennå.',
		zoomIn: 'Zoom inn',
		zoomOut: 'Zoom ut',
		createAssetLogo: 'Logo',
		uploadAssetHelper:
			'Legg til et bilde i Le Løgin-biblioteket. Dra en fil hit, eller bla fra enheten din.',
		selectedFile: 'Valgt fil',
		uploadSelectionInvalid: 'Det valgte elementet kunne ikke lastes opp.',
		uploadImagesOnly: 'Bare bildefiler er tillatt.',
		uploadFailed: 'Opplastingen mislyktes. Vennligst prøv igjen.',
		uploadSuccess: 'Ressursen ble lastet opp.',
		createRule: 'Opprett regel',
		rulesEmpty: 'Ingen regler ennå. Opprett en for å begynne å matche bilder.',
		ruleNotFound: 'Den forespurte regelen ble ikke funnet.',
		priority: 'Prioritet',
		priorityHelper: 'Lavere tall evalueres først.',
		rules: 'Regler',
		rulesHelper:
			'Regler evalueres i prioritetsrekkefølge. Den første regelen som matcher, vinner. En regel uten betingelser fungerer som catch-all.',
		rulesNeedAssets: 'Last opp minst ett bakgrunnsbilde før du oppretter regler.',
		ruleName: 'Regelnavn',
		addCondition: 'Legg til betingelse',
		removeCondition: 'Fjern betingelse',
		conditionMatchLabel: 'Match',
		conditionMatchAll: 'Alle betingelser',
		conditionMatchAny: 'Enhver betingelse',
		conditionEmptyState: 'Ingen betingelser er definert. Legg til en betingelse for å komme i gang.',
		conditionValuePlaceholder: 'Verdi',
		fieldWeekday: 'Ukedag',
		fieldMonth: 'Måned',
		operatorIs: 'er',
		operatorIsNot: 'er ikke',
		operatorIn: 'er en av',
		operatorNotIn: 'er ikke en av',
		operatorBetween: 'er mellom',
		operatorNotBetween: 'er ikke mellom',
		ruleTreeDeleteMessage: 'Er du sikker på at du vil slette <strong>%0%</strong>?',
		ruleSaveFailed: 'Kunne ikke lagre regelen.',
		ruleCreated: 'Regel opprettet.',
		ruleSaved: 'Regel lagret.',
		ruleDeleteFailed: 'Kunne ikke slette regelen.',
		validationRuleName: 'Regelnavn er påkrevd.',
		validationRuleAsset: 'Et bilde er påkrevd.',
		validationConditionValue: 'Hver betingelse må ha en verdi.',
		toggleEnabled: 'Aktiver / Deaktiver'
	},
} satisfies LeLøginScreenLocalisationDictionary;
