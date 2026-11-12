# Agent Guidelines for Le Løgin

## Package Identity

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| Name                | Le Løgin                                                                             |
| Purpose             | Manage the Umbraco backoffice login-screen image from a dedicated Settings-integrated product area |
| Type                | Full backoffice product (Settings menu group + tree + workspaces + public runtime)    |
| Framework (client)  | Pure TypeScript + Vite (custom elements using `UmbElementMixin(HTMLElement)`) |
| Framework (backend) | C# / .NET 10 / Razor Class Library                                                   |
| Umbraco version     | 17.7.x and 18.x (separate package tracks, `-p:UmbracoMajor=17\|18`)                 |

## What This Package Is

A dedicated **Le Løgin** product area inside the Umbraco **Settings** section where authorised admins can:

- Upload and manage login-screen images
- Decide which image shows when with prioritised rules; a rule can show one image or a random pick from several
- Preview each rule's image in a login-style Overview surface

When no rule matches, Le Løgin passes the request on and Umbraco's own login image and logo show (`Umbraco:CMS:Content:LoginBackgroundImage` and `LoginLogoImage`). Le Løgin has no fallback image of its own; use a catch-all rule for one.

## What This Package Is Not

- Not a dashboard-only feature
- Not a Media subsection or a patch on the editorial media library
- Not a CSS-only branding package
- Not responsible for external authentication providers or 2FA (those live elsewhere)

## Before You Write Code

**Always read the relevant skills before implementing.** Do not start coding until you have loaded and reviewed the skills listed below that apply to your task. This ensures you follow established Umbraco patterns and avoid common mistakes such as raw `fetch()` calls, skipped wireframes, or incorrect extension registration.

## Skills to Load

When working on this package, load these skills before writing code:

| Skill                               | When                                                             |
| ----------------------------------- | ---------------------------------------------------------------- |
| `umbraco-backoffice`                | Always — read PRE-BUILD-PLANNING.md and POST-BUILD-VALIDATION.md |
| `umbraco-routing`                   | Setting up workspace paths, menu items, and URL handling         |
| `umbraco-extension-registry`        | Registering or replacing manifests at runtime                    |
| `umbraco-controllers`               | Building controllers that manage lifecycle and side effects      |
| `umbraco-repository-pattern`        | Building repositories and data sources                           |
| `umbraco-openapi-client`            | Wiring the generated API client with auth context                |
| `umbraco-granular-user-permissions` | Implementing per-entity or per-action permissions                |
| `umbraco-dashboard`                 | Modifying the Overview experience                                |
| `umbraco-umbraco-element`           | Writing Umbraco custom elements                                  |
| `umbraco-unit-testing`              | Adding or updating client tests                                  |
| `british-spelling`                  | Reviewing UI copy, docs, and comments                            |
| `typescript-expert`                 | All TypeScript work                                              |
| `dotnet-10-csharp-14`               | All C# work                                                      |

## Naming Conventions

### Aliases

Aliases use the `LeLøgin.` prefix. The main ones are listed here; the full set lives in the `manifests.ts` files under `Client/lib/`.

```text
LeLøgin.EntryPoint.Backoffice
LeLøgin.Menu.Settings
LeLøgin.SectionSidebarApp.Settings
LeLøgin.MenuItem.Overview
LeLøgin.MenuItem.Assets
LeLøgin.MenuItem.Rules
LeLøgin.Tree.Assets
LeLøgin.Tree.Rules
LeLøgin.TreeItem.Asset
LeLøgin.TreeItem.Rule
LeLøgin.Repository.Asset
LeLøgin.Repository.AssetTree
LeLøgin.Repository.Rule
LeLøgin.Workspace.Root
LeLøgin.Workspace.AssetRoot
LeLøgin.Workspace.AssetGroup.Background
LeLøgin.Workspace.AssetGroup.Logo
LeLøgin.Workspace.Asset
LeLøgin.Workspace.AssetUpload.Background
LeLøgin.Workspace.AssetUpload.Logo
LeLøgin.Workspace.RuleList
LeLøgin.Workspace.Rule
LeLøgin.Dashboard.Overview
LeLøgin.Modal.CreateAsset
LeLøgin.Modal.LogoPicker
LeLøgin.Permission.Manage
```

### Entity Types

```text
login-screen                          ← permission entity
login-screen-root
login-screen-asset-root
login-screen-asset-group
login-screen-asset-group-background
login-screen-asset-group-logo
login-screen-asset
login-screen-asset-upload-background
login-screen-asset-upload-logo
login-screen-rule-list
login-screen-rule
```

### API Routes

Management routes (backoffice authentication and the Le Løgin permission):

```text
/umbraco/le-løgin/api/v{version}/assets
/umbraco/le-løgin/api/v{version}/assets/{id}
/umbraco/le-løgin/api/v{version}/assets/{id}/preview
/umbraco/le-løgin/api/v{version}/assets/{id}/publish
/umbraco/le-løgin/api/v{version}/assets/{id}/thumbnail
/umbraco/le-løgin/api/v{version}/rules
/umbraco/le-løgin/api/v{version}/rules/{id}
/umbraco/le-løgin/api/v{version}/rules/{id}/preview
/umbraco/le-løgin/api/v{version}/rules/condition-metadata
```

Public routes (pre-auth, read-only):

```text
/umbraco/le-løgin/api/v{version}/runtime/active
/umbraco/le-løgin/api/v{version}/runtime/greeting.js
```

### C# Namespaces

```text
LeLøgin.Core
LeLøgin.Core.Api
LeLøgin.Core.Api.Assets
LeLøgin.Core.Api.Authorisation
LeLøgin.Core.Api.Rules
LeLøgin.Core.Api.Runtime
LeLøgin.Core.Models
LeLøgin.Core.Runtime
LeLøgin.Core.Storage
LeLøgin.Core.Storage.Dtos
LeLøgin.Core.Storage.Migrations
LeLøgin.Core.Storage.Migrations.Schemas
```

### Client Folder Structure

```text
Client/lib/
├── backoffice-entry.ts               ← backofficeEntryPoint (authenticated)
├── login-bootstrap.ts                ← login-page script, loaded by umbraco/UmbracoLogin/Index.cshtml
├── section/                          ← Settings menu group and sidebar app
├── tree/                             ← asset tree, entity actions and create options
├── rules/                            ← rule tree, repository, condition editor, entity actions
├── workspaces/                       ← Overview, asset, asset group, upload, rule and rule list workspaces; modals
├── dashboard/                        ← Overview dashboard
├── auth-view/                        ← backoffice preview of the login view
├── assets/
│   ├── asset.data-source.ts
│   ├── asset.repository.ts
│   ├── asset-workspace.context.ts
│   └── lang/                         ← localisation files
├── user-permissions/                 ← Le Løgin permission
├── backend-api/                      ← generated-client configuration with UMB_AUTH_CONTEXT
├── api/                              ← generated OpenAPI SDK
├── utils/                            ← small shared helpers
└── models/                           ← shared TypeScript types
```

## Security Model

### Management API

- All management endpoints require backoffice authentication
- Management endpoints also require the Le Løgin permission (`LeLøgin.Permission.Manage`), granted through the package-managed user group
- Never use raw `fetch()` for management calls — always use the generated OpenAPI client with `UMB_AUTH_CONTEXT`

### Public Runtime API

- The two runtime endpoints (`runtime/active` and `runtime/greeting.js`) are public (pre-auth) and read-only
- They return only the currently resolved public login-screen configuration. The login image and logo are served by `LoginBackgroundMiddleware` and `LoginLogoMiddleware` at Umbraco's own graphics URLs
- Source assets and management endpoints must never be publicly accessible

## Storage Model

- Package-owned storage for source assets — do not use the editorial media library
- Source images live under `App_Data/LeLøgin/assets/`
- Runtime resolution publishes GUID-named copies under `wwwroot/login-screen/` (the default publish file system): one for each image an enabled rule can show
- All file access goes through Umbraco's `IFileSystem`, via `LeLøginAssetFileManager` and `LeLøginPublishFileManager`; hosts replace them with `SetLoginAssetFileSystem` / `SetLoginPublishFileSystem`
- The `LeLøgin.AzureBlob` adapter is a maintained part of the package. File handling must work on both the physical file system and Azure Blob. For example, the Azure provider matches a `GetFiles` filter as a literal substring, so do not pass glob patterns such as `id.*`; list the folder and match names in code

## Technology Split

| Layer                  | Technology             | Notes                                                                                                                                     |
| ---------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser / frontend** | Pure TypeScript + Vite | Le Løgin is written without Lit. All elements use `UmbElementMixin(HTMLElement)` with manual DOM (innerHTML + hydration). Do not use `html` tagged templates, `@customElement` decorators, `UmbLitElement`, or any Lit API |
| **Server / backend**   | C# / .NET 10           | Razor Class Library, Umbraco Management API conventions, Umbraco database via NPoco migrations                                          |

## Key Rules

### Frontend

1. **Pure TypeScript only** — do not introduce React, Preact, Vue, Lit, or other client frameworks. Umbraco's backoffice uses Lit internally, but **Le Løgin is written without Lit**. All elements extend `UmbElementMixin(HTMLElement)` with manual DOM rendering (innerHTML + hydration). Do not use `html` tagged templates, `@customElement` decorators, or `UmbLitElement`
2. **Do not manipulate Umbraco's login screen DOM directly** — on the real login page, do not query or mutate shadow roots owned by `umb-auth`, `umb-auth-layout`, or any other Umbraco login component. Use Umbraco's published extension mechanisms instead: `localization` extensions for text, CSS custom properties (`--umb-login-image`, etc.) for visual overrides, and the package's login script (`login-bootstrap.ts`, loaded by `umbraco/UmbracoLogin/Index.cshtml`) for runtime wiring. The backoffice preview is not covered by this rule: it renders its own `umb-auth-view` and may adjust and read it (`Client/lib/auth-view/*`, `asset-workspace.element.ts`, `asset-workspace.helpers.ts`)
3. **Use Umbraco UI (UUI) components** — all UI must use [Umbraco UI library](https://uui.umbraco.com/) ([source](https://github.com/umbraco/Umbraco.UI), [docs](https://docs.umbraco.com/umbraco-cms/customizing/ui-library)) `uui-*` web components. Do not create custom equivalents when a UUI component exists. When building UI, consult the [Umbraco UI API docs](https://apidocs.umbraco.com/v17/ui/?path=/docs/generic-components-body-layout--docs) for available components and usage patterns
4. **Do not use raw `fetch()`** for backoffice API calls — use the generated OpenAPI client with `UMB_AUTH_CONTEXT`
5. **Do not use `any` or `as` casts** in TypeScript. Prefer precise types, generics, narrowing, type guards, and `satisfies`
6. **Fix weak typings upstream, not downstream** — if a consumer needs a cast because an upstream type is weak, missing, or too broad, strengthen the type at the source or boundary instead. Prefer fixing API contracts, repository/data-source return types, manifest declarations, context interfaces, module augmentations, and typed adapters over adding local assertions in consuming code

### Backend

7. **Follow the Le Løgin API conventions** — match the `ApiBase` / `ApiControllerBase` / `ApiConfiguration` / `Composer` pattern established in this package
8. **Do not expose source asset management endpoints publicly** — only the runtime endpoint is public
9. **Never touch cache state Le Løgin does not own** — do not clear, mutate, mirror the keys of, or depend on the lifetime of shared or foreign caches. In particular, Umbraco's `PackageManifestService` runtime-cache entry aggregates **every** package's manifests; clearing it to refresh Le Løgin state invalidates the whole site's manifest cache and is forbidden. Deliver freshness by resolving state per request at Le Løgin-owned endpoints instead of invalidating caches owned by Umbraco or other packages. Enforced by `ArchitectureRuleTests` in LeLøgin.Tests. (A former `LeLøginPackageManifestCacheInvalidator` violated this rule and was deleted in the greeting-endpoint redesign — do not reintroduce its pattern.)

### General

10. **Use Settings as the current management surface** — do not move Le Løgin back to Media or assume it is a top-level custom section unless the user explicitly wants that change
11. **Do not skip the PRE-BUILD-PLANNING wireframe** before building new extension types
12. **Do not add features** that have not been discussed with the user
13. **Build standards** — use pnpm, LF line endings, and follow .NET 10 best practices
14. **British English** — use British English in all code, comments, documentation, UI strings, and generated text (e.g. colour, organisation, centralise)
15. **Test-driven development (TDD)** — write tests first, then production code. Every feature starts with a failing test
16. **Ask before coding** — always confirm the plan with the user and get explicit permission before writing or modifying code
17. **Never use Git without explicit approval** — do not run any Git commands (`git commit`, `git push`, `git checkout`, `git reset`, etc.) unless the user has explicitly asked for it or given the go-ahead
18. **No regular expressions** — wherever it can be avoided, do not use `Regex` in C# or regular expressions in TypeScript/JavaScript; use plain string operations (`StartsWith`, `IndexOf`, `Split`, `includes`, `URL`, small parsers) instead. This covers production code, tests (including `toMatch(/…/)` and `toThrow(/…/)`) and build scripts. Generated files are exempt. Where no reasonable plain-string version exists, say why in a comment
19. **No Newtonsoft.Json** — use System.Text.Json, as Umbraco and ASP.NET do. Do not add a `Newtonsoft` package reference, `using`, attribute or converter to production code. Enforced by `ArchitectureRuleTests` in LeLøgin.Tests

## Build and Validation

```bash
# Client (dotnet build runs this with the package version and output directory)
cd /Users/ted/Repos/LeLøgin/Client && pnpm build 18.0.0-rc.1 ../obj/v18/Debug/net10.0/client/wwwroot/App_Plugins/le-løgin

# Backend
cd /Users/ted/Repos/LeLøgin && dotnet build

# Tests
cd /Users/ted/Repos/LeLøgin/Client && pnpm test:unit
```

## Reference Documents

| Document                                                                   | Purpose                                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md) | Package architecture, dependencies and the dual Umbraco track |
| [docs/filesystem-providers.md](docs/filesystem-providers.md) | Storage abstraction and how to plug in another file system |
| [docs/umbraco-login-customisation.md](docs/umbraco-login-customisation.md) | Reference for current login-page customisation approach and runtime behaviour |
| [docs/umbraco-backoffice-extension-summary.md](docs/umbraco-backoffice-extension-summary.md) | Summary of the extension concepts currently used in Le Løgin |
| [docs/umbraco-application-code-summary.md](docs/umbraco-application-code-summary.md) | Summary of the backend patterns currently used in Le Løgin |
| [Umbraco Common Pitfalls & Anti-Patterns](https://docs.umbraco.com/umbraco-cms/develop-with-umbraco/application-code/common-pitfalls) | Official Umbraco guidance on common anti-patterns, performance pitfalls, and stability risks |

## Current State

- Package is building on both client and backend
- The backoffice code is registered as a `backofficeEntryPoint`. The login page loads `login-bootstrap.ts` through the package's `umbraco/UmbracoLogin/Index.cshtml`; there is no `appEntryPoint`
- Backoffice UI is integrated into Umbraco **Settings** via a custom menu group and sidebar app
- Overview, Assets and Rules are implemented and in active use
- Asset and rule management follow `data source → repository → workspace context → element`
- On the login page, the image and logo come from `LoginBackgroundMiddleware` and `LoginLogoMiddleware`, and the greeting from `runtime/greeting.js`. The Overview dashboard reads `runtime/active`
- Localisations currently ship for `en`, `da`, `sv`, and `nb-no` (only languages Umbraco ships a backoffice translation for; enforced by `lib/assets/lang/manifests.test.ts`)
- Rules and rule preview are implemented
- Le Løgin should not add a duplicate fallback image settings UI when Umbraco already provides one
