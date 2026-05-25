# Umbraco V14+ Backoffice Extension Concepts Summary

This document summarises key architectural concepts and implementation details for building Umbraco Backoffice extensions (V14 and later, utilising the new Management API and Web Components architecture).

## 1. The Package Manifest (`umbraco-package.json`)
The entry point for any Umbraco package is the `umbraco-package.json` file. It replaces the legacy `package.manifest`.

*   **Location:** Must reside in `App_Plugins/{YourPackageName}/umbraco-package.json`.
*   **Discovery:** Umbraco scans `App_Plugins` up to two levels deep on startup.
*   **Key Fields:**
    *   `id`: Unique identifier (often matches the NuGet Package ID).
    *   `version`: Must follow Semantic Versioning (SemVer).
    *   `allowPublicAccess`: Set to `true` if your extension needs to run before authentication (e.g., on the login screen).
    *   `extensions`: An array of static extension declarations. This is usually just the entry points, with the rest of the UI registered dynamically via JavaScript.

**Reference:** [Umbraco Package Documentation](https://docs.umbraco.com/umbraco-cms/extend-your-project/backoffice-extensions/umbraco-package)

---

## 2. Entry Points
Entry points are Javascript files that Umbraco executes at specific lifecycle moments.

### Types of Entry Points
*   **`backofficeEntryPoint`**: Runs **after** the user is logged into the backoffice. Used for registering Sections, Dashboards, Trees, Workspaces, and injecting global CSS.
*   **`appEntryPoint`**: Runs **before** the user logs in. Active on the public login screen. Used for pre-auth UI overrides (like custom background images).

### Implementation Requirements
An entry point file *must* export an `onInit` function of type `UmbEntryPointOnInit`.

```typescript
import type { UmbEntryPointOnInit } from '@umbraco-cms/backoffice/extension-api';

export const onInit: UmbEntryPointOnInit = (host, extensionRegistry) => {
    // Dynamic registration of manifests happens here
    extensionRegistry.registerMany([/* array of manifests */]);
};
```

**⚠️ Build System Gotcha (Vite):**
Because Umbraco imports these files dynamically and looks for the `onInit` export, you **must** configure your bundler (like Vite) to build as a **Library** (`build.lib`). If built as standard application scripts, the bundler's tree-shaking will remove the `export const onInit` because nothing inside the bundle calls it, resulting in an empty file and silently failing extensions.

**Reference:** [Backoffice Entry Point](https://docs.umbraco.com/umbraco-cms/extend-your-project/backoffice-extensions/extending-overview/extension-types/backoffice-entry-point), [App Entry Point](https://docs.umbraco.com/umbraco-cms/extend-your-project/backoffice-extensions/extending-overview/extension-types/app-entry-point)

---

## 3. Workspaces
Workspaces are the primary editing environments in the backoffice (e.g., editing a Document, Media item, or custom entity).

*   **Architecture Flow:**
    1.  **Workspace Context:** Acts as the centralized state manager. It exposes state via Observables.
    2.  **Workspace Views:** The tabs/content areas. They observe the Context to render data.
    3.  **Workspace Actions:** Buttons (usually in the footer) that trigger commands to mutate data.
*   **Scoping:** Workspaces are automatically scoped to their specific instance. If you have two documents open, their workspace contexts do not interfere with each other.

**Reference:** [Workspaces Documentation](https://docs.umbraco.com/umbraco-cms/extend-your-project/backoffice-extensions/extending-overview/extension-types/workspaces)

---

## 4. Extension Conditions
Conditions dictate *when* and *where* an extension should be visible or active. 

*   **Logic:** Multiple conditions defined on a single manifest are evaluated using **AND** logic (all must pass).
*   **Common Use Case:** Restricting a Dashboard or Sidebar to only show up when a specific Section is active.

**Example: Restricting a Dashboard to a specific section**
```typescript
const dashboardManifest = {
    type: 'dashboard',
    alias: 'My.Dashboard',
    // ...other config...
    conditions: [
        {
            alias: 'Umb.Condition.SectionAlias',
            match: 'My.Section.Alias' // Must match the Section's alias exactly
        }
    ]
};
```
*   **Common Aliases:** `Umb.Condition.SectionAlias`, `Umb.Condition.WorkspaceAlias`, `Umb.Condition.WorkspaceEntityType`.

**Reference:** [Extension Conditions Documentation](https://docs.umbraco.com/umbraco-cms/extend-your-project/backoffice-extensions/extending-overview/extension-conditions)

---

## 5. Security & Visibility (Sections)
When registering a new `section` extension via code, **it defaults to hidden for all users**. 
To make a newly registered section visible, an Administrator must:
1. Navigate to the **Users** section.
2. Edit the **Administrators** User Group (or another target group).
3. Explicitly assign access to the new Section in the group's permissions.

---

## Le Løgin project note

`Le Løgin` currently applies these extension concepts as follows:

- It uses a `backofficeEntryPoint` to configure its authenticated API client and then register manifests
- Instead of a top-level custom section, it currently integrates into `Umb.Section.Settings` using a `sectionSidebarApp` of kind `menu`
- It registers its own Settings-side menu items for `Overview` and `Assets`
- The Assets area uses a tree plus multiple workspaces:
    - root workspace
    - asset root workspace
    - asset workspace
    - dedicated asset upload workspace
- The Overview experience is rendered through a root workspace that hosts a custom dashboard element
- The asset slice follows the standard Umbraco flow of repository/context-driven state rather than direct element-level transport calls