# Umbraco Backoffice Login Customisation

Reference: [Umbraco Login Docs](https://docs.umbraco.com/umbraco-cms/fundamentals/backoffice/login)
Source: [umb-auth-view.element.ts](https://github.com/umbraco/Umbraco-CMS/blob/release-18.1.0/src/Umbraco.Web.UI.Client/src/packages/core/auth/components/umb-auth-view.element.ts) (pinned; re-pin on each Umbraco major)

## Current Le Løgin implementation

The package delivers login-screen customisation without a public `appEntryPoint`. Images and
logos are served server-side; a package-owned Razor login shell loads the package's single client
entry before Umbraco's own login bundle so the first greeting render is already resolved.

- [`Client/public/umbraco-package.json`](../Client/public/umbraco-package.json) sets `allowPublicAccess: true` and registers one `backofficeEntryPoint` pointing at `backoffice.js`, built from [`Client/lib/backoffice-entry.ts`](../Client/lib/backoffice-entry.ts). [`umbraco/UmbracoLogin/Index.cshtml`](../umbraco/UmbracoLogin/Index.cshtml) is a package Razor override, not an extension entry point; it loads `login.js`, built from [`Client/lib/login-bootstrap.ts`](../Client/lib/login-bootstrap.ts), in place of Umbraco's own `login.js` tag. The two entries are separate builds so neither page downloads the other's code, and neither is reachable from the other.
- Background image: [`LeLøginBackgroundMiddleware`](../Core/Runtime/LoginBackgroundMiddleware.cs) intercepts `GET /umbraco/management/api/v1/security/back-office/graphics/login-background`. When a Le Løgin background asset matches the current request context (host, weekday, month, date rules), it 302-redirects to the ImageSharp-processed public URL so focal-point and zoom crops are preserved. No match → falls through to Umbraco's `BackOfficeGraphicsController` and the bundled default is served.
- Logo: [`LeLøginLogoMiddleware`](../Core/Runtime/LoginLogoMiddleware.cs) intercepts both `/login-logo` and `/login-logo-alternative` and streams the configured logo from `App_Data/LeLøgin/assets/` (path-confined for safety, `X-Content-Type-Options: nosniff`). The logo is configured per background asset — the active background's `LogoAssetId` resolves the logo. Both endpoints return the same bytes; Le Løgin has a single logo concept, not a primary/alternative split.
- Greeting text: `RuntimeController.GreetingModule` resolves the active asset per request and serves `export default { login: { greeting0..6 } }` with `Cache-Control: no-store`. The login entry registers that module, loads the culture named by `data-le-login-culture`, and only then imports Umbraco's cache-busted `login.js`. It must do that import itself: a following module script does not wait for a preceding module's top-level await, so an ordinary script tag would let Umbraco connect `umb-auth` while localisation was still loading. The first `<umb-auth>` render therefore sees the configured greeting instead of briefly showing Umbraco's default. If the module cannot be loaded, the bootstrap logs a warning and starts the normal Umbraco login flow. Only the `login` namespace is emitted: in Umbraco 18 both the login page and the logout view read `login_greeting*`, and `auth_greeting*` is deprecated for removal in v20 ([#20082](https://github.com/umbraco/Umbraco-CMS/issues/20082)). If no greeting is configured the module exports an empty object and Umbraco's defaults render.
- Cache invalidation: **none, by design.** Greeting freshness — asset swaps, weekday/month rule flips, and multi-instance hosting — comes entirely from the module endpoint resolving per request. Random rules are the one exception: which image a multi-image rule resolves to is pinned by the render token (see below), not re-drawn per request. Le Løgin never clears or mirrors the keys of caches it does not own (AGENTS.md Backend Key Rule 9, enforced by `ArchitectureRuleTests`).
- DI registration lives in [`LeLøginScreenComposer`](../Core/LoginScreenComposer.cs). The two middlewares are added to `UmbracoPipelineOptions` as a `PreRouting` filter — placement before endpoint routing is what guarantees they intercept before `BackOfficeGraphicsController` is dispatched.
- The backoffice Overview dashboard mirrors Umbraco's auth-panel image treatment (curve overlays, logo placement) so editors preview something close to the real login screen.
- No custom login stylesheet is injected, and Le Løgin sets none of the `--umb-login-*` CSS variables. They do exist — `umb-auth-view` resolves its background as `var(--umb-login-image, var(--image))` — but the package deliberately does not use them: every visible asset is replaced at the source endpoint instead, so the customisation works whichever shell rendered the screen.

### Why server-side

The earlier client-side approach (`appEntryPoint` → fetch `/runtime/active` → set CSS variable + register a localisation extension at runtime) was removed because the localisation registration raced Umbraco's localisation registry on warm-cache loads. A top-level `await` inside the dynamically-imported greeting module blocked the registry's `Promise.all`, which in turn timed out the login SPA's `#waitForLocalization()` and left the form DOM un-initialised on the second login. The Razor bootstrap avoids that late registration: it completes localisation before `login.js` defines and connects `<umb-auth>`.

The greeting module served by `RuntimeController.GreetingModule` contains no top-level `await` — the server does all resolution before responding, and the module body is a single static `export default` literal. Keep it that way: any future async work belongs on the server side of that endpoint, never inside the module source.

A first version of the manifest-based greeting baked the values **inline** into the manifest (`meta.localizations`). That was replaced because Umbraco's package-manifest cache (30 days in production, per-instance) froze the values at cache-fill time: weekday/month rule flips never invalidated anything, random rules were resolved once instead of per view, and on multi-instance hosting a local cache clear never reached the other instances. Chasing that with invalidation meant clearing a cache entry shared by every installed package — forbidden blast radius. Values must only ever come from the per-request module.

## Customisation mechanisms

| Mechanism        | How                                                                           | Where                                         |
| ---------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| Background image | `appsettings.json` → `Umbraco:CMS:Content:LoginBackgroundImage`               | Path relative to `/wwwroot/umbraco/`          |
| Logo             | `LoginLogoImage` + `LoginLogoImageAlternative`                                | Same section                                  |
| Password reset   | `Umbraco:CMS:Security:AllowPasswordReset` + SMTP config                       | `appsettings.json`                            |
| Custom CSS       | Umbraco supports an `appEntryPoint` that injects a `<link>` stylesheet — **Le Løgin does not use it**, see "Rejected approaches" | `App_Plugins/` with `allowPublicAccess: true` |
| Greeting text    | Package Razor-loaded client entry registers `login.greeting0..6` before `login.js` | Per-request ES module exporting translation keys |
| Timeout / logout screens | **Not customised — deliberately out of scope.** See "Screens Le Løgin does not customise" below | — |

## Available CSS custom properties

The table below is the set honoured by the **login SPA's** `umb-auth-layout` (`/umbraco/login`),
verified against the shipped `umbraco/login/login.js` in 18.1.0.

`umb-auth-layout` does **not** exist in the backoffice package. The backoffice-rendered screens —
`/umbraco/logout` and the session-timeout modal — use `umb-auth-view`, which implements its own
chrome and honours only a subset: `--umb-login-image`, `--umb-login-image-border-radius`,
`--umb-login-content-{background,border-radius,display,width,height}`,
`--umb-login-curves-{color,display}`, `--umb-login-header-font-size-large`, and one the login SPA
does not have, `--umb-login-greeting-color`. None of the `--umb-logo-*` variables apply there.
Le Løgin sets none of these; the list is reference only.

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

## Rejected approaches — do not use

Everything in this section documents how Umbraco *can* be customised from the login page and why
Le Løgin does not do it that way. It is kept for context, not as a pattern to copy. Reintroducing
either snippet re-creates the localisation race described under "Why server-side" above.

An `appEntryPoint` manifest — the extension type that runs on the login SPA:

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

…and the stylesheet-injection pattern such an entry point would use:

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

Override via a JS module registered as a `localization` extension. Only the `login` namespace is
needed:

```js
export default {
	login: {
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

`umb-auth-view.headline` (Umbraco 18) checks `auth_greeting{day}` first and falls back to
`login_greeting{day}`, and core's `en.js` ships `login.greeting0..6` but **no** `auth` greetings —
so the canonical `login_*` keys are what actually render. `auth_greeting*` is deprecated for
removal in v20 ([#20082](https://github.com/umbraco/Umbraco-CMS/issues/20082)); do not emit it, or
the legacy branch wins and logs a deprecation warning.

## Screens Le Løgin does not customise

`/umbraco/logout` is served by the **backoffice** shell (`apps/app/app.element.js`), not by the
package's Razor login view. Its `logout` route renders `UmbAppAuthElement` directly, and
`backofficeEntryPoint` is only constructed for the backoffice route — so no Le Løgin client code
runs there.

- **Background and logo are correct** on that screen regardless: both are resolved server-side by
  `LeLøginBackgroundMiddleware` and `LeLøginLogoMiddleware`, which intercept the graphics endpoints
  whichever shell requested them.
- **The greeting is Umbraco's default** ("Welcome"). Fixing it would need an `entryPoint` extension,
  which the app shell awaits *before routing* — putting package code on the authenticated
  backoffice's critical boot path to change one word on a screen shown briefly during sign-out.
  Judged not worth the risk. Revisit only if Umbraco gives the logout route its own extension point.
- **The session-timeout modal shows no greeting at all.** `umb-auth-view.headline` returns
  `login_instruction` when `userLoginState === 'timedOut'`, so greeting keys are never read there.

## Which image a multi-image rule resolves to

A screen resolves the active asset from up to three independent requests — background, logo, and
greeting — so all three must agree or one asset's logo lands on another's image. They agree via
`LoginRuntimeContext.RenderToken`, built by `LoginRuntimeContextFactory`:

- The Razor login shell generates one token per render and puts it on all four URLs, so that screen
  still rotates per page load.
- Everywhere else — the logout screen and the dashboard preview, whose URLs Umbraco hardcodes with
  no query string — the token falls back to a `BucketSeconds` time bucket. Requests in the same
  window agree; a multi-image random rule therefore rotates once per bucket rather than per request.

Plain modulo is used rather than hashing the token: .NET string hashing is randomised per process,
so a hash would let two instances of a load-balanced site disagree within one render.

## Two-factor authentication

Reference: [Umbraco 2FA Docs](https://docs.umbraco.com/umbraco-cms/reference/security/two-factor-authentication)

Umbraco supports pluggable two-factor authentication for both backoffice users and website members via the `ITwoFactorProvider` interface. Key points:

- Register a provider by implementing `ITwoFactorProvider` and wiring it through a composer using `BackOfficeIdentityBuilder.AddTwoFactorProvider<T>()` (users) or `MemberIdentityBuilder.AddTwoFactorProvider<T>()` (members)
- The provider appears on the login screen as an `mfaLoginProvider` extension registered in `umbraco-package.json` with a `forProviderName` matching the provider's `ProviderName`
- The default login flow presents a numeric one-time-code input after username/password; customise the activation screen via `mfaActivationProvider` with a custom `element`, or the login screen via `IBackOfficeTwoFactorOptions.GetTwoFactorView()`
- Notifications `UserTwoFactorRequestedNotification` / `MemberTwoFactorRequestedNotification` are published when 2FA is requested, enabling e-mail or SMS one-time codes as an alternative to app-based TOTP
- Users can have multiple 2FA providers enabled simultaneously; the login screen shows a provider picker in that case
