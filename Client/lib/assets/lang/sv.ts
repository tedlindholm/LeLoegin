/**
 * Language Alias: sv
 * Language Int Name: Swedish
 * Language Local Name: Svenska
 * Language Culture: sv
 */
import type { LeLøginScreenLocalisationDictionary } from './types.js';

export default {
	user: {
		'permissionsEntityGroup_login-screen': 'Le Løgin'
	},
	loginScreen: {
		sectionName: 'Inloggningsskärm',
		overview: 'Översikt',
		assets: 'Bilder',
		assetTreeDeleteMessage: 'Är du säker på att du vill ta bort <strong>%0%</strong>?',
		permissionManageLabel: 'Hantera Le Løgin',
		permissionManageDescription: 'Tillåter åtkomst att se och använda Le Løgin i Inställningar.',
		backToAssets: 'Tillbaka till bilder',
		loadingAssets: 'Läser in bilder...',
		assetsEmpty: 'Inga bilder ännu. Skapa en för att komma igång.',
		assetsWelcomeImages: 'Välkomstbilder',
		assetsWelcomeImagesEmpty: 'Inga välkomstbilder ännu.',
		assetsLogos: 'Logotyper',
		assetsLogosEmpty: 'Inga logotypbilder ännu.',
		noActiveImage:
			'Ingen aktiv inloggningsbild. Lägg till en regel utan villkor som catch-all för att komma igång.',
		goToRules: 'Hantera regler',
		loadingActiveImage: 'Läser in aktiv bild...',
		activeScreen: 'Aktiv skärm',
		activeImageLoadFailed: 'Det gick inte att läsa in förhandsgranskningen av den aktiva bilden.',
		loadingAsset: 'Läser in bild...',
		assetNotFound: 'Den begärda bilden kunde inte hittas.',
		assetSaveFailed: 'Kunde inte spara bilden.',
		assetSaved: 'Bilden sparades.',
		assetNameRequired: 'Namn krävs.',
		greetingText: 'Hälsningstext',
		greetingTextPlaceholder: 'Valfri hälsning som visas på inloggningsskärmen',
		logoAsset: 'Logotypbild',
		logoAssetNone: 'Ingen logotyp',
		noLogoAssetAvailable: 'Inga logotypbilder ännu.',
		zoomIn: 'Zooma in',
		zoomOut: 'Zooma ut',
		createAssetLogo: 'Logotyp',
		uploadAssetHelper:
			'Lägg till en bild i Le Løgin-biblioteket. Dra in en fil eller bläddra från din enhet.',
		selectedFile: 'Vald fil',
		uploadSelectionInvalid: 'Det valda objektet kunde inte laddas upp.',
		uploadImagesOnly: 'Endast bildfiler är tillåtna.',
		uploadFailed: 'Uppladdningen misslyckades. Försök igen.',
		uploadSuccess: 'Tillgången laddades upp.',
		createRule: 'Skapa regel',
		rulesEmpty: 'Inga regler ännu. Skapa en för att börja matcha bilder.',
		ruleNotFound: 'Den begärda regeln kunde inte hittas.',
		priority: 'Prioritet',
		priorityHelper: 'Lägre tal utvärderas först.',
		rules: 'Regler',
		rulesHelper:
			'Regler utvärderas i prioritetsordning. Den första matchande regeln vinner. En regel utan villkor fungerar som catch-all.',
		rulesNeedAssets: 'Ladda upp minst en bakgrundsbild innan du skapar regler.',
		ruleName: 'Regelnamn',
		addCondition: 'Lägg till villkor',
		removeCondition: 'Ta bort villkor',
		conditionMatchLabel: 'Matcha',
		conditionMatchAll: 'Alla villkor',
		conditionMatchAny: 'Vilket villkor som helst',
		conditionEmptyState: 'Inga villkor är definierade. Lägg till ett villkor för att komma igång.',
		fieldWeekday: 'Veckodag',
		fieldMonth: 'Månad',
		operatorIs: 'Är',
		operatorIsNot: 'Är inte',
		operatorIn: 'Är en av',
		operatorNotIn: 'Är inte en av',
		operatorBetween: 'Är mellan',
		operatorNotBetween: 'Är inte mellan',
		conditionValuePlaceholder: 'Värde',
		ruleTreeDeleteMessage: 'Är du säker på att du vill ta bort <strong>%0%</strong>?',
		ruleSaveFailed: 'Kunde inte spara regeln.',
		ruleCreated: 'Regel skapad.',
		ruleSaved: 'Regel sparad.',
		ruleDeleteFailed: 'Kunde inte ta bort regeln.',
		validationRuleName: 'Regelnamn krävs.',
		validationRuleAsset: 'En bild krävs.',
		validationConditionValue: 'Varje villkor måste ha ett värde.',
		toggleEnabled: 'Aktivera / Inaktivera'
	}
} satisfies LeLøginScreenLocalisationDictionary;
