# Agent Guidelines for Le Løgin

## Package Identity

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| Name                | Le Løgin                                                                             |
| Purpose             | Manage the Umbraco backoffice login-screen image from a dedicated Settings-integrated product area |
| Type                | Full backoffice product (Settings menu group + tree + workspaces + public runtime)    |
| Framework (client)  | Pure TypeScript + Vite (custom elements using `UmbElementMixin(HTMLElement)`) |
| Framework (backend) | C# / .NET 10 / Razor Class Library                                                   |
| Umbraco version     | 18+                                                                                  |

## What This Package Is

A dedicated **Le Løgin** product area inside the Umbraco **Settings** section where authorised admins can:

- Upload and manage login-screen images
- Mark a selected image as the explicit Le Løgin fallback background when no rule wins
- Preview the published image in a login-style Overview surface
- Prepare for future rules, rule resolution, and preview flows

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

Current aliases use the `LeLøgin.` prefix:

```text
LeLøgin.Menu.Settings
LeLøgin.MenuItem.Overview
LeLøgin.MenuItem.Assets
LeLøgin.Tree.Assets
LeLøgin.TreeItem.Asset
LeLøgin.Repository.AssetTree
LeLøgin.Workspace.Root
LeLøgin.Workspace.AssetRoot
LeLøgin.Workspace.Asset
LeLøgin.Workspace.AssetUpload
LeLøgin.Dashboard.Overview
LeLøgin.EntryPoint.Backoffice
LeLøgin.EntryPoint.Runtime
```

### Entity Types

```text
login-screen-root
login-screen-asset-root
login-screen-asset
login-screen-asset-upload
login-screen-rule
login-screen-rule
```

### API Routes

Current routes:

```text
/umbraco/le-løgin/api/v{version}/assets
/umbraco/le-løgin/api/v{version}/settings
/umbraco/le-løgin/api/v{version}/runtime/active   ← public, read-only
```

Planned later:

```text
/umbraco/le-løgin/api/v{version}/rules
/umbraco/le-løgin/api/v{version}/rules
/umbraco/le-løgin/api/v{version}/preview
```

### C# Namespaces

```text
LeLøgin.Core.Api
LeLøgin.Core.Api.Assets
LeLøgin.Core.Api.Runtime
LeLøgin.Core.Api.Settings
LeLøgin.Core.Models
LeLøgin.Core.Storage
```

### Client Folder Structure

```text
Client/lib/
├── index.ts                          ← authenticated onInit entrypoint
├── section/                          ← Settings integration manifests
├── tree/
│   ├── asset-tree.repository.ts      ← asset tree repository
│   ├── entity-actions/               ← asset entity actions and create options
│   ├── manifests.ts                  ← asset tree + Settings menu item
│   └── types.ts                      ← tree entity types
├── workspaces/
│   ├── root-workspace.element.ts     ← Overview host workspace
│   ├── asset-root-workspace.element.ts
│   ├── asset-workspace.element.ts
│   ├── asset-upload-workspace.element.ts
│   └── manifests.ts
├── dashboard/                        ← Overview dashboard
├── runtime/                          ← login-page appEntryPoint
├── api/                              ← generated SDK + auth configuration
├── assets/
│   ├── asset.data-source.ts
│   ├── asset.repository.ts
│   ├── asset-workspace.context.ts
│   └── lang/                         ← localisation files
└── models/                           ← shared TypeScript types
```

## Security Model

### Management API

- All management endpoints require backoffice authentication
- Restrict Le Løgin access to an appropriate backoffice user group when permissions hardening is implemented
- Never use raw `fetch()` for management calls — always use the generated OpenAPI client with `UMB_AUTH_CONTEXT`

### Public Runtime API

- The runtime endpoint is public (pre-auth) and read-only
- It returns only the currently resolved public login-screen configuration
- Source assets and management endpoints must never be publicly accessible

## Storage Model

- Package-owned storage for source assets — do not use the editorial media library
- Source images live under `App_Data/LeLøgin/assets/`
- The explicit publish flow records the Le Løgin fallback asset in settings, while runtime resolution publishes GUID-backed exposure files under `wwwroot/login-screen/`
- Keep a path open for custom `IFileSystem` or Azure Blob later

## Technology Split

| Layer                  | Technology             | Notes                                                                                                                                     |
| ---------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser / frontend** | Pure TypeScript + Vite | Le Løgin is written without Lit. All elements use `UmbElementMixin(HTMLElement)` with manual DOM (innerHTML + hydration). Do not use `html` tagged templates, `@customElement` decorators, `UmbLitElement`, or any Lit API |
| **Server / backend**   | C# / .NET 10           | Razor Class Library, Umbraco Management API conventions, JsonFlatFileDataStore for persistence                                            |

## Key Rules

### Frontend

1. **Pure TypeScript only** — do not introduce React, Preact, Vue, Lit, or other client frameworks. Umbraco's backoffice uses Lit internally, but **Le Løgin is written without Lit**. All elements extend `UmbElementMixin(HTMLElement)` with manual DOM rendering (innerHTML + hydration). Do not use `html` tagged templates, `@customElement` decorators, or `UmbLitElement`
2. **Do not manipulate Umbraco's login screen DOM directly** — do not query or mutate shadow roots owned by `umb-auth`, `umb-auth-layout`, or any other Umbraco login component. Use Umbraco's published extension mechanisms instead: `localization` extensions for text, CSS custom properties (`--umb-login-image`, etc.) for visual overrides, and `appEntryPoint` for runtime wiring
3. **Use Umbraco UI (UUI) components** — all UI must use [Umbraco UI library](https://uui.umbraco.com/) ([source](https://github.com/umbraco/Umbraco.UI), [docs](https://docs.umbraco.com/umbraco-cms/customizing/ui-library)) `uui-*` web components. Do not create custom equivalents when a UUI component exists. When building UI, consult the [Umbraco UI API docs](https://apidocs.umbraco.com/v17/ui/?path=/docs/generic-components-body-layout--docs) for available components and usage patterns
4. **Do not use raw `fetch()`** for backoffice API calls — use the generated OpenAPI client with `UMB_AUTH_CONTEXT`
5. **Do not use `any` or `as` casts** in TypeScript. Prefer precise types, generics, narrowing, type guards, and `satisfies`
6. **Fix weak typings upstream, not downstream** — if a consumer needs a cast because an upstream type is weak, missing, or too broad, strengthen the type at the source or boundary instead. Prefer fixing API contracts, repository/data-source return types, manifest declarations, context interfaces, module augmentations, and typed adapters over adding local assertions in consuming code

### Backend

7. **Follow the Le Løgin API conventions** — match the `ApiBase` / `ApiControllerBase` / `ApiConfiguration` / `Composer` pattern established in this package
8. **Do not expose source asset management endpoints publicly** — only the runtime endpoint is public

### General

9. **Use Settings as the current management surface** — do not move Le Løgin back to Media or assume it is a top-level custom section unless the user explicitly wants that change
10. **Do not skip the PRE-BUILD-PLANNING wireframe** before building new extension types
11. **Do not add features** that are not in the product plan without discussion
12. **Build standards** — use pnpm, LF line endings, and follow .NET 10 best practices
13. **British English** — use British English in all code, comments, documentation, UI strings, and generated text (e.g. colour, organisation, centralise)
14. **Test-driven development (TDD)** — write tests first, then production code. Every feature starts with a failing test
15. **Ask before coding** — always confirm the plan with the user and get explicit permission before writing or modifying code
16. **Never use Git without explicit approval** — do not run any Git commands (`git commit`, `git push`, `git checkout`, `git reset`, etc.) unless the user has explicitly asked for it or given the go-ahead

## Build and Validation

```bash
# Client
cd /Users/ted/Repos/Login/Client && pnpm build

# Backend
cd /Users/ted/Repos/Login && dotnet build

# Tests
cd /Users/ted/Repos/Login/Client && pnpm test:unit
```

## Reference Documents

| Document                                                                   | Purpose                                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [docs/login-screen-product-plan.md](docs/login-screen-product-plan.md) | Current product plan with live architecture, status, and implementation order |
| [docs/umbraco-login-customisation.md](docs/umbraco-login-customisation.md) | Reference for current login-page customisation approach and runtime behaviour |
| [docs/umbraco-backoffice-extension-summary.md](docs/umbraco-backoffice-extension-summary.md) | Summary of the extension concepts currently used in Le Løgin |
| [docs/umbraco-application-code-summary.md](docs/umbraco-application-code-summary.md) | Summary of the backend patterns currently used in Le Løgin |
| [Umbraco Common Pitfalls & Anti-Patterns](https://docs.umbraco.com/umbraco-cms/develop-with-umbraco/application-code/common-pitfalls) | Official Umbraco guidance on common anti-patterns, performance pitfalls, and stability risks |

## Current State

- Package is building on both client and backend
- Package is registered with both `backofficeEntryPoint` and `appEntryPoint`
- Backoffice UI is integrated into Umbraco **Settings** via a custom menu group and sidebar app
- Overview and Assets surfaces are implemented and in active use
- Asset management follows `data source → repository → workspace context → element`
- Runtime logic is implemented and fetches `/umbraco/le-løgin/api/v1/runtime/active`
- Localisations currently ship for `en`, `da`, `sv`, `fi`, and `nb-no`
- Rules and preview authoring are still planned work; Le Løgin should not add a duplicate fallback image settings UI when Umbraco already provides one
