# Login Image Voting Plan

## Status

Proposed. This document defines the first implementation slice for an intentionally unobtrusive login-image voting feature, plus the authenticated scoreboard that reads the results. It does not authorise implementation.

## Outcome

An authenticated backoffice user can leave one current positive or negative vote for each Le Løgin background asset. The controls are a hard-to-find, low-priority enhancement to the desktop login image: a small `👍 👎` overlay that appears when the image is hovered or the control receives keyboard focus. The login page itself shows no counts, prompts, or notifications.

Results are read in one place only: a **Scoreboard** surface inside the Le Løgin menu group in Settings, which ranks background assets by net score. Votes never drive an editorial decision automatically — the scoreboard informs a human, it does not change which image wins.

The database is authoritative. A browser-side vote made before login is only a short-lived pending intent that is attached to the authenticated user after login.

## Constraints and decisions

- Votes are attached to a stable Le Løgin background `AssetId`, not the generated runtime URL, file path, crop, or rule. Editing focal point, zoom, greeting, or the active rule does not discard votes. Uploading a replacement image creates a new asset and therefore starts with no votes.
- One row represents one user's current vote for one asset. Selecting the other icon replaces the stored value. Re-selecting the current icon leaves it unchanged in the first release; vote removal is not required.
- `UserKey` is obtained on the server from the authenticated Umbraco backoffice user. The client never sends a user ID.
- The browser must never regard a cookie as proof of a user's prior vote. A cookie can only correlate the pre-login impression with the post-login submission.
- Votes are not part of `ILeLøginScreenStore`. They have a separate write and concurrency profile, so they need a dedicated store and API surface.
- When a background asset is deleted, its votes are deleted in the same database scope. There is no retained vote history for deleted images.
- The login-page vote control is desktop-only because Le Løgin hides the image on small screens, which are normally touch devices.
- **Counts are never shown on the login page.** Aggregates exist only behind backoffice authentication, on the Scoreboard surface.
- **The scoreboard is gated by the existing `ManageLeLøgin` permission**, consistent with every other Le Løgin surface (`Overview`, `Rules`, `Assets`). Voting is deliberately less privileged than reading the board: any authenticated backoffice user may vote, only Le Løgin managers see totals. Assumption to confirm: Le Løgin has no precedent for a non-manager backoffice surface, so reusing the manage permission avoids inventing a second authorisation shape.
- **No voter is identifiable.** The scoreboard returns counts, net score, distinct-voter total, and the calling user's own vote. `UserKey` is never returned to the client, and no user name, email address, or per-user vote list is resolved or displayed. This keeps the stated data minimisation intact.

## Compatibility gate: a safe login-page host

The desired login overlay cannot be built against the current package without an explicit design decision:

- Le Løgin currently has no public `appEntryPoint`; `Client/public/umbraco-package.json` registers only the authenticated `backofficeEntryPoint`.
- Login customisation is server-side specifically because the former client runtime could prevent Umbraco's login form from initialising on warm-cache loads.
- The package rules prohibit querying or mutating Umbraco-owned `umb-auth`, `umb-auth-layout`, or other login-component shadow DOM.

Before production work, run a contained compatibility spike against the supported Umbraco version to establish an official public extension point that can host a focusable vote control without DOM or shadow-DOM mutation and without delaying localisation or form initialisation. The spike must demonstrate fresh, warm-cache, logout, password-reset, and MFA login flows.

If no such host exists, do not reintroduce a login-page runtime just for voting. Keep the data model and authenticated vote synchronisation, but defer the visual login-page control until Umbraco exposes an appropriate extension point. A post-login prompt is deliberately out of scope because the login-side feature is intended to remain hard to find.

The scoreboard is **not** behind this gate. It is an ordinary authenticated management surface and can be built and shipped whatever the spike concludes.

## Vote-source dependency (decision required)

The scoreboard only has something to show once votes exist, and in the plan as originally written the sole way to cast a vote is the login-page overlay. If the compatibility gate fails, the board ships permanently empty.

Two ways to resolve it:

1. **Recommended — add a direct authenticated vote endpoint.** `PUT /umbraco/le-løgin/api/v1/votes/{assetId}` with body `{ value }`, protected by backoffice authentication but **not** by `ManageLeLøgin`, so any signed-in user can vote. The server still derives `UserKey` from the authenticated principal and validates that `assetId` is an existing background asset. Accepting an explicit asset id is safe here and does not weaken the pending-vote rule: the pending endpoint refuses a client-supplied asset id because its only proof is the impression cookie, whereas a deliberate authenticated request carries its own trust. This makes the whole feature independent of the compatibility spike, and it is the endpoint a per-row `👍 👎` control on the scoreboard would call.
2. **Defer.** Ship the scoreboard read-only and accept that it stays empty until the login-page host exists.

The rest of this document assumes option 1, and marks the affected work. Say if you want option 2 and the direct endpoint plus the scoreboard row controls come out.

## Desired interaction wireframe: login page

This is the target only if the compatibility gate succeeds. The image and authentication form remain Umbraco-owned; the vote surface must use a supported host.

```text
Desktop login page
┌───────────────────────────────────────────────────────────────────┐
│                         [Umbraco auth layout]                      │
│                                                                   │
│  Login image                                      Sign-in form     │
│  ┌────────────────────────────────────────┐     ┌──────────────┐ │
│  │                                        │     │ Email        │ │
│  │                                        │     │ Password     │ │
│  │                                        │     │ [Sign in]    │ │
│  │                                👍  👎  │     └──────────────┘ │
│  └────────────────────────────────────────┘                       │
│       [supported public vote host; hidden until hover/focus]       │
└───────────────────────────────────────────────────────────────────┘
```

- Controls use native buttons, accessible names, visible focus treatment, and keyboard activation.
- On pointer devices, the control fades in only while the image is hovered. On keyboard navigation, focus reveals it.
- No controls render where the image is absent on small screens.
- A chosen local icon remains selected during the current login journey. No message confirms the action.
- No counts appear here.

## Scoreboard surface

### Placement

A new low-weight menu item in the existing Le Løgin Settings menu group (`LeLøgin.Menu.Settings`), listed after Assets so it stays a quiet, deliberately-navigated surface rather than a headline feature.

```text
Settings
└─ Le Løgin
   ├─ Overview          weight 100
   ├─ Rules             weight  90
   ├─ Assets            weight  10
   └─ Scoreboard        weight   5   ← new
```

### Wireframe

```text
┌─ Le Løgin · Scoreboard ─────────────────────────────────────────────┐
│                                                                     │
│   #   Image              👍     👎     Net    Your vote             │
│  ───────────────────────────────────────────────────────────────    │
│   1   [thumb] Fjord      12      1     +11    👍  [👍] [👎]         │
│   2   [thumb] Dune        8      2      +6     –   [👍] [👎]         │
│   3   [thumb] Neon        3      9      −6    👎  [👍] [👎]         │
│   4   [thumb] Harbour     0      0       0     –   [👍] [👎]         │
│                                                                     │
│   21 backoffice users have voted.                                   │
└─────────────────────────────────────────────────────────────────────┘
```

- Every background asset is listed, including assets with no votes, so the board reads as the whole library rather than a partial extract.
- Server-side ordering: net score descending, then total votes descending, then name — a stable order that does not shuffle between renders.
- Thumbnails reuse the existing `/umbraco/le-løgin/api/v1/assets/{id}/thumbnail` route. The row links to the asset workspace.
- The per-row `[👍] [👎]` buttons exist only under option 1 of the vote-source decision. They call the direct vote endpoint, then re-read the board.
- Logo assets never appear. Only backgrounds are votable.
- Empty state: no background assets at all reuses the existing assets-empty phrasing rather than inventing a second empty message.

### Manifests

Mirrors the Overview surface (plain menu item plus a non-routable workspace bound to an entity type), not the tree-backed Assets or Rules surfaces — the scoreboard has no hierarchy and no per-item children.

```text
LeLøgin.MenuItem.Scoreboard      menuItem, weight 5, icon-trophy, manage condition
LeLøgin.Workspace.Scoreboard     workspace, entityType login-screen-scoreboard
LeLøgin.Repository.Vote          repository, manage condition
login-screen-scoreboard          new entity type
```

### Contract

```text
GET /umbraco/le-løgin/api/v1/votes/scoreboard        → ManageLeLøgin
{
  "totalVoters": 21,
  "entries": [
    { "assetId": "…", "name": "Fjord", "upVotes": 12, "downVotes": 1, "netScore": 11, "ownVote": 1 }
  ]
}
```

`ownVote` is `1`, `-1`, or absent. No `UserKey` and no user-identifying field appears in the response. Counts are computed on read with a `GROUP BY AssetId` over `LeLoginVotes` plus a `COUNT(DISTINCT UserKey)`; no counter columns are stored, so there is nothing to drift out of sync with the vote rows.

## Data design

Create a package-owned `LeLoginVotes` table via a new migration schema snapshot. Do not alter an existing migration snapshot.

| Column | Type | Notes |
| --- | --- | --- |
| `Id` | string GUID | Primary key, generated by Le Løgin. |
| `AssetId` | string | Required Le Løgin background asset identifier. |
| `UserKey` | GUID | Required Umbraco backoffice user key. |
| `Value` | integer | Required; only `1` (`👍`) or `-1` (`👎`) are valid. |
| `CreatedUtc` | UTC date/time | Set on the first vote. |
| `UpdatedUtc` | UTC date/time | Set whenever the user changes vote. |

Database indexes:

```text
PRIMARY KEY (Id)
UNIQUE      (AssetId, UserKey)
INDEX       (AssetId)
```

The unique index is the duplicate-prevention mechanism. The store performs an atomic upsert within one `IScopeProvider` scope, so concurrent submissions from multiple tabs cannot create duplicates. The `AssetId` index is what makes the scoreboard's aggregate query cheap, which is why no counters are pre-computed.

No user-display name, email address, IP address, device identifier, image URL, or free text is stored.

## Pre-login to post-login flow

```text
Login background request
  → LeLøginBackgroundMiddleware resolves background AssetId
  → server issues a short-lived, protected HttpOnly impression cookie

User selects 👍 or 👎
  → public vote control writes { value, expiresAt } to sessionStorage
  → selected icon is shown locally for this tab only

Successful authentication and backoffice entry point
  → authenticated vote synchroniser reads the pending value
  → POST /umbraco/le-løgin/api/v1/votes/pending { value }
  → server reads and validates impression cookie, then resolves current UserKey
  → ILeLøginVoteStore atomically inserts or updates (AssetId, UserKey)
  → response returns the canonical current value
  → client clears sessionStorage on success or expiry
```

The impression cookie is a short-lived ASP.NET Core Data Protection payload containing the resolved asset ID, issued/expiry timestamps, and a nonce. It is `Secure`, `HttpOnly`, and `SameSite=Lax`; its value is never exposed to JavaScript. `sessionStorage` is deliberately used for the pending choice because it survives the same-tab login redirects but disappears when that tab closes.

The authenticated endpoint rejects expired, malformed, or absent impressions, values other than `1` and `-1`, logo assets, and removed assets. It does not accept an `AssetId` or `UserKey` from the client. A replay is harmless because it is an idempotent update of the same unique row.

## Server work

1. Add domain models for `LoginImageVote`, its `LoginImageVoteValue` enum, and a `LoginImageVoteTally` aggregate, keeping persistence DTOs separate from API contracts.
2. Add `LeLoginVoteDto`, a matching immutable migration schema snapshot, and a `CreateLeLoginVotes` migration step after `AddRuleAssetIds` in the existing `LeLogin` migration plan. The migration creates the table plus its unique and lookup indexes on every supported database provider.
3. Add `ILeLøginVoteStore` and an NPoco/`IScopeProvider` implementation for:
   - getting a user's vote for an asset;
   - atomically creating or updating a vote;
   - deleting votes when an asset is deleted;
   - reading vote tallies per asset and the distinct-voter total in one scope, for the scoreboard.
4. Extend the asset-delete path so its asset row, managed files, rules references, and vote rows remain coherent if deletion succeeds or fails.
5. Add an impression-token service backed by ASP.NET Core Data Protection. `LeLøginBackgroundMiddleware` creates or refreshes the cookie only after a Le Løgin background has been resolved and its runtime image preparation has succeeded. Fall-through to Umbraco's default background creates no Le Løgin impression.
6. Add an authenticated vote controller under the existing versioned Le Løgin route, following the established `ApiBase` / `ApiControllerBase` / `ApiConfiguration` pattern. Its vote-writing endpoints must be protected by backoffice authentication but must not require the Settings-section or `ManageLeLøgin` policy: users may rate an image without permission to manage Le Løgin. Confirm the least-privileged standard Umbraco policy/API-base pattern during implementation.
7. Expose the pending-vote endpoint accepting only the value, deriving both asset and user from server-controlled context, and returning the canonical stored vote.
8. Add the direct vote endpoint `PUT votes/{assetId}` — option 1 of the vote-source decision. Same least-privileged authentication as the pending endpoint; server-derived `UserKey`; rejects unknown assets, logo assets, and values other than `1` and `-1`.
9. Add the scoreboard endpoint `GET votes/scoreboard`, protected by the `ManageLeLøgin` policy. It joins the background asset list with the tallies so zero-vote assets appear, applies the documented ordering server-side, and includes the caller's own vote per row. It returns no user-identifying field.
10. Generate the OpenAPI client only after the server contract and authentication requirements are final.

## Client work

Scoreboard work (items 1–4) is independent of the compatibility gate. Login-page work (items 5–8) is conditional on it.

1. Add `Client/lib/votes/` with a vote data source and repository built on the generated client and `UMB_AUTH_CONTEXT`; no raw `fetch()`, no `any`, no `as` casts.
2. Add `Client/lib/workspaces/scoreboard-workspace.element.ts` and its `.css`, using `UmbElementMixin(HTMLElement)` with manual DOM, `uui-*` components, and no Lit APIs — matching the existing rule-list workspace element.
3. Register the scoreboard menu item, workspace, entity type, and repository manifests with the manage-permission condition, and add the scoreboard localisation keys to `en`, `da`, `sv`, `fi`, and `nb-no` so the existing localisation-coverage test stays green.
4. Wire the per-row vote controls to the direct vote endpoint, re-reading the board after a successful write — option 1 of the vote-source decision.
5. Add a small, framework-free public vote surface only through the approved public host. It must not read or modify Umbraco login component DOM or shadow DOM, register localisations, or block login initialisation.
6. Add a narrowly scoped `sessionStorage` adapter with versioned key, expiry handling, value validation, and a deletion method. It stores no user or asset identity.
7. Add a backoffice vote synchroniser after `configureLeLøginScreenClient` in `Client/lib/backoffice-entry.ts`. It runs in the existing authenticated entry point, is fire-and-forget, and cannot prevent manifest registration or normal backoffice start-up.
8. If the endpoint reports no valid impression, clear the pending browser state silently. If it returns the current vote, retain it only as a local UI cache for the current tab.

Out of scope for this slice: a scoreboard link or summary on the Overview dashboard, score badges on asset cards, and any vote-driven change to rule resolution.

## Test-first implementation order

1. Write failing model/store tests for valid values, update-in-place semantics, separate assets/users, and duplicate submission under concurrency.
2. Write failing migration tests for a fresh install and upgrade from the current migration-plan state, including the unique `(AssetId, UserKey)` index.
3. Write failing store tests for the tally query: correct up/down counts per asset, correct distinct-voter total, and no row for a deleted asset.
4. Write failing controller tests proving anonymous requests fail, the user key is server-derived, invalid impressions/values fail, and valid requests upsert exactly one vote.
5. Write failing controller tests for the scoreboard endpoint proving it requires `ManageLeLøgin`, includes zero-vote background assets, excludes logo assets, applies the documented ordering, reports the caller's own vote, and exposes no user-identifying field.
6. Write failing controller tests for the direct vote endpoint proving it does **not** require `ManageLeLøgin`, rejects unknown and logo assets, and updates rather than duplicates an existing vote.
7. Write failing middleware/token tests proving the impression records only a successfully resolved Le Løgin background and expires correctly.
8. Write failing asset-deletion tests proving associated vote rows are removed.
9. Write failing client tests for the scoreboard element: loading, loaded, empty, and error states; row ordering as returned by the server; own-vote marker; and a row vote call that re-reads the board.
10. After the compatibility spike is approved, write failing client tests for hover/focus visibility, keyboard activation, local pending state, expiry, successful authenticated synchronisation, and silent handling of an expired impression.
11. Implement each red test in order, with no fallback or compatibility UI path.

## Post-Build Validation (REQUIRED)

- [ ] Run the focused .NET vote-store, tally, migration, middleware, controller, and asset-deletion tests.
- [ ] Run `dotnet build` from the repository root.
- [ ] Run `pnpm build` and `pnpm test:unit` from `Client/`.
- [ ] Regenerate the OpenAPI client and verify no generated-contract drift remains.
- [ ] Run a terminology/spelling review for project-owned text, preserving external API identifiers.
- [ ] Confirm the scoreboard appears under Le Løgin in Settings for a user with `ManageLeLøgin`, and that the menu item, workspace, and endpoint are all absent for a user without it.
- [ ] Confirm a user without `ManageLeLøgin` can still cast a vote.
- [ ] Inspect the scoreboard response for any user-identifying field; there must be none.
- [ ] Browser-test the scoreboard: zero-vote assets listed, ordering stable across reloads, own-vote marker correct, changing a vote updates the row without duplicating it, and logo assets absent.
- [ ] Browser-test a desktop pointer and keyboard flow on the login page: image appears, control stays hidden until hover/focus, selection survives the login redirect, exactly one authenticated vote is stored, and changing the vote updates rather than duplicates it.
- [ ] Browser-test small-screen layout: the login image and vote control are absent.
- [ ] Run fresh-cache, warm-cache, logout, password-reset, and MFA login flows to prove that voting has not delayed or broken login form initialisation.
- [ ] Review the implementation for raw management `fetch()` calls, `any`/unsafe casts, unauthorised asset/user input, and package DOM/shadow-DOM mutation.
