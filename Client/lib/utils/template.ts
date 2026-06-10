// Side-effect import: ensures the UUI custom elements are registered before any
// caller clones a template that contains them. Without this, `customElements.upgrade`
// below would be a no-op for un-registered tags and the original property-existence
// guards on the resulting elements would fail.
import '@umbraco-cms/backoffice/components';

/**
 * Clones a `<template>`'s contents and immediately upgrades every custom element
 * inside the clone.
 *
 * Without the upgrade step, custom elements cloned out of a `<template>` are plain
 * `HTMLElement`s until they connect to a document — their custom properties
 * (`.value`, `.checked`, `.label`, `.href`, …) don't yet exist. Any guard that
 * checks for those properties would fail, and any code that writes to them would
 * silently set own-properties that the eventual upgrade may or may not pick up.
 *
 * Calling `customElements.upgrade(fragment)` walks the subtree and promotes every
 * uncustomised custom element to its registered class, so callers can rely on the
 * real component API immediately — guards work, property writes land on the real
 * setters, and we don't depend on the upgrade-fix race.
 */
export function cloneTemplate(template: HTMLTemplateElement, description: string): DocumentFragment {
	const fragment = template.content.cloneNode(true);
	if (!(fragment instanceof DocumentFragment)) {
		throw new Error(`${description} template clone failed.`);
	}
	customElements.upgrade(fragment);
	return fragment;
}
