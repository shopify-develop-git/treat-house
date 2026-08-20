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

`label` · `link` · `icon` · `disabled` · `full_width` · `type` · `tag` ·
`open_in_new_tab` · `id` · `class` · `attributes`

`tag: 'span'` renders the look without the control, for a button whose behaviour
belongs to an ancestor — the one inside the gift message card's `<summary>`, where
a real `<button>` would swallow the click the disclosure needs. Nothing clickable
should use it.

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

`label` · `image` · `name` · `value` · `checked` · `disabled` · `class` ·
`attributes`

`attributes` lands on the input. It is how the row carries the data attributes
Horizon's variant picker reads, so the kit row can stand in for the theme's own
without either side knowing about the other.

### `ui-tag`

The informational pill — the Gluten-Free and Arrives gift-ready pair on the product
page. It wears the secondary button's clothes and is not a control: nothing happens
when it is clicked and the file gives it no hover, so it renders a `<span>`.

`label` · `icon` · `class` · `attributes`

### `ui-icon-label`

A glyph with its wording beneath, centred — the row of four under the buy buttons.
Sized by custom properties rather than settings, so the same item runs at 24px under
a buy row and smaller in a narrow card without growing a variant.

`label` · `icon` · `class`

### `ui-panel`

The bordered white card the product page uses four times: gift message, estimated
shipping, ingredients, storage. One shape with an optional glyph, an optional
disclosure, and two paddings.

`title` · `icon` · `intro` · `body` · `collapsible` · `open` · `chevron` ·
`padding` (`default`/`tight`) · `id` · `class` · `attributes`

`intro` stays visible when the card is closed; `body` is what opening reveals. Both
arrive as captured markup, since Liquid has no slots. The whole head is the click
target, not just the caret.

### `ui-breadcrumb`

The trail above a page title. `links` takes anything with `.title` and `.url` —
the shape a collection, page, blog or article already has — so a caller hands over
the resources it has instead of assembling hashes. Home is the snippet's own, and
the current page carries no link.

`links` · `current` · `home_label` · `class`

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

`options` · `rows` · `label` · `image` · `name` · `open` · `class` · `attributes`

Give it `options` for the simple case. `rows` takes captured `ui-variant-item`
markup instead, for a caller that has to put its own attributes on every row —
Liquid cannot build an array of hashes, so the rows arrive already rendered rather
than teaching this snippet where they came from. `ui-panel` takes its content the
same way.

### `ui-product-variant-picker`

The wired one. Renders `<variant-picker>` from `assets/variant-picker.js` around
one `ui-variant-select` per product option, so choosing a variant re-fetches the
product, updates the URL and fires `variant:update` for the price, the buy button
and the gallery to answer. The look is entirely the kit's; the behaviour is
entirely the theme's.

`product_resource` · `label_prefix` · `class`

`label_prefix` leads the option's own name — "Choose your" gives "Choose your Box" —
and stands down when the name already starts with the same word, because catalogues
really do have an option called "Choose a Pack".

The disclosure carries `declarative-open`, which is `assets/morph.js`'s opt-out from
its default of preserving a `<details>`'s open state across a morph. Without it the
list stays open over the page after every choice.

### `ui-product-gallery`

The product page's media column: a framed stage at the drawn 630:578, a corner
badge, and thumbnails beneath. Every image is in the markup and all but one carry
`hidden`, so switching costs no request and a variant change can reveal its featured
media without the snippet building a URL. `assets/ui-product-gallery.js` moves that
attribute and nothing else.

`product` · `badge` · `badge_tone` · `eager` · `class`

The image is contained, not cropped — the frame is wider than it is tall and the
treats are photographed square. The slide is inset out of flow rather than held off
the edge by padding: a percentage height inside a box sized by `aspect-ratio` is
circular, and Chrome breaks the cycle by sizing the frame to its contents, which
made the frame 96px taller than it is drawn.

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

### `ui-product-card`

The tile in a product row. One stretched link on the title makes the whole card
clickable, so the basket beside the price can stay a control of its own rather
than a button nested inside a link.

`title` · `subtitle` · `price` · `image` · `link` · `badge` · `badge_tone` ·
`show_add` · `add_label` · `add_attributes` · `add_content` · `class` · `attributes`

Pass `price` already run through `money`. A named `render` argument takes no
filter, and gets no complaint when you give it one — `price: product.price | money`
hands the card the raw cents.

The hover ring is drawn on `::after`, not as the card's own inset shadow: an inset
shadow paints under the element's children, and the photograph runs to three of the
card's edges.

`add_content` is a slot. Left empty the card draws a decorative basket; fill it and
the card keeps drawing the square while something else owns the behaviour.

### `ui-product-card-add`

What goes in that slot when the basket has to work. Renders one of two things:

- a submit inside `<product-form-component>` when the product has a single variant,
  which posts to the cart the same way [_ui-product-buy] does on the product page;
- a link to the product page when the product has options, because choosing a
  flavour for the shopper is not a decision a basket icon gets to make.

`product` · `section_id` · `class`

Deliberately not Horizon's `quick-add`, whose chooser fills its modal by fetching
the product page and lifting `[data-product-grid-content]` out of it — an element
that belongs to Horizon's `product-information` section and is not on this theme's
product page. A quick-add in the kit's own clothes is unbuilt, and undrawn.

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
