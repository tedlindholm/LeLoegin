/**
 * Language Alias: da
 * Language Int Name: Danish
 * Language Local Name: dansk
 * Language Culture: da
 */
import type { LeLøginScreenLocalisationDictionary } from './types.js';

export default {
	user: {
		'permissionsEntityGroup_login-screen': 'Le Løgin'
	},
	loginScreen: {
		sectionName: 'Login-skærm',
		overview: 'Overblik',
		assets: 'Billeder',
		assetTreeDeleteMessage: 'Er du sikker på, at du vil slette <strong>%0%</strong>?',
		permissionManageLabel: 'Administrér Le Løgin',
		permissionManageDescription: 'Tillader adgang til at se og bruge Le Løgin i Indstillinger.',
		backToAssets: 'Tilbage til billeder',
		loadingAssets: 'Indlæser billeder...',
		assetsEmpty: 'Ingen billeder endnu. Opret et for at komme i gang.',
		assetsWelcomeImages: 'Velkomstbilleder',
		assetsWelcomeImagesEmpty: 'Ingen velkomstbilleder endnu.',
		assetsLogos: 'Logoer',
		assetsLogosEmpty: 'Ingen logo-billeder endnu.',
		noActiveImage:
			'Intet aktivt login-skærmbillede. Tilføj en regel uden betingelser som catch-all for at komme i gang.',
		goToRules: 'Administrer regler',
		loadingActiveImage: 'Indlæser aktivt billede...',
		activeScreen: 'Aktivt skærmbillede',
		activeImageLoadFailed: 'Kunne ikke indlæse forhåndsvisningen af det aktive billede.',
		loadingAsset: 'Indlæser billede...',
		assetNotFound: 'Det ønskede billede blev ikke fundet.',
		assetSaveFailed: 'Kunne ikke gemme billedet.',
		assetSaved: 'Billedet er gemt.',
		assetNameRequired: 'Navn er påkrævet.',
		greetingText: 'Hilsentekst',
		greetingTextPlaceholder: 'Valgfri hilsen vist på login-skærmen',
		logoAsset: 'Logo-billede',
		logoAssetNone: 'Intet logo',
		noLogoAssetAvailable: 'Ingen logo-billeder endnu.',
		zoomIn: 'Zoom ind',
		zoomOut: 'Zoom ud',
		createAssetLogo: 'Logo',
		uploadAssetHelper:
			'Føj et billede til Le Løgin-biblioteket. Træk en fil hertil, eller vælg fra din enhed.',
		selectedFile: 'Valgt fil',
		uploadSelectionInvalid: 'Det valgte element kunne ikke uploades.',
		uploadImagesOnly: 'Kun billedfiler er tilladt.',
		uploadFailed: 'Upload mislykkedes. Prøv venligst igen.',
		uploadSuccess: 'Aktivet blev uploadet.',
		createRule: 'Opret regel',
		rulesEmpty: 'Ingen regler endnu. Opret en for at begynde at matche billeder.',
		ruleNotFound: 'Den ønskede regel blev ikke fundet.',
		priority: 'Prioritet',
		priorityHelper: 'Lavere tal evalueres først.',
		rules: 'Regler',
		rulesHelper:
			'Regler evalueres i prioritetsrækkefølge. Den første regel, der matcher, vinder. En regel uden betingelser fungerer som catch-all.',
		rulesNeedAssets: 'Upload mindst ét baggrundsbillede, før du opretter regler.',
		ruleName: 'Regelnavn',
		addCondition: 'Tilføj betingelse',
		removeCondition: 'Fjern betingelse',
		conditionMatchLabel: 'Match',
		conditionMatchAll: 'Alle betingelser',
		conditionMatchAny: 'Enhver betingelse',
		conditionEmptyState:
			'Ingen betingelser er defineret. Tilføj en betingelse for at komme i gang.',
		fieldWeekday: 'Ugedag',
		fieldMonth: 'Måned',
		operatorIs: 'Er',
		operatorIsNot: 'Er ikke',
		operatorIn: 'Er en af',
		operatorNotIn: 'Er ikke en af',
		operatorBetween: 'Er mellem',
		operatorNotBetween: 'Er ikke mellem',
		conditionValuePlaceholder: 'Værdi',
		ruleTreeDeleteMessage: 'Er du sikker på, at du vil slette <strong>%0%</strong>?',
		ruleSaveFailed: 'Kunne ikke gemme reglen.',
		ruleCreated: 'Regel oprettet.',
		ruleSaved: 'Regel gemt.',
		ruleDeleteFailed: 'Kunne ikke slette reglen.',
		validationRuleName: 'Regelnavn er påkrævet.',
		validationRuleAsset: 'Et billede er påkrævet.',
		validationConditionValue: 'Hver betingelse skal have en værdi.',
		toggleEnabled: 'Aktivér / Deaktivér'
	}
} satisfies LeLøginScreenLocalisationDictionary;
