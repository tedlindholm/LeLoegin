# Fresh-Install Database Readiness Remedy Plan

## Status

Implemented on 18 August 2026. The implementation followed the approved red-green sequence and is
covered at the notification, middleware, controller, and isolated real-host boundaries. Final
package validation is recorded in the checklist below.

## Outcome

Le Løgin can be present before a new Umbraco instance has configured or created its database. While Umbraco is not at `RuntimeLevel.Run`, Le Løgin must remain inert at every database-dependent boundary:

- the installer starts without a Le Løgin application-startup exception;
- Umbraco's own login graphics remain available;
- Le Løgin's public runtime endpoints return safe empty responses;
- neither Umbraco user-group storage nor Le Løgin package tables are queried;
- after installation restarts Umbraco at `RuntimeLevel.Run`, the existing Le Løgin migrations and user-group provisioning run normally.

No client UI, API contract, database schema, migration state, or OpenAPI client changes are required.

## Confirmed failure

Umbraco 18.1.0 deliberately treats both an unconfigured database and an empty database as install states. `RuntimeLevel.Install` is bootable, and `CoreRuntime` still publishes `UmbracoApplicationStartedNotification` when the host starts:

- [RuntimeState determines `InstallNoDatabase` and `InstallEmptyDatabase`](https://github.com/umbraco/Umbraco-CMS/blob/release-18.1.0/src/Umbraco.Infrastructure/Runtime/RuntimeState.cs#L107-L171).
- [`Install` is considered bootable](https://github.com/umbraco/Umbraco-CMS/blob/release-18.1.0/src/Umbraco.Core/Extensions/RuntimeStateExtensions.cs#L20-L22).
- [`CoreRuntime` registers the application-started notification](https://github.com/umbraco/Umbraco-CMS/blob/release-18.1.0/src/Umbraco.Infrastructure/Runtime/CoreRuntime.cs#L175-L183).

Le Løgin currently has three unguarded database-entry paths during that state:

1. `Core/Api/Authorisation/LeLøginUserGroupProvisioning.cs` handles `UmbracoApplicationStartedNotification` and immediately calls `IUserGroupService.GetAsync`. With no connection configured, this raises `The factory has not been configured with a proper connection string`; with an empty SQLite file, it raises `SQLite Error 1: 'no such table: umbracoUserGroup'`.
2. `Core/Runtime/LoginBackgroundMiddleware.cs` and `Core/Runtime/LoginLogoMiddleware.cs` query `ILeLøginScreenStore` before falling through to Umbraco's anonymous graphics controller, causing HTTP 500 responses during installation.
3. `Core/Api/Runtime/RuntimeController.cs` exposes anonymous pre-authentication endpoints whose actions query `ILeLøginScreenStore` without first establishing database readiness. The public greeting manifest can make these paths relevant before authentication.

The Le Løgin schema migration is not the cause. `Core/Storage/Migrations/LeLoginMigrationNotificationHandler.cs` already returns below `RuntimeLevel.Run`; that behaviour should be protected by a regression test.

## Readiness contract

Use Umbraco's `IRuntimeState` directly at each lifecycle or HTTP boundary. The only state in which Le Løgin may use Umbraco or package database services is:

```csharp
runtimeState.Level == RuntimeLevel.Run
```

Use equality rather than ordinal comparisons. Install, upgrade, boot-failed, booting, unknown, and any future non-running state must all remain database-free.

| Boundary | Behaviour before `Run` | Behaviour at `Run` |
| --- | --- | --- |
| Le Løgin schema migration | Return without opening a scope | Execute the existing migration plan |
| User-group provisioning | Return without calling `IUserGroupService` | Ensure the Le Løgin group exists |
| Login-background middleware | Call the next middleware | Resolve and serve/redirect the active Le Løgin background |
| Login-logo middlewares | Call the next middleware | Resolve and serve the active Le Løgin logo |
| `GET runtime/active` | `204 No Content` | Return the current resolved configuration |
| `GET runtime/greeting.js` | `200`, `Cache-Control: no-store`, body `export default {};` | Return the current greeting module |
| `GET assets/{id}/thumbnail` | `404 Not Found` | Return the requested thumbnail when it exists |
| Authenticated management APIs | Unchanged; unavailable before authentication | Existing behaviour |

Do not catch and suppress arbitrary database exceptions. Once Umbraco is at `Run`, a missing table or failed connection is an operational failure and should remain visible. Do not put readiness behaviour inside `LeLøginScreenStore`; keeping the store strict makes an unguarded future consumer fail visibly. The guards belong at the public and lifecycle boundaries that can legitimately run before database readiness.

## Control flow

```text
Umbraco determines runtime level
          |
          +-- Run ----------------------------------------------+
          |                                                     |
          |   migrations -> group provisioning -> Le Løgin DB  |
          |                                                     |
          +-- anything else ------------------------------------+
              no group access
              no Le Løgin store access
              graphics -> Umbraco defaults
              public runtime -> empty safe responses
```

## Test seams to approve

The tests should exercise observable boundaries, not a new private readiness helper. Approval of this plan confirms these seams for the TDD implementation:

1. **Application notification seam** — invoke the real Le Løgin notification handlers with an explicit runtime level and an unavailable database boundary.
2. **Middleware seam** — invoke each real middleware on its public request path and observe fall-through or the HTTP response.
3. **Public runtime seam** — invoke the real controller actions and assert their documented HTTP/module results.
4. **Fresh-host seam** — boot the real `LeLøgin.Site` host with isolated configuration and storage, then exercise the installer and anonymous endpoints over HTTP.

Fakes may represent the unavailable database boundary, time, files, and randomness. Tests should not assert private method calls or introduce an `ILeLøginRuntimeReadiness` abstraction solely for mocking.

## Planned file changes

### Production

- `Core/Api/Authorisation/LeLøginUserGroupProvisioning.cs`
  - Inject `IRuntimeState` into `LeLøginUserGroupProvisioningNotificationHandler`.
  - Return immediately unless the level is exactly `RuntimeLevel.Run`.
  - Keep `LeLøginUserGroupProvisioner` and `ILeLøginUserGroupStore` unchanged.
- `Core/Runtime/LoginBackgroundMiddleware.cs`
  - Accept `IRuntimeState` through method injection.
  - For a matching path before `Run`, call `next` before resolving `ILeLøginScreenStore` data.
- `Core/Runtime/LoginLogoMiddleware.cs`
  - Apply the same pre-store fall-through for both logo routes.
- `Core/Api/Runtime/RuntimeController.cs`
  - Inject `IRuntimeState`.
  - Apply the response matrix above before any store or file-system call.
- `Core/Storage/Migrations/LeLoginMigrationNotificationHandler.cs`
  - Use exact `RuntimeLevel.Run` equality so unknown or future non-running levels cannot execute migrations.

### Tests and host fixture

- Add `LeLøgin.Tests/Api/Authorisation/LeLøginUserGroupProvisioningNotificationHandlerTests.cs`.
- Add `LeLøgin.Tests/Runtime/LoginBackgroundMiddlewareTests.cs`; there is currently no focused test for this middleware.
- Extend `LeLøgin.Tests/Runtime/LoginLogoMiddlewareTests.cs`.
- Extend `LeLøgin.Tests/Api/Runtime/RuntimeControllerTests.cs`.
- Add `LeLøgin.Tests/Storage/Migrations/LeLoginMigrationNotificationHandlerTests.cs` for the existing install-state guard.
- Add `LeLøgin.Tests/Site/FreshInstallStartupTests.cs` plus a disposable fresh-host fixture.
- Add `Microsoft.AspNetCore.Mvc.Testing` at the ASP.NET Core 10 patch used by the host to `LeLøgin.Tests/LeLøgin.Tests.csproj` if the `WebApplicationFactory` harness proves faithful.
- Add `public partial class Program` to `/Users/ted/Repos/LeLøgin.Site/Program.cs` so the already-referenced site can be hosted by `WebApplicationFactory<Program>`.

The host fixture must redirect its content root, logs, MainDom lock, and SQLite file to a unique temporary directory. It must never read, replace, or create `/Users/ted/Repos/LeLøgin.Site/umbraco/Data/Umbraco.sqlite.db`. If `WebApplicationFactory` does not reproduce the current `ApplicationStarted` failure before production changes, replace it with a controlled Kestrel subprocess fixture; do not accept an integration test that starts green against the known-broken code.

### Documentation

- Update `docs/architecture.md` with the `RuntimeLevel.Run` database-readiness boundary.
- Correct `docs/umbraco-application-code-summary.md`, which still describes `JsonFlatFileDataStore`/`config.json` despite the current NPoco/Umbraco-database store.
- Add a short supported-fresh-install statement to `readme.md` once the package-level test is green.

No extension type or UI changes are involved, so the Umbraco pre-build UI wireframe is not applicable. The control-flow diagram above is the relevant architecture sketch.

## Test-first implementation sequence

Work in vertical red-green slices. Run the focused test after each red assertion and again after the minimum production change.

### 1. Protect application-start notifications

1. Add a failing handler test proving `HandleAsync` completes at `RuntimeLevel.Install` when any user-group store access would throw.
2. Add the matching positive test at `RuntimeLevel.Run` using the existing fake user-group boundary, proving provisioning still occurs after installation.
3. Add a failing migration-handler test proving `RuntimeLevel.Install` does not execute or resolve the migration database work.
4. Add only the `IRuntimeState` equality guard to the user-group notification handler and make the tests green.

### 2. Protect login graphics

1. Add a failing background-middleware test at the exact login-background route with `RuntimeLevel.Install` and a throwing store; the next middleware must run.
2. Add a `Run` test proving the existing background-resolution path still operates.
3. Add failing logo-middleware theories for `login-logo` and `login-logo-alternative` at `Install`; both must fall through without touching the store.
4. Add the two minimal middleware guards and make each focused test green before moving on.

### 3. Protect every anonymous runtime action

1. Add a failing `GetActive` test at `Install` with a throwing store; require `204`.
2. Add a failing `GreetingModule` test at `Install`; require an importable empty default export and `no-store`.
3. Add a failing `Thumbnail` test at `Install`; require `404` without store or file-system access.
4. Inject `IRuntimeState` once into `RuntimeController`, add the action-level early responses, and keep all existing `Run` tests green.

### 4. Prove the complete fresh-host behaviour

Add two isolated host cases against the real Umbraco 18.1.0 application lifecycle:

1. **No database configuration** — runtime reaches `InstallNoDatabase`; the host starts, `/umbraco/` serves the installer, and no Le Løgin startup exception escapes.
2. **Configured empty SQLite file** — runtime reaches `InstallEmptyDatabase`; the host starts without `no such table: umbracoUserGroup`.

For both cases, verify:

- the three Umbraco login-graphics endpoints return Umbraco's own successful image responses rather than HTTP 500;
- public Le Løgin URLs never return HTTP 500 or reach a database boundary (Umbraco 18.1's installer pipeline currently answers them with `400` before controller dispatch);
- focused controller tests prove that, if dispatched before `Run`, `runtime/active` returns `204`, `runtime/greeting.js` returns the empty importable module with `no-store`, and a thumbnail request returns `404`;
- temporary processes, files, database connections, and MainDom locks are released during teardown.

Add one `Run`-state integration or fixture assertion proving the gates do not disable Le Løgin after setup: the migration tables exist, the Le Løgin user group is provisioned, and the current login-background behaviour remains active. Prefer observing this through the package's store/API and user-group service rather than querying database tables directly.

### 5. Documentation and review

1. Update the architecture and application-code summaries from the verified implementation.
2. Review all new test names, comments, logs, and documentation for British English while preserving Umbraco and ASP.NET API identifiers.
3. Confirm no client or OpenAPI output changed.

## Acceptance criteria

- Installing Le Løgin before Umbraco database setup produces no fatal Le Løgin startup exception.
- Both `InstallNoDatabase` and `InstallEmptyDatabase` are covered by automated tests.
- No pre-`Run` code path calls `IUserGroupService`, `ILeLøginScreenStore`, a Le Løgin file service, or a package migration executor.
- The installer and all three login-graphics endpoints avoid HTTP 500 responses.
- Public Le Løgin runtime responses match the readiness matrix.
- Completing installation and restarting at `Run` creates/upgrades Le Løgin storage and provisions the user group exactly as before.
- Database failures at `Run` remain visible; the remedy contains no broad exception swallowing.
- The full .NET and client suites remain green.

## Post-Build Validation (REQUIRED)

- [x] Run each focused red-green test group during implementation.
- [x] Run `dotnet test LeLøgin.Tests/LeLøgin.Tests.csproj` (121 passed).
- [x] Run `dotnet test LeLøgin.AzureBlob.Tests/LeLøgin.AzureBlob.Tests.csproj` (10 passed).
- [x] Run `dotnet build LeLøgin.csproj` (zero warnings and errors).
- [x] Run `pnpm test:unit` (91 passed) and `pnpm build` from `Client/`.
- [x] Pack Le Løgin and install that package, rather than a project reference, into a disposable Umbraco 18.1.0 host before database setup; both `InstallNoDatabase` and `InstallEmptyDatabase` were confirmed.
- [ ] In a browser, open the disposable host's `/umbraco/` installer and confirm the default background and logos render without console or network errors. The in-app browser was not connected in this session; HTTP checks confirmed the installer and all three graphics returned `200`.
- [ ] Complete the SQLite installation, allow Umbraco to restart, sign in, and confirm Le Løgin appears under Settings for the provisioned group. The packed unattended installation and restart reached `Run`, created the three package tables, and provisioned the group with Settings access and `LeLøgin.Manage`; interactive sign-in was unavailable with the browser.
- [x] Confirm the Le Løgin assets, rules, settings, greeting, background, and logo paths retain their current `Run` behaviour through the full suites and packed-host runtime smoke checks.
- [x] Inspect the disposable host log for Le Løgin startup exceptions, `no such table`, and unconfigured database-factory errors; none were present in either clean install-state log.
- [x] Review the implementation for ordinal runtime-level comparisons, broad database exception catches, shared/foreign cache invalidation, and accidental access to the real development database.
