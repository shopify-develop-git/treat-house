# Treat House UI kit

Every component here is a port of the Figma file. Each one lives in its own
`snippets/ui-*.liquid`, carries a `{% doc %}` block with its full parameter list,
and styles itself in a `{% stylesheet %}` block that Shopify bundles into the
theme's CSS.

Render one the ordinary way:

```liquid
{% render 'ui-button', variant: 'primary', label: 'Shop treats', link: '/collections/all' %}
```

`{% doc %}` in the snippet is the source of truth. The tables below are a map, not
a replacement — open the file when you need the detail.

---

## Buttons and links

### `ui-button`

Six variants in one snippet. Renders an `<a>` when `link` is given and a
`<button>` otherwise.

| variant | what it is |
| --- | --- |
| `primary` | filled purple, sky blue on hover |
| `secondary` | white with a hairline outline, fills on hover |
| `secondary-alt` | as above but transparent and set tighter |
| `link` | orange body text, purple and underlined on hover |
| `basket` | 40/48px icon square |
| `social` | 40/44px icon circle — set `icon` to `facebook`, `instagram`, `x` or `pinterest` |

`label` · `link` · `icon` · `disabled` · `full_width` · `type` ·
`open_in_new_tab` · `id` · `class` · `attributes`

```liquid
{% render 'ui-button', variant: 'secondary', label: 'Customize your own', link: '/pages/builder' %}
{% render 'ui-button', variant: 'basket', label: 'Add to cart', type: 'submit' %}
{% render 'ui-button', variant: 'social', icon: 'instagram', link: shop.metafields.social.instagram %}
```

---

## Form fields

### `ui-input`

Text field, or the taller multi-line box with `textarea: true`. A `mask` such as
`MM/DD/YYYY` turns it into a masked date field.

`label` · `type` · `textarea` · `value` · `placeholder` · `mask` · `hint` ·
`error` · `name` · `id` · `required` · `rows` · `class` · `attributes`

Passing `error` is what puts the field in its error state; `hint` hides while an
error shows.

### `ui-select`

A real `<select>` dressed as the kit's field. The kit draws its own option list,
but the native control carries keyboard support, type-ahead and the touch picker,
which are worth more than styling the list.

`label` · `options` (comma-separated) · `placeholder` · `selected` · `error` ·
`name` · `id` · `required` · `class` · `attributes`

### `ui-message`

The long message box, with a character counter.

`label` · `value` · `placeholder` · `maxlength` (default 200) · `name` · `id` ·
`required` · `class` · `attributes`

### `ui-file`

Upload zone with `default`, `uploading` and `added` states.

`label` · `state` · `filename` · `prompt` · `note` · `attached_label` ·
`remove_label` · `accept` · `name` · `id` · `required` · `class` · `attributes`

### `ui-checkbox` · `ui-radio`

The 12px indicators **on their own** — not form controls. Use them when you are
composing a row by hand; otherwise reach for `ui-choice-item`, which pairs them
with a real input.

`checked` · `class` · `attributes`

They read `:checked` from an input placed **immediately before** them:

```html
<input type="checkbox" checked>{% render 'ui-checkbox' %}
```

That contract is why the browser drives the state with no JS and no re-render.
Keep the input adjacent if you build your own row.

---

## Lists and rows

### `ui-choice-item`

A filter row: real `<label>` around a real hidden input, indicator, text. Clickable
and keyboard operable on its own, and a form can post it unchanged.

`label` · `type` (`checkbox`/`radio`) · `name` · `value` · `checked` ·
`disabled` · `id` · `class` · `attributes`

Selected recolours the label only — the row keeps its background. Only hover
tints.

### `ui-menu-item`

An option row for the dropdowns. No indicator, and unlike `ui-choice-item` its
selected state **keeps** the tint. That difference is why they are separate
snippets; do not merge them.

`label` · `link` · `selected` · `class` · `attributes`

### `ui-variant-item`

A product variant row: optional thumbnail, name, radio at the far end. 48px tall
with 16px text, against the filter row's 38px and 14px.

`label` · `image` · `name` · `value` · `checked` · `disabled` · `class`

---

## Filtering and sorting

All of these are built on `<details>`, which is the pattern Horizon's own facets
use. The open state, keyboard operation and Escape come from the browser, and
`data-auto-close-details` hands the outside click to the theme's existing
`auto-close-details.js`. **No new JavaScript — keep it that way.**

### `ui-filter-bar`

A row of filter groups. Takes `collection.filters` directly.

`groups` · `type` · `class`

### `ui-filter-dropdown`

One group: trigger plus panel, panel taken out of flow so it overlays the grid.

`label` · `heading` · `values` · `type` · `name` · `open` · `align` · `class`

### `ui-filter-panel`

The open body on its own — heading, rows, Apply, Clear all. Useful in a sidebar
where there is nothing to open.

`heading` · `values` · `type` · `name` · `apply_label` · `clear_label` · `class`

### `ui-filter-trigger`

Renders a `<summary>`, so it only works inside a `<details>`.

`label` · `class` · `attributes`

### `ui-sort-dropdown`

Filled purple trigger with a white label. Separate from the filter dropdown
because it shares no visual property with it.

`options` · `label` · `prefix` · `open` · `class`

### `ui-filter-chip` · `ui-remove-icon`

An applied-filter chip, and the remove disc it contains. The chip is not the
control — the disc is, because the kit gives only the disc a hover state.

Chip: `label` · `remove_label` · `class` · `attributes`
Disc: `label` · `class` · `attributes`

`values`, `groups` and `options` are read through `.label`, `.value` and
`.active`, which is the shape Shopify's `filter.values` and `sort_options`
already have. Plain strings work too.

---

## Product and navigation

### `ui-variant-select`

Trigger and panel as one disclosure. The kit files them as two components, but
the panel exists only to be what the trigger opens.

`options` · `label` · `image` · `name` · `open` · `class`

### `ui-quantity-stepper`

A real number input between two buttons. The only kit component with its own
script, `assets/ui-quantity-stepper.js`, which does nothing but move the value
within its min/max and fire `input` and `change`. It is deliberately **not** Horizon's
`quantity-selector-component`, which is bound to the cart and product form.

`value` · `min` · `max` · `name` · `label` · `disabled` · `class`

A button that cannot move the value any further disables itself.

### `ui-collection-card`

`variant: 'default'` is one link end to end. `variant: 'cta'` cannot be — a button
inside a link is invalid markup — so there the button carries the link.

`title` · `description` · `image` · `link` · `variant` · `button_label` ·
`class` · `attributes`

### `ui-pagination-item` · `ui-pagination-arrow`

Item: `label` · `link` · `current` · `class` · `attributes`
Arrow: `direction` · `label` · `link` · `disabled` · `class` · `attributes`

`current: true` also sets `aria-current="page"`. A disabled arrow keeps
`role="link"` with `aria-disabled` and drops its href, so it stays focusable
instead of vanishing from the tab order at the ends of a list.

---

## Tokens

Defined in `snippets/ui-kit-tokens.liquid`, rendered once from `layout/theme.liquid`.
Colour names match the Figma styles so a value traces back to the design without a
lookup table.

| token | value |
| --- | --- |
| `--ui-color-primary` | `#6c276a` |
| `--ui-color-white` / `--ui-color-black` | `#ffffff` / `#000000` |
| `--ui-color-sky-blue` | `#a3d8f6` — primary button hover |
| `--ui-color-light-blue` | `#ddf2ff` — row and icon hover |
| `--ui-color-orange` | `#ea6f36` — link button |
| `--ui-color-gray` | `#555555` — secondary copy |
| `--ui-color-border-gray` | `#d1d1d1` |
| `--ui-color-accents-red` / `--ui-color-error` | `#ff383c` |
| `--ui-font-body` / `--ui-font-body-weight` | Nunito Regular |
| `--ui-font-emphasis` / `--ui-font-emphasis-weight` | Nunito SemiBold — the theme's subheading token |
| `--ui-font-accent` | Outfit |
| `--ui-line-height` | `1.3` |
| `--ui-radius-sm` | `2px` |
| `--ui-hairline-width` | `0.5px` |
| `--ui-disabled-opacity` | `0.3` |

Typography maps onto the theme's own font settings rather than naming families.
Note `--ui-font-emphasis`: the design asks for Nunito SemiBold, and the theme only
loads the body face at 400 and 700, so `--ui-font-body` at weight 600 would render
a synthesised face.

---

## Conventions worth keeping

**Borders are inset shadows, not borders.** `box-shadow: inset 0 0 0 <width>` does
not affect layout, so a border that thickens on hover — as several do — cannot
shift anything. A real border made secondary buttons 1px taller than primary ones.

**State is expressed through custom properties.** A component declares
`--ui-<name>-background` and friends on itself and consumes them; variants and
states redeclare the properties rather than repeating the rules. Follow this when
adding one.

**The theme styles focus and hover globally.** `base.css` carries
`summary:hover { color: … }` and `*:focus-visible { outline: … }`. A pseudo-class
counts as a class, so a single class does not outrank them — name the element too
(`summary.ui-x:hover`) or move the ring to the wrapper with `:has()`. Both traps
have already bitten this kit once.

**Icons keep the exact path data from Figma's node exports**, with `fill` or
`stroke` swapped to `currentColor` so a hover recolours them. Do not redraw an
icon by hand; export the node.

**`--force-hover` classes are for previews only.** Every component with a hover
state accepts one so the QA sections can pin it. They have no place in real page
markup.

---

## Previewing

Three sections, available under "Add section", each mirroring its Figma frame:

- `ui-kit-buttons` — the BUTTONS frame
- `ui-kit-components` — the COMPONENTS frame, all 21 families
- `ui-kit-inputs` — the INPUT frame

None is on a template by default. Add one in the theme editor, look, remove it.
The "Hovered" columns are pinned; the "Default" column still reacts to a real
pointer, so a state can be checked against the design and exercised in the same
glance.

---

## Known issues

**Hairlines can disappear.** `--ui-hairline-width` is `0.5px`, which the design
specifies, but Chrome renders a sub-pixel inset shadow spread faintly or not at
all — the quantity stepper's outline is missing on screen. This affects every
0.5px outline in the kit: secondary buttons, the filter trigger, collection cards,
the variant panel. Not yet fixed; the shape of the fix is to draw those hairlines
with something that survives sub-pixel rendering.

**Nothing is wired to data.** See the note in `CLAUDE.md`.
