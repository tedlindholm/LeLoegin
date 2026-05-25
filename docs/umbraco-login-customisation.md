# Umbraco Backoffice Login Customisation

Reference: [Umbraco Login Docs](https://docs.umbraco.com/umbraco-cms/fundamentals/backoffice/login)
Source: [auth-layout.element.ts](https://github.com/umbraco/Umbraco-CMS/blob/v16/dev/src/Umbraco.Web.UI.Login/src/components/layouts/auth-layout.element.ts)

## Current Le Løgin implementation

The package now delivers every login-screen customisation **server-side**. There is no `appEntryPoint` and no client-side runtime on the login page.

- [`Client/public/umbraco-package.json`](../Client/public/umbraco-package.json) sets `allowPublicAccess: true` and ships a **single** entry point — a `backofficeEntryPoint` for the authenticated UI. The login page itself runs no Le Løgin JavaScript.
- Background image: [`LeLøginBackgroundMiddleware`](../Core/Runtime/LoginBackgroundMiddleware.cs) intercepts `GET /umbraco/management/api/v1/security/back-office/graphics/login-background`. When a Le Løgin background asset matches the current request context (host, weekday, month, date rules), it 302-redirects to the ImageSharp-processed public URL so focal-point and zoom crops are preserved. No match → falls through to Umbraco's `BackOfficeGraphicsController` and the bundled default is served.
- Logo: [`LeLøginLogoMiddleware`](../Core/Runtime/LoginLogoMiddleware.cs) intercepts both `/login-logo` and `/login-logo-alternative` and streams the configured logo from `App_Data/LeLøgin/assets/` (path-confined for safety, `X-Content-Type-Options: nosniff`). The logo is configured per background asset — the active background's `LogoAssetId` resolves the logo. Both endpoints return the same bytes; Le Løgin has a single logo concept, not a primary/alternative split.
- Greeting text: [`LeLøginPackageManifestReader`](../Core/Runtime/LoginPackageManifestReader.cs) synthesises a `PackageManifest` exposing one `localization` extension per supported culture, with `meta.localizations.auth.greeting0..6` and `meta.localizations.login.greeting0..6` set to the configured greeting. Weight `0` (lower than Umbraco's `100`) ensures the override wins. Cultures: `en`, `en-us`, `da`, `sv`, `fi`, `nb`, `nb-no`. If no greeting is configured the reader returns an empty list and Umbraco's defaults render.
- Cache invalidation: Umbraco's `PackageManifestService` caches the aggregated manifest (30 days in production). [`LeLøginPackageManifestCacheInvalidator`](../Core/Runtime/LoginPackageManifestCacheInvalidator.cs) clears the cache by key (`"PackageManifestService-PackageManifests"`) and is called from every mutating endpoint so editor changes apply immediately.
- DI registration lives in [`LeLøginScreenComposer`](../Core/LoginScreenComposer.cs). The two middlewares are added to `UmbracoPipelineOptions` as a `PreRouting` filter — placement before endpoint routing is what guarantees they intercept before `BackOfficeGraphicsController` is dispatched.
- The backoffice Overview dashboard mirrors Umbraco's auth-panel image treatment (curve overlays, logo placement) so editors preview something close to the real login screen.
- No custom login stylesheet is injected. There is no `--umb-login-image` CSS variable. Every visible asset is replaced at the source endpoint.

### Why server-side

The earlier client-side approach (`appEntryPoint` → fetch `/runtime/active` → set CSS variable + register a localisation extension at runtime) was removed because the localisation registration raced Umbraco's localisation registry on warm-cache loads. A top-level `await` inside the dynamically-imported greeting module blocked the registry's `Promise.all`, which in turn timed out the login SPA's `#waitForLocalization()` and left the form DOM un-initialised on the second login. The server-side replacements remove the race entirely: the browser receives the greeting via the same manifest fetch that already loads every other public extension, and the image endpoints are answered by Le Løgin before Umbraco's defaults ever ship.

## Customisation mechanisms

| Mechanism        | How                                                                           | Where                                         |
| ---------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| Background image | `appsettings.json` → `Umbraco:CMS:Content:LoginBackgroundImage`               | Path relative to `/wwwroot/umbraco/`          |
| Logo             | `LoginLogoImage` + `LoginLogoImageAlternative`                                | Same section                                  |
| Password reset   | `Umbraco:CMS:Security:AllowPasswordReset` + SMTP config                       | `appsettings.json`                            |
| Custom CSS       | `appEntryPoint` manifest loads a JS file that injects a `<link>` stylesheet   | `App_Plugins/` with `allowPublicAccess: true` |
| Greeting text    | `localization` manifest overriding `auth.greeting0..6` and `auth.instruction` | JS module exporting translation keys          |
| Timeout screen   | `login.greeting0..6` keys — `/umbraco/logout` uses `umb-auth-view` (backoffice package) which reads the `login` namespace, not `auth` | Same `localization` extension mechanism |

## Available CSS custom properties

From the `umb-auth-layout` element:

| Property                                 | Default              |
| ---------------------------------------- | -------------------- |
| `--umb-login-background`                 | `#f4f4f4`            |
| `--umb-login-primary-color`              | `#283a97`            |
| `--umb-login-text-color`                 | `#000`               |
| `--umb-login-header-font-size`           | `3rem`               |
| `--umb-login-header-font-size-large`     | `4rem`               |
| `--umb-login-header-secondary-font-size` | `2.4rem`             |
| `--umb-login-image`                      | background-image URL |
| `--umb-login-image-display`              | `flex` / `block`     |
| `--umb-login-image-border-radius`        | `38px`               |
| `--umb-login-content-background`         | `none`               |
| `--umb-login-content-display`            | `flex`               |
| `--umb-login-content-width`              | `100%`               |
| `--umb-login-content-height`             | `100%`               |
| `--umb-login-content-border-radius`      | `0`                  |
| `--umb-login-align-items`                | `unset`              |
| `--umb-login-button-border-radius`       | `45px`               |
| `--umb-login-curves-color`               | `#f5c1bc`            |
| `--umb-login-curves-display`             | `inline`             |
| `--umb-logo-width`                       | `auto`               |
| `--umb-logo-height`                      | `55px`               |
| `--umb-logo-top`                         | `24px`               |
| `--umb-logo-left`                        | `24px`               |
| `--umb-logo-display`                     | `block`              |

## Manifest example

```json
{
	"alias": "le-løgin.extensions",
	"name": "Le Løgin extensions",
	"version": "1.0.0",
	"allowPublicAccess": true,
	"extensions": [
		{
			"type": "appEntryPoint",
			"alias": "LeLøginRuntimeCustomisation",
			"name": "Le Løgin runtime customisation",
			"js": "/App_Plugins/le-løgin/runtime-customisation.js"
		}
	]
}
```

## CSS injection pattern

```js
const cssPath = '/App_Plugins/le-løgin/runtime-customisation.css'
const existing = document.querySelector('link[data-login-custom-style="true"]')

if (!existing) {
	fetch(cssPath)
		.then((res) => res.arrayBuffer())
		.then((buf) => crypto.subtle.digest('SHA-256', buf))
		.then((hash) => {
			const hex = Array.from(new Uint8Array(hash), (b) =>
				b.toString(16).padStart(2, '0')
			)
				.join('')
				.slice(0, 8)
			const link = document.createElement('link')
			link.rel = 'stylesheet'
			link.href = `${cssPath}?v=${hex}`
			link.setAttribute('data-login-custom-style', 'true')
			document.head.appendChild(link)
		})
}
```

## Greeting localisation

Override via a JS module registered as a `localization` extension:

```js
export default {
	auth: {
		instruction: 'Log in again to continue',
		greeting0: 'Sunday',
		greeting1: 'Monday',
		greeting2: 'Tuesday',
		greeting3: 'Wednesday',
		greeting4: 'Thursday',
		greeting5: 'Friday',
		greeting6: 'Saturday',
	},
}
```

The two screens use different components and different namespaces:
- `/umbraco/login` → `umb-login-page` (login package) → keys under `auth` (`auth_greeting0–6`)
- `/umbraco/logout` → `umb-auth-view` (backoffice package) → keys under `login` (`login_greeting0–6`)

Both namespaces must be overridden to cover both screens.

## Two-factor authentication

Reference: [Umbraco 2FA Docs](https://docs.umbraco.com/umbraco-cms/reference/security/two-factor-authentication)

Umbraco supports pluggable two-factor authentication for both backoffice users and website members via the `ITwoFactorProvider` interface. Key points:

- Register a provider by implementing `ITwoFactorProvider` and wiring it through a composer using `BackOfficeIdentityBuilder.AddTwoFactorProvider<T>()` (users) or `MemberIdentityBuilder.AddTwoFactorProvider<T>()` (members)
- The provider appears on the login screen as an `mfaLoginProvider` extension registered in `umbraco-package.json` with a `forProviderName` matching the provider's `ProviderName`
- The default login flow presents a numeric one-time-code input after username/password; customise the activation screen via `mfaActivationProvider` with a custom `element`, or the login screen via `IBackOfficeTwoFactorOptions.GetTwoFactorView()`
- Notifications `UserTwoFactorRequestedNotification` / `MemberTwoFactorRequestedNotification` are published when 2FA is requested, enabling e-mail or SMS one-time codes as an alternative to app-based TOTP
- Users can have multiple 2FA providers enabled simultaneously; the login screen shows a provider picker in that case
