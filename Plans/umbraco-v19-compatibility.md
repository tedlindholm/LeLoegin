# Umbraco 19 compatibility

## Status

Noted 3 November 2026. This is a compatibility record for Le Løgin against the Umbraco 19 beta. It is not a third compile track, and `UmbracoMajor` stays `17` or `18`. The parallel 17 and 18 build is described in [dual-version-support-v17-v18-plan.md](dual-version-support-v17-v18-plan.md).

Checked against NuGet, npm, the `Umbraco.Cms` `19.0.0-beta1` nuspec, `Microsoft.AspNetCore.OpenApi` `11.0.0-rc.3.26522.148`, `Umbraco.StorageProviders.AzureBlob` `18.0.0`, and the login view at tag `release-19.0.0-beta1`. Nothing in the package repository has been compiled against 19.

`LeLøgin.Site.v19` is a preparation host for `Umbraco.Cms` `19.0.0-beta1` on `net11.0`, at `https://localhost:5021`. It does not reference Le Løgin. The machine used on 3 November 2026 has the .NET SDK `10.0.403` only, so that project stops at `NETSDK1045` before restore.

## 1. What is published

| Item | Value |
| --- | --- |
| NuGet | `Umbraco.Cms` `19.0.0-beta1` only. No release candidate is on the feed. |
| Published | 28 October 2026 |
| Release candidate | Announced for Thursday 12 November 2026. Not shipped on 3 November 2026. |
| Stable `19.0.0` | Targeted Thursday 10 December 2026 |
| Target framework | `net11.0` |
| Runtime packages | `11.0.0-rc.3.26522.148` (for example `Microsoft.AspNetCore.OpenApi`, `System.Security.Cryptography.Xml`) |
| Backoffice npm | `@umbraco-cms/backoffice` `19.0.0-beta1` |
| Template | `dotnet new install Umbraco.Templates::19.0.0-beta` |
| SDK | .NET SDK 11 |

Sources: [19.0.0-beta1 release notes](https://releases.umbraco.com/release/umbraco/Umbraco-CMS/19.0.0-beta1), [19.0.0 release notes](https://releases.umbraco.com/release/umbraco/Umbraco-CMS/19.0.0), [pre-release guide](https://docs.umbraco.com/umbraco-cms/19.latest/understand-umbraco-cms/product-and-releases/release-candidate-guide), [requirements](https://docs.umbraco.com/umbraco-cms/19.latest/get-started/installation/requirements).

## 2. Why 19 is not another `UmbracoMajor`

`Directory.Build.props` rejects any `UmbracoMajor` other than `17` or `18`, and every project targets `net10.0`. Umbraco 17 and 18 share that framework. Umbraco 19 does not.

A 19 build needs the .NET 11 SDK and `net11.0` on `LeLøgin`, `LeLøgin.AzureBlob`, both test projects, and a new site host. Putting `19` into the current property switch would still restore `net10.0` projects against `net11.0` packages.

`Umbraco.Cms` `19.0.0-beta1` also brings a different closure, so the 18 pins cannot be reused:

| Package | 18.3.0 track today | `19.0.0-beta1` |
| --- | --- | --- |
| Target framework | `net10.0` | `net11.0` |
| `Microsoft.AspNetCore.OpenApi` | `10.0.x` on the 18 host | `11.0.0-rc.3.26522.148` |
| `Microsoft.OpenApi` | `2.12.2` direct pin | `[3.10.2, 4.0.0)` via AspNetCore.OpenApi 11 |
| `SixLabors.ImageSharp` | `3.2.0`, transitive | `4.1.3`, transitive |
| `SixLabors.ImageSharp.Web` | 3.x, transitive | `4.0.2` |
| `Swashbuckle.AspNetCore.SwaggerUI` | `10.2.3` on the 18 host | `10.3.1` |
| `System.Security.Cryptography.Xml` | `10.0.14` direct pin | `11.0.0-rc.3.26522.148` |
| `MessagePack` | `3.1.12` | `3.1.12` |
| `Umbraco.StorageProviders.AzureBlob` | `18.0.0`, range `[18.0.0, 19.0.0)`, `net10.0` | No 19 package on NuGet |

`MessagePack` `3.1.12` is the one pin that already matches. Cryptography.Xml moves with the shared framework, so the `10.0.14` pin does not carry over.

## 3. Login shell

`release-17.7.2` and `release-18.3.0` are byte-identical, which is why the dual-track plan keeps one view. `release-19.0.0-beta1` is not that file. Diffed `src/Umbraco.Cms.StaticAssets/umbraco/UmbracoLogin/Index.cshtml` on 3 November 2026.

Upstream 19 changes, before any Le Løgin insertion:

- Injects `Umbraco.Cms.Core.Security.IUserForgotPasswordSender`.
- `allowUserInvite` calls `EmailSender.IsEmailConfigured()`. The 17/18 view calls `EmailSender.CanSendRequiredEmail()`.
- `allowPasswordReset` calls `ForgotPasswordSender.IsPasswordResetConfigured()`. The 17/18 view combines `SecuritySettings.AllowPasswordReset` with `CanSendRequiredEmail()`.
- Computes `backOfficeHostOrigin` from `SecuritySettings.BackOfficeHost` and `returnPath` from `Model.ReturnUrl`, falling back to `SecuritySettings.CallbackPathName`.
- `<umb-auth>` binds `return-url` to `returnPath` and adds `back-office-host`. The 17/18 view binds `return-url` to `backOfficePath` and has no `back-office-host`.
- Still calls the four-argument `BackOfficeImportMapScriptAsync`, and still loads `~/umbraco/login/login.js` as a module with `asp-append-version` and `asp-csp-nonce`.

Le Løgin's copy, on top of the 17/18 view, adds the render token on the three graphics routes, the greeting-module URL, `IFileVersionProvider`, `ILeLøginRandom`, and the replacement of `login.js`. Those insertions are not an 18-only API. They do sit on a view that 19 has already edited, so the 19 shell is its own file. The current "one view, no Razor conditional" decision does not extend here.

Re-diff this file at the release candidate and at `release-19.0.0`. The beta is allowed to move before then.

## 4. OpenAPI

The 17 track registers the document through Swashbuckle and `Microsoft.OpenApi` `2.9.0`. The 18 track uses `AddBackOfficeOpenApiDocument` and `Microsoft.OpenApi` `2.12.2`. `ApplySchemaOverride` is shared because both speak OpenAPI.NET 2 (`OpenApiSchema`, `JsonSchemaType`, `OneOf`).

Umbraco 19 keeps a Swagger UI package (`Swashbuckle.AspNetCore.SwaggerUI` `10.3.1`) and generates documents with `Microsoft.AspNetCore.OpenApi` 11. That package requires `Microsoft.OpenApi` 3.10.2 or higher, below 4. OpenAPI.NET 3 is a different API from the 2.x writer this repository compiles. Whether `AddBackOfficeOpenApiDocument` and `AddSchemaTransformer` still have the 18 signatures is unchecked until a `net11.0` compile.

The checked-in client is generated from the 18 document at `/umbraco/openapi/le-løgin-api-v1.json`. A 19 document has to be compared the same way as §6.2 of the dual-track plan: paths, property names, enum wire values, and the condition-value `oneOf`. Generator spelling stays out of that comparison. Do not regenerate the client from a beta document.

## 5. Imaging

`Umbraco.Cms.Imaging.ImageSharp` `19.0.0-beta1` depends on ImageSharp `4.1.3` and ImageSharp.Web `4.0.2`. Le Løgin does not reference ImageSharp directly. The package and the tests call ImageSharp.Web through the Umbraco imaging package:

- `ImageSharpMiddlewareOptions.HMACSecretKey`
- `RequestAuthorizationUtilities.ComputeHMAC`
- `CommandHandling.Sanitize`
- `Umbraco.Cms.Imaging.ImageSharp.ImageProcessors.CropWebProcessor`
- `LoginScreenImageUrlBuilder.ApplyImageProcessing` in the runtime controller and the login-background middleware

Those members exist on the 3.x stack used by 17.7.2 and 18.3.0. ImageSharp 4 and ImageSharp.Web 4 are majors. This note does not claim each member survived. The first 19 compile of `LoginScreenImageUrlBuilder` and `LoginScreenImageUrlBuilderTests` is the check.

ImageSharp 3.2 refuses a Release build that references it directly unless a Six Labors licence key is present. That is why the 18 track leaves ImageSharp transitive. ImageSharp 4's direct-reference rule was not re-checked. Keep the reference transitive on a 19 track as well until that rule is confirmed.

.NET 11 rejects non-canonical Base64. Umbraco binds `Umbraco:CMS:Imaging:HMACSecretKey` with `Convert.FromBase64String`, so a hand-pasted key can stop a 19 site from booting. Keys generated by Umbraco are canonical. Le Løgin's tests assign `HMACSecretKey` as a `byte[]`, which does not go through that decoder.

## 6. Azure Blob

NuGet has no `Umbraco.StorageProviders.AzureBlob` 19 version. `18.0.0` targets `net10.0` and depends on `Umbraco.Cms.Web.Common` `[18.0.0, 19.0.0)`. It does not restore against a 19 host. `LeLøgin.AzureBlob` cannot ship a 19 build until that provider has a 19 release, or until the blob project is left off the 19 track on purpose.

## 7. Client

`@umbraco-cms/backoffice` `19.0.0-beta1` is on npm. The bundle stays external; type-checking is what would pin 19. A green `tsc` against `18.3.0` says nothing about the 19 backoffice types.

Umbraco renamed the client entry point `Umb.EntryPoint.Partial View` to `Umb.EntryPoint.PartialView` in this major. This package does not register that alias. Login runtime still uses `appEntryPoint` and replaces `login.js` from the Razor shell.

The backoffice manifest schema checked in under `LeLøgin.Tests` is an 18-era copy. It is not evidence about 19 manifest shapes.

## 8. Host changes that do not move this package by themselves

These are in the 19 beta and do not, on the current source, name a Le Løgin API:

- Runtime async is opt-in for the CMS host.
- `BackOfficeDevelopment` and Models Builder `InMemoryAuto` are removed with Razor runtime compilation.
- Library content can be reused in the block editors, and document blueprints move to the Library.
- The search abstraction from 17 and 18 moves into core. Examine stays the default provider.
- Culture-invariant property permissions and the segment model change.

None of these has been exercised against a Le Løgin site.

## 9. Still unchecked

- A `net11.0` compile of `LeLøgin` against `Umbraco.Cms.*` `19.0.0-beta1`.
- OpenAPI.NET 3 compatibility of `ApplySchemaOverride` and the 18 registration extension methods.
- ImageSharp.Web 4 compatibility of the HMAC and crop calls.
- A byte diff of the login shell at the release candidate, then a Le Løgin 19 view that carries the render token, greeting module, and `login.js` replacement.
- Whether a 19 OpenAPI document still lives at `/umbraco/openapi/le-løgin-api-v1.json` and still matches the shared contract.
- `tsc` and `pnpm test:unit` with `@umbraco-cms/backoffice` `19.0.0-beta1`.
- A 19 Azure Blob provider, which is absent today.
- Restoring and booting `LeLøgin.Site.v19` once the .NET 11 SDK is installed, then signing in and opening the overview. The beta is a local proof only. Stable support waits for `19.0.0` on 10 December 2026, or a later decision to track the release candidate.
