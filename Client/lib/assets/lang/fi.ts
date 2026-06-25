/**
 * Language Alias: fi
 * Language Int Name: Finnish
 * Language Local Name: suomi
 * Language Culture: fi
 */
import type { LeLøginScreenLocalisationDictionary } from './types.js';

export default {
	user: {
		'permissionsEntityGroup_login-screen': 'Le Løgin'
	},
	loginScreen: {
		sectionName: 'Kirjautumisnäyttö',
		overview: 'Yleiskatsaus',
		assets: 'Kuvat',
		assetTreeDeleteMessage: 'Haluatko varmasti poistaa kohteen <strong>%0%</strong>?',
		permissionManageLabel: 'Hallitse Le Løginia',
		permissionManageDescription: 'Sallii Le Løginin katselun ja käytön Asetuksissa.',
		backToAssets: 'Takaisin kuviin',
		loadingAssets: 'Ladataan kuvia...',
		assetsEmpty: 'Ei kuvia vielä. Luo sellainen päästäksesi alkuun.',
		assetsWelcomeImages: 'Tervetulokuvat',
		assetsWelcomeImagesEmpty: 'Ei tervetulokuvia vielä.',
		assetsLogos: 'Logot',
		assetsLogosEmpty: 'Ei logo-kuvia vielä.',
		noActiveImage:
			'Ei aktiivista kirjautumiskuvaa. Lisää sääntö ilman ehtoja catch-all-säännöksi aloittaaksesi.',
		goToRules: 'Hallitse sääntöjä',
		loadingActiveImage: 'Ladataan aktiivista kuvaa...',
		activeScreen: 'Aktiivinen näyttö',
		activeImageLoadFailed: 'Aktiivisen kuvan esikatselua ei voitu ladata.',
		loadingAsset: 'Ladataan kuvaa...',
		assetNotFound: 'Pyydettyä kuvaa ei löytynyt.',
		assetSaveFailed: 'Kuvan tallentaminen epäonnistui.',
		assetSaved: 'Kuva tallennettu.',
		assetNameRequired: 'Nimi on pakollinen.',
		greetingText: 'Tervehdysteksti',
		greetingTextPlaceholder: 'Valinnainen tervehdys kirjautumisnäytöllä',
		logoAsset: 'Logo-kuva',
		logoAssetNone: 'Ei logoa',
		noLogoAssetAvailable: 'Ei logo-kuvia vielä.',
		zoomIn: 'Lähennä',
		zoomOut: 'Loitonna',
		createAssetLogo: 'Logo',
		uploadAssetHelper:
			'Lisää kuva Le Løgin -kirjastoon. Vedä tiedosto tähän tai selaa laitteeltasi.',
		selectedFile: 'Valittu tiedosto',
		uploadSelectionInvalid: 'Valittua kohdetta ei voitu ladata.',
		uploadImagesOnly: 'Vain kuvatiedostot ovat sallittuja.',
		uploadFailed: 'Lataus epäonnistui. Yritä uudelleen.',
		uploadSuccess: 'Resurssi ladattiin onnistuneesti.',
		createRule: 'Luo sääntö',
		rulesEmpty: 'Ei sääntöjä vielä. Luo sellainen aloittaaksesi kuvien kohdistamisen.',
		ruleNotFound: 'Pyydettyä sääntöä ei löytynyt.',
		priority: 'Prioriteetti',
		priorityHelper: 'Pienemmät numerot arvioidaan ensin.',
		rules: 'Säännöt',
		rulesHelper:
			'Säännöt arvioidaan prioriteettijärjestyksessä. Ensimmäinen täsmäävä sääntö voittaa. Sääntö ilman ehtoja toimii catch-all-sääntönä.',
		rulesNeedAssets: 'Lataa vähintään yksi taustakuva ennen kuin luot sääntöjä.',
		ruleName: 'Säännön nimi',
		addCondition: 'Lisää ehto',
		removeCondition: 'Poista ehto',
		conditionMatchLabel: 'Täsmäys',
		conditionMatchAll: 'Kaikki ehdot',
		conditionMatchAny: 'Mikä tahansa ehto',
		conditionEmptyState: 'Yhtään ehtoa ei ole määritetty. Lisää ehto päästäksesi alkuun.',
		ruleImagesHint:
			'Valitse useampi kuin yksi kuva näyttääksesi satunnaisen jokaisella kirjautumisella.',
		fieldWeekday: 'Viikonpäivä',
		fieldMonth: 'Kuukausi',
		operatorIs: 'On',
		operatorIsNot: 'Ei ole',
		operatorIn: 'On yksi seuraavista',
		operatorNotIn: 'Ei ole yksi seuraavista',
		operatorBetween: 'On välillä',
		operatorNotBetween: 'Ei ole välillä',
		conditionValuePlaceholder: 'Arvo',
		ruleTreeDeleteMessage: 'Haluatko varmasti poistaa kohteen <strong>%0%</strong>?',
		ruleSaveFailed: 'Säännön tallentaminen epäonnistui.',
		ruleCreated: 'Sääntö luotu.',
		ruleSaved: 'Sääntö tallennettu.',
		ruleDeleteFailed: 'Säännön poistaminen epäonnistui.',
		validationRuleName: 'Säännön nimi on pakollinen.',
		validationRuleAsset: 'Kuva on pakollinen.',
		validationConditionValue: 'Jokaisella ehdolla on oltava arvo.',
		toggleEnabled: 'Ota käyttöön / Poista käytöstä'
	}
} satisfies LeLøginScreenLocalisationDictionary;
