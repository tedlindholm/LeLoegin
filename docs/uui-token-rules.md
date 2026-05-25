# Le Løgin UUI token rules

A compact checklist for consistent, theme-safe styling in Le Løgin.

## Core rules

- Use **UUI interface tokens** (`--uui-color-*`) for app UI colours.
- Do **not** style general UI directly with brand palette tokens (`--uui-palette-*`).
- Prefer semantic colour intent over literal colour picking.
- Use UUI spacing/sizing tokens (`--uui-size-*`, `--uui-size-space-*`, `--uui-size-layout-*`) instead of ad-hoc pixel values where practical.
- Keep component radius aligned with `--uui-border-radius`.

## Colour usage guidance

### Base surfaces and text

- Surface/background: `--uui-color-surface`, `--uui-color-surface-alt`, `--uui-color-background`
- Text: `--uui-color-text`, `--uui-color-text-alt`
- Interactable text/icons: `--uui-color-interactive`, `--uui-color-interactive-emphasis`
- Dividers/borders: `--uui-color-divider`, `--uui-color-divider-standalone`, `--uui-color-divider-emphasis`

### State and feedback

- Selection: `--uui-color-selected` (+ `-contrast`, `-standalone`, `-emphasis`)
- Current nav/location: `--uui-color-current` (+ variants)
- Disabled: `--uui-color-disabled` (+ variants)
- Focus ring: `--uui-color-focus`
- Semantic status: `--uui-color-default`, `--uui-color-warning`, `--uui-color-danger`, `--uui-color-invalid`, `--uui-color-positive` (+ variants)

### Header

- Header surface/contrast: `--uui-color-header-surface`, `--uui-color-header-contrast`, `--uui-color-header-contrast-emphasis`

## Variant meanings

- `-contrast`: readable foreground against the base colour
- `-standalone`: stronger contrast than base (good for thin/small UI)
- `-emphasis`: stronger prominence (often hover/focus accent)

## Typography helpers

- Use `.uui-font` for Umbraco typography base.
- Use `.uui-text` (with `.uui-font`) for standard typographic element styling.

## Sizing scale reminders

- Spacing scale: `--uui-size-space-1..6`
- Layout scale: `--uui-size-layout-1..6`
- General scale: `--uui-size-*`
- Radius: `--uui-border-radius`

## Quick review checklist

- [ ] No raw hex/rgb values for standard UI colours where an interface token exists.
- [ ] No direct `--uui-palette-*` usage for routine component styling.
- [ ] Focus states use `--uui-color-focus` (or equivalent semantic token).
- [ ] Spacing and layout use UUI sizing tokens consistently.
- [ ] Text/background combinations rely on semantic token pairs with good contrast.

## Source references

- https://apidocs.umbraco.com/v17/ui/?path=/docs/uui_design-css--docs
- https://apidocs.umbraco.com/v17/ui/?path=/docs/uui_design-custom-properties--docs
- https://apidocs.umbraco.com/v17/ui/?path=/story/uui_design-custom-properties--interface-colors
- https://apidocs.umbraco.com/v17/ui/?path=/story/uui_design-custom-properties--brand-palette
- https://apidocs.umbraco.com/v17/ui/?path=/story/uui_design-custom-properties--sizing
