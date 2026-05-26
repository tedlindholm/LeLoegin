/**
 * Language Alias: en
 * Language Int Name: English
 * Language Local Name: English
 * Language LCID:
 * Language Culture: en
 */
import type { UmbLocalizationDictionary } from '@umbraco-cms/backoffice/localization-api';

export const englishDictionary = {
	user: {
		'permissionsEntityGroup_login-screen': 'Le Løgin'
	},
	loginScreen: {
		sectionName: 'Le Løgin',
		overview: 'Overview',
		assets: 'Assets',
		assetTreeDeleteMessage: 'Are you sure you want to delete <strong>%0%</strong>?',
		permissionManageLabel: 'Manage Le Løgin',
		permissionManageDescription: 'Allows access to see and use Le Løgin in Settings.',
		backToAssets: 'Back to assets',
		loadingAssets: 'Loading assets...',
		assetsEmpty: 'No assets yet. Create one to get started.',
		assetsWelcomeImages: 'Welcome images',
		assetsWelcomeImagesEmpty: 'No welcome images yet.',
		assetsLogos: 'Logos',
		assetsLogosEmpty: 'No logo images yet.',
		loadingAsset: 'Loading asset...',
		noActiveImage:
			'No Le Løgin image is active right now. Add a rule without conditions to act as a catch-all.',
		goToRules: 'Manage rules',
		loadingActiveImage: 'Loading active image...',
		activeScreen: 'Active screen',
		activeImageLoadFailed: 'Could not load the active image preview.',
		assetNotFound: 'The requested asset could not be found.',
		assetSaveFailed: 'Could not save the asset.',
		assetSaved: 'Asset saved.',
		assetNameRequired: 'Name is required.',
		greetingText: 'Greeting text',
		greetingTextPlaceholder: 'Optional greeting shown on the login screen',
		logoAsset: 'Logo image',
		logoAssetNone: 'No logo',
		noLogoAssetAvailable: 'No logo images yet.',
		zoomIn: 'Zoom in',
		zoomOut: 'Zoom out',
		createAssetLogo: 'Logo',
		uploadAssetHelper:
			'Add an image to the Le Løgin library. Drag a file here, or browse from your device.',
		selectedFile: 'Selected file',
		uploadSelectionInvalid: 'The selected item could not be uploaded.',
		uploadImagesOnly: 'Only image files are allowed.',
		uploadFailed: 'The upload failed. Please try again.',
		uploadSuccess: 'The asset was uploaded.',
		createRule: 'Create rule',
		rulesEmpty: 'No rules yet. Create one to start matching images.',
		ruleNotFound: 'The requested rule could not be found.',
		priority: 'Priority',
		priorityHelper: 'Lower priority numbers are evaluated first.',
		rules: 'Rules',
		rulesHelper:
			'Rules are evaluated in priority order. The first matching rule wins. A rule with no conditions acts as a catch-all.',
		rulesNeedAssets: 'Upload at least one background image before creating rules.',
		ruleName: 'Rule name',
		addCondition: 'Add condition',
		removeCondition: 'Remove',
		conditionMatchLabel: 'Match',
		conditionMatchAll: 'All conditions',
		conditionMatchAny: 'Any condition',
		conditionEmptyState:
			'No conditions defined. This rule will match every login until you add one.',
		conditionValuePlaceholder: 'Value',
		fieldWeekday: 'Weekday',
		fieldMonth: 'Month',
		operatorIs: 'is',
		operatorIsNot: 'is not',
		operatorIn: 'is one of',
		operatorNotIn: 'is not one of',
		operatorBetween: 'is between',
		operatorNotBetween: 'is not between',
		ruleTreeDeleteMessage: 'Are you sure you want to delete <strong>%0%</strong>?',
		ruleSaveFailed: 'Could not save the rule.',
		ruleCreated: 'Rule created.',
		ruleSaved: 'Rule saved.',
		ruleDeleteFailed: 'Could not delete the rule.',
		validationRuleName: 'Rule name is required.',
		validationRuleAsset: 'An image is required.',
		validationConditionValue: 'Each condition must have a value.',
		toggleEnabled: 'Enable / Disable'
	}
} satisfies UmbLocalizationDictionary;

export default englishDictionary;
