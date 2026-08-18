import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import {
	umbLocalizationRegistry,
	type ManifestLocalization
} from '@umbraco-cms/backoffice/localization';

/**
 * The login-page entry, loaded by the package's Razor login shell.
 *
 * Everything here runs before Umbraco's login bundle is imported on the last line, so the very
 * first `umb-auth` render already sees the configured greeting. A following module script does
 * not wait for a preceding module's top-level await, so that bundle cannot be left to an
 * ordinary script tag — this entry has to import it.
 */
const {
	leLoginGreetingModule: greetingModulePath,
	leLoginCulture: culture,
	umbracoLoginModule: loginScriptUrl
} = document.documentElement.dataset;

if (greetingModulePath && culture) {
	try {
		const greetingModule = await import(greetingModulePath);

		// Only Le Løgin's own manifest. Umbraco's slim login controller registers its core
		// manifests once after umb-auth connects; pre-registering them duplicates aliases.
		umbExtensionsRegistry.registerMany([
			{
				type: 'localization',
				alias: 'LeLøgin.Greeting.LoginBootstrap',
				name: 'Le Løgin login greeting',
				weight: 0,
				meta: { culture },
				js: () => Promise.resolve(greetingModule)
			} satisfies ManifestLocalization
		]);
		await umbLocalizationRegistry.loadLanguage(culture);
	} catch (error) {
		// The greeting is an enhancement. An unavailable endpoint must never prevent sign-in.
		console.warn('Le Løgin: pre-login greeting unavailable; using Umbraco default.', error);
	}
}

if (loginScriptUrl) {
	await import(loginScriptUrl);
}
