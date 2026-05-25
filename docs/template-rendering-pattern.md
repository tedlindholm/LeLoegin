# Le Løgin template rendering for custom elements

This is Le Løgin's default pattern for rendering and re-rendering DOM in custom elements. It is platform-first: use standard DOM and shadow-DOM APIs, then layer Umbraco compatibility on top where needed.

## TL;DR

| Situation                                                 | Use                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Trusted one-shot shell scaffolding in `connectedCallback` | `shadow.innerHTML = /* html */ \`...\`` (current pattern, no change)            |
| Re-rendering a subtree on state changes                   | `<template>` + `cloneNode(true)` + `replaceChildren(...)`                       |
| Updating a small part of a stable subtree                 | Direct `textContent`, property assignment, `toggleAttribute`, or `setAttribute` |

Think in standard custom-element terms: build one stable shell, keep stable event boundaries, and on state changes either update specific nodes or swap descendants built from a `<template>`. Umbraco changes which components we render, not how the rendering model works.

## Core rules

- Re-render paths must not reassign `innerHTML`. Build nodes from a `<template>` and swap descendants with `replaceChildren`.
- When only a small field changes, update that field directly rather than rebuilding the subtree.
- Never interpolate user-controlled values into HTML strings. Set values after cloning via `textContent`, element properties, or validated attributes.
- `setAttribute` is not a blanket safety guarantee. Values assigned to URL-bearing attributes or properties such as `href`, `src`, `action`, `formAction`, and `srcdoc` still need explicit validation.
- Templates are static. Define them once per element or module, not per render.
- Give each template a single root element, or handle multiple roots deliberately.
- Trusted one-shot shell `innerHTML` in `connectedCallback` is fine. Do not refactor it for its own sake.
- Native elements, `uui-*` elements, and `umb-*` elements all follow the same rendering pattern because they are all DOM nodes.

## The pattern

The example below uses standard HTML elements so the rendering pattern is clear. In Le Løgin, the same clone-populate-swap flow applies when those descendants are UUI or Umbraco custom elements.

### 1. Declare a template once

```ts
function getRequiredTemplate(root: ShadowRoot, id: string): HTMLTemplateElement {
	const element = root.getElementById(id);
	if (!(element instanceof HTMLTemplateElement)) {
		throw new Error(`Expected <template id="${id}"> in shadow root.`);
	}
	return element;
}

shadow.innerHTML = /* html */ `
    <section part="body">
        <div id="list-box"></div>
    </section>
    <template id="row-template">
        <article class="rule-row">
            <button class="drag-handle" type="button" draggable="true" aria-label="Reorder rule">
                Drag
            </button>
            <a class="ref"></a>
            <label class="enabled-toggle">
                <input class="enabled-input" type="checkbox" />
                <span class="enabled-label"></span>
            </label>
            <button class="delete-btn" type="button"></button>
        </article>
    </template>
`;

this.#rowTemplate = getRequiredTemplate(shadow, "row-template");
```

A module-level `document.createElement('template')` constant is equally valid. The important part is that the template is parsed once and cloned thereafter.

### 2. Build a row by cloning and populating

```ts
function queryRequired(root: ParentNode, selector: string): Element {
    const element = root.querySelector(selector);
    if (element === null) {
        throw new Error(`Expected ${selector} in template.`);
    }
    return element;
}

#buildRow(rule: LoginRule): HTMLElement {
    const fragment = this.#rowTemplate.content.cloneNode(true);
    if (!(fragment instanceof DocumentFragment)) {
        throw new Error('Row template clone failed.');
    }

    const row = fragment.firstElementChild;
    if (!(row instanceof HTMLElement)) {
        throw new Error('Row template must have a single HTMLElement root.');
    }

    row.dataset.id = rule.id;

    const handle = queryRequired(row, '.drag-handle');
    if (!(handle instanceof HTMLButtonElement)) {
        throw new Error('Expected .drag-handle button.');
    }
    handle.dataset.id = rule.id;

    const ref = queryRequired(row, '.ref');
    if (!(ref instanceof HTMLAnchorElement)) {
        throw new Error('Expected .ref anchor.');
    }
    ref.textContent = rule.name ?? 'Untitled rule';
    ref.href = buildRuleWorkspacePath(rule.id);

    const enabledInput = queryRequired(row, '.enabled-input');
    if (!(enabledInput instanceof HTMLInputElement)) {
        throw new Error('Expected .enabled-input checkbox.');
    }
    enabledInput.checked = rule.enabled;
    enabledInput.dataset.id = rule.id;

    const enabledLabel = queryRequired(row, '.enabled-label');
    if (!(enabledLabel instanceof HTMLSpanElement)) {
        throw new Error('Expected .enabled-label span.');
    }
    enabledLabel.textContent = 'Enabled';

    const deleteButton = queryRequired(row, '.delete-btn');
    if (!(deleteButton instanceof HTMLButtonElement)) {
        throw new Error('Expected .delete-btn button.');
    }
    deleteButton.textContent = 'Delete';
    deleteButton.dataset.id = rule.id;

    return row;
}
```

No `escapeHTML`: values cross the DOM boundary through properties, `textContent`, or validated attributes, so HTML in `rule.name` becomes text rather than markup.

### 3. Swap the list atomically

```ts
#render() {
    if (this.#listBox === undefined) return;

    if (this.#isLoading) {
        const status = document.createElement('p');
        status.textContent = 'Loading rules...';
        status.setAttribute('aria-live', 'polite');
        this.#listBox.replaceChildren(status);
        return;
    }

    if (this.#loadError) {
        const message = document.createElement('p');
        message.className = 'empty-state';
        message.textContent = 'Failed to load rules. Check browser console for details.';
        this.#listBox.replaceChildren(message);
        return;
    }

    if (this.#rules.length === 0) {
        const message = document.createElement('p');
        message.className = 'empty-state';
        message.textContent = 'No rules yet.';
        this.#listBox.replaceChildren(message);
        return;
    }

    const list = document.createElement('div');
    list.className = 'rule-list';

    for (const rule of this.#rules) {
        list.append(this.#buildRow(rule));
    }

    this.#listBox.replaceChildren(list);
}
```

Replace the placeholder text nodes with UUI components where the interface calls for them. The rendering step stays the same: build nodes, then swap descendants.

### 4. Keep delegated listeners on the stable container

The container (`#listBox` in this example) is created once by the shell `innerHTML` and persists across renders, so delegated listeners attached in `connectedCallback` keep working. `replaceChildren` swaps descendants but does not touch the container itself.

## Umbraco compatibility

- `uui-*` and `umb-*` elements fit this pattern unchanged. Clone them, append them, and then set their documented properties or attributes.
- Prefer platform DOM APIs for rendering. Use Umbraco-specific APIs only for actual Umbraco concerns such as context consumption, localisation, workspace URLs, and UUI component configuration.
- When a UUI or Umbraco element exposes a property that carries richer state than an attribute, set the property after cloning. When that value is a navigation target or external URL, validate it before assignment.
- Keep the current `connectedCallback` shell pattern unless there is a concrete lifecycle reason to move it. The goal is standard custom-element rendering, not gratuitous churn.

## Where this is already applied

The first migration pass is complete. These files now use the clone-populate-swap pattern for their re-render paths and are the best in-repo examples to follow when adding new workspaces, editors, collection views, or modals:

- [Client/lib/workspaces/rule-list-workspace.element.ts](../Client/lib/workspaces/rule-list-workspace.element.ts) - rule rows with delegated drag, toggle, and delete handling
- [Client/lib/workspaces/asset-root-workspace.element.ts](../Client/lib/workspaces/asset-root-workspace.element.ts) - asset actions, sections, and cards
- [Client/lib/workspaces/asset-group-card-collection-view.element.ts](../Client/lib/workspaces/asset-group-card-collection-view.element.ts) - asset card collection rendering
- [Client/lib/workspaces/asset-workspace.element.ts](../Client/lib/workspaces/asset-workspace.element.ts) and [Client/lib/workspaces/asset-workspace.helpers.ts](../Client/lib/workspaces/asset-workspace.helpers.ts) - workspace body, preview, and field composition
- [Client/lib/workspaces/rule-workspace.element.ts](../Client/lib/workspaces/rule-workspace.element.ts) - rule editor body and asset selection UI
- [Client/lib/workspaces/logo-picker-modal.element.ts](../Client/lib/workspaces/logo-picker-modal.element.ts) - modal body and logo cards
- [Client/lib/workspaces/asset-upload-workspace.element.ts](../Client/lib/workspaces/asset-upload-workspace.element.ts) - upload form fields and selected-file state
- [Client/lib/workspaces/root-workspace.element.ts](../Client/lib/workspaces/root-workspace.element.ts) - rule menu rendering
- [Client/lib/dashboard/overview-dashboard.element.ts](../Client/lib/dashboard/overview-dashboard.element.ts) - preview shell rendering
- [Client/lib/rules/condition-editor.element.ts](../Client/lib/rules/condition-editor.element.ts) - condition rows and value controls

Use the same pattern for any future component that rebuilds descendants in response to observable or async state changes. If a new `#render()` path is about to concatenate HTML strings into `innerHTML`, stop and move that subtree behind a static template plus DOM population instead.

Leave the one-shot shell scaffolding alone when it runs once, has no untrusted interpolation, and only establishes stable containers for later updates. Rewriting that shell as `createElement` chains would just be noise.

## Why

1. **Markup-injection safety.** Values reach the DOM through properties, `textContent`, and attributes rather than string concatenation, so the HTML parser never treats them as markup. This removes the need for ad hoc escaping in normal render paths. URL-bearing attributes and properties still need value validation.
2. **Stable DOM during re-renders.** Reassigning `innerHTML` destroys every descendant, including the node with focus, the node being dragged, the scroll position of any inner scroller, and the identity of any non-delegated event listeners. Templates keep the container intact, and a later optimisation can diff rows by `data-id` rather than swapping the whole list.
3. **Standard custom-element rendering.** `<template>`, `cloneNode`, and `replaceChildren` are platform primitives. They work the same with native elements and with other custom elements, including Umbraco's backoffice components. This also aligns with the project's "no Lit" rule without making the rule itself the main reason.

## What this does not change

- The "no Lit" rule still holds. Do not introduce `html` tagged templates, `UmbLitElement`, `@customElement`, or the `lit-html` `render()` function. The existing source-scan tests in `*.element.test.ts` continue to enforce this.
- Shell scaffolding in `connectedCallback` can continue to use `innerHTML` with the `/* html */` hint when the markup is static and trusted.
- `escapeHTML` remains the correct tool anywhere a string genuinely must be concatenated into HTML. Treat that as an exception, not the default render path.
