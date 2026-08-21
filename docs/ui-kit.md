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

### `ui-feature-card`

The white card in a reassurance row — the three under "Why choose us". A glyph, a
title in the heading face and a paragraph, centred in a 20px-radius panel with no
border. Not `ui-panel`, which is the bordered disclosure card with a left-aligned
14px head; these two share nothing but the word "card".

`title` · `body` · `icon` · `tag` (default `h3`) · `class` · `attributes`

Sized by custom properties like `ui-icon-label`, so a caller runs it at the drawn
24px title three across and smaller where the columns are narrower without a
variant: `--ui-feature-card-padding-block`, `--ui-feature-card-padding-inline`,
`--ui-feature-card-gap`, `--ui-feature-card-text-gap`, `--ui-feature-card-glyph`,
`--ui-feature-card-title-size`, `--ui-feature-card-body-size`.

It fills the height of the cell it stands in, so a row lines up along the bottom
without the caller measuring the longest card.

### `ui-panel`

Every disclosure in the theme, in two skins. `variant: 'card'` is the bordered white
card the product page uses four times — gift message, estimated shipping,
ingredients, storage. `variant: 'bar'` is the filled light-blue row the FAQ stacks.

`title` · `variant` (`card`/`bar`) · `icon` · `intro` · `body` · `collapsible` ·
`animated` · `open` · `chevron` · `padding` (`default`/`tight`) · `id` · `class` ·
`attributes`

They are one component because everything hard about a disclosure is shared — the
`<summary>` reset, the two `base.css` rules that outrank a lone class, and the
`::details-content` animation below — while what differs is a background, a padding,
a type scale and which glyph marks the toggle. Those live on the block as custom
properties (`--ui-panel-background`, `--ui-panel-edge`, `--ui-panel-padding`,
`--ui-panel-title-font`, `--ui-panel-title-size`, `--ui-panel-title-weight`,
`--ui-panel-title-case`, `--ui-panel-title-line-height`, `--ui-panel-gap`), so a
variant redeclares values rather than repeating rules.

`chevron` switches the toggle mark on and off; **which** mark is drawn belongs to the
variant — a caret on `card`, a plus that becomes a minus on `bar`. The bar renders
both glyphs and CSS shows one, so the swap costs no script and the horizontal stroke
does not move between the states. `padding` does not reach the bar: its 24px is part
of what a bar is, and the modifier class is not written at all rather than left to
lose a same-specificity fight on source order.

The bar is the one thing here the file draws at 1440 only, so its step down at 750 —
20px padding, an 18px question — is a decision made in code, not read off the design.
The mark keeps its 24px at every width because it is the tap target.

`intro` stays visible when the card is closed; `body` is what opening reveals. Both
arrive as captured markup, since Liquid has no slots, and both get their own wrapper —
a `<details>` cannot space them with its own `gap`, because Chrome collects everything
after the `<summary>` into one `::details-content` box, so the gap lands above that box
rather than between the things inside it. The whole head is the click target, not just
the caret.

`animated` opens and closes the card over time instead of at once, on the same
`::details-content` recipe and the same timing tokens `base.css` gives Horizon's own
accordions — so a card here and an accordion elsewhere move at one speed, and it still
costs no script. Two things it depends on, both found the hard way:

- **An animated card is not a flex container.** As a flex item the content box is sized
  by flex layout, which quietly wins over the `block-size` being animated: the copy
  faded in and the padding grew while the card itself snapped to full height. The
  animated variant is `display: block`, and the head and body run their own flex inside.
- **The space above the revealed part is padding on the content box, not the panel's
  row gap.** A closed `<details>` still lays out a zero-height content box, so a gap
  there leaves dead air under every shut card; as padding it grows and collapses with
  the box.

It is a parameter rather than the default because not every disclosure wearing this
card is an accordion — the gift message card reveals a field someone is about to type
into, and sliding it into place under them is worse than putting it there.

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

**These filter.** `sections/collection-products.liquid` puts the bar inside a
`<form method="get">` pointed at the collection, and that is the whole mechanism: a
choice row is a real checkbox named for its facet, Apply is a real submit, and Clear
all, the chips and the pagination are real links. Nothing here knows it is talking to
Shopify — the caller hands over `collection.filters` and the URLs Shopify already
computed. Read that section before wiring the bar somewhere else; the two traps it
had to solve are written down in its own comment.

### `ui-filter-bar`

A row of filter groups. Takes `collection.filters` directly.

`groups` · `type` · `clear_link` · `range_prefix` · `range_form_id` · `class`

A group Shopify types `price_range` carries a min and a max instead of a list; the
bar spots that and passes it down as the panel's `range` kind, so the Price group
does not render as an empty panel.

### `ui-filter-dropdown`

One group: trigger plus panel, panel taken out of flow so it overlays the grid.

`label` · `heading` · `values` · `type` · `name` · `open` · `align` · `class`

### `ui-filter-panel`

The open body on its own — heading, rows, Apply, Clear all. Useful in a sidebar
where there is nothing to open.

`heading` · `values` · `type` (`checkbox`/`radio`/`range`) · `name` · `min_name` ·
`max_name` · `min_value` · `max_value` · `range_prefix` · `apply_label` ·
`clear_label` · `clear_link` · `form_id` · `class`

Apply is a real submit and Clear all is a real link, so a panel inside a form filters
with no script. `form_id` is there for the `range` kind only: an empty number field
still posts its name, so a price group that shared the checkbox groups' form would
put `&filter.v.price.gte=` on the URL every time anybody ticked anything anywhere.
The `form` attribute is the language's own answer — the fields sit inside that form's
markup and belong to a different one.

### `ui-filter-trigger`

Renders a `<summary>`, so it only works inside a `<details>`.

`label` · `class` · `attributes`

### `ui-sort-dropdown`

Filled purple trigger with a white label. Separate from the filter dropdown
because it shares no visual property with it.

`options` · `items` · `label` · `prefix` · `open` · `class`

`options` is for the previews. A real collection hands over `items` — the rows
already rendered — because `collection.sort_options` carries a name and a value and
no link, and the link a sort row needs has to keep whatever facets are applied. That
is the caller's knowledge, and assembling URLs is not a thing a component that only
knows how to look should be doing.

### `ui-filter-chip` · `ui-remove-icon`

An applied-filter chip, and the remove disc it contains. The chip is not the
control — the disc is, because the kit gives only the disc a hover state.

Chip: `label` · `remove_link` · `remove_label` · `class` · `attributes`
Disc: `link` · `label` · `class` · `attributes`

Given a `link` the disc renders an `<a>` instead of a `<button>`, which is what
clearing a facet wants: Shopify's `value.url_to_remove` is a place to go, and a real
link keeps middle-click, open-in-new-tab and the back button working.

`values`, `groups` and `options` are read through `.label`, `.value` and
`.active`, which is the shape Shopify's `filter.values` and `sort_options`
already have. Plain strings work too.

---

## Product and navigation

### `ui-variant-select`

Trigger and panel as one disclosure. The kit files them as two components, but
the panel exists only to be what the trigger opens.

`options` · `rows` · `label` · `image` · `name` · `open` · `class` · `attributes`

The trigger's outline is what separates its three drawn states: the border gray
when closed, purple while hovered or open. The width never moves, and the panel's
own outline stays gray throughout.

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
badge, prev/next arrows over the image, and thumbnails beneath. Every image is in
the markup and all but one carry `hidden`, so switching costs no request and a
variant change can reveal its featured media without the snippet building a URL.
`assets/ui-product-gallery.js` moves attributes and nothing else.

`product` · `badge` · `badge_color` · `eager` · `class`

Switching is a crossfade: the incoming photograph is unhidden and painted at zero,
both slides transition, and the outgoing one takes `hidden` back once the transition
has run. `hidden` stays the resting state between turns because an always-painted
stack would read the same and pull every photograph on the product down on first
paint. The timing lives once, in `--ui-product-gallery-fade`, and the script reads
it back off the slide rather than keeping a copy — which also means
`prefers-reduced-motion` costs nothing extra, since a slide with no transition
reports no duration and the swap lands at once.

The arrows are `ui-pagination-arrow`, revealed by hovering the frame. They are
`opacity: 0` rather than `visibility: hidden` at rest, so they stay in the tab order
and the frame's `:focus-within` brings them into view for a keyboard; under
`(hover: none)` they simply stay, since there is no hover to reveal them with. They
wrap at the ends rather than disabling — with three or four photographs, an arrow
that greys itself out is a dead control half the time you reach for it. Like the
thumbnails, they are drawn only when there is more than one image.

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

### `ui-mega-promo`

The card at the right of a mega menu panel. It keeps the 255px it was drawn at
and its picture keeps a 223×162 box, because collection images are square as
often as not and a box that sized itself to one made the card 60px taller than
the panel around it.

Horizon's mega menu has no per-panel content of its own — all four of its submenu
styles build themselves out of the navigation — so the card's settings live on
the `_header-menu` block and it renders in every panel. That is the one place in
this theme where merchant copy is a setting rather than a block: a static block
needs a literal `id`, so it cannot be keyed to the panel it opens from.

With no image chosen it falls back to the featured image of the collection its
button points at.

`image` · `heading` · `text` · `button_label` · `button_link` · `class`

### `ui-product-card`

The tile in a product row. One stretched link on the title makes the whole card
clickable, so the basket beside the price can stay a control of its own rather
than a button nested inside a link.

`title` · `subtitle` · `price` · `image` · `link` · `badge` · `badge_color` ·
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

What goes in that slot when the basket has to work. A submit inside
`<product-form-component>`, posting to the cart the same way [_ui-product-buy]
does on the product page, and disabled when the product is sold out.

`product` · `section_id` · `class`

It adds the variant the card is priced at — `product.price` is the cheapest
variant's, and that is the one the form carries, so the square and the number
beside it always agree. In this catalogue a box's options are paid extras (gift
box, individual packs, how many treats are made custom), so that variant is the
plain box and nothing is being chosen on the shopper's behalf. Point a row at
products whose options are alternatives rather than add-ons and that stops being
true — the row wants a chooser then, which is unbuilt.

Deliberately not Horizon's `quick-add`, whose chooser fills its modal by fetching
the product page and lifting `[data-product-grid-content]` out of it — an element
that belongs to Horizon's `product-information` section and is not on this theme's
product page.

### `ui-recently-viewed`

Not a picture — a script loader, the way `ui-carousel` is. It writes nothing and
draws nothing; rendering it puts `assets/ui-recently-viewed.js` on the page, and the
`<ui-recently-viewed>` element the section writes does the rest.

The element fills a product row with what this visitor has looked at. Shopify has no
object for that, since it is per-visitor and per-device, so the list lives in
localStorage. The cards themselves do not: the element asks
`/search?q=id:… &section_id=` for its own section a second time and lifts the row out
of what comes back, so a card here is the same Liquid as a card anywhere else. That
is Horizon's `product-recommendations` trick over a different endpoint.

Three things the element needs, and one it gives back:

- `data-url` the search route, `data-section-id` the section to re-render,
  `data-product-id` the product being looked at — recorded for next time, and kept
  out of its own row.
- Every card carries `data-product-id`, because search answers in relevance order and
  the row is put back into the order the products were seen in. Without that it is
  products you have looked at, not products you have *recently* looked at.

It starts `hidden` and only shows once it has something. A visitor on their first
page has no history and must not be shown an empty heading.

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

The theme loads each font role at its chosen weight plus a bold, and nothing else.
Where the file genuinely asks for a weight outside that — the home hero's badge is
set in Outfit Black — a section can load the one face it needs itself rather than
settling for a synthesised one or editing Horizon's font block:

```liquid
{%- assign accent_black = settings.type_accent_font | font_modify: 'weight', '900' -%}
{%- if accent_black -%}<style>{{ accent_black | font_face: font_display: 'swap' }}</style>{%- endif -%}
```

`font_modify` returns nothing when the family has no such weight, so the guard
leaves the browser to synthesise — which is what it would have done anyway. Keep
this rare: it is another font file on the page.

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

**An overlay needs its own fill, even when the file gives it none.** A component
drawn on Figma's white canvas can leave gaps between its parts and still look
right; the same markup floating over a page shows whatever it covers through them.
The variant panel was ported faithfully — transparent, with white rows 2px apart —
and on the product page those 2px let the next option's light blue trigger through
as a stripe across the list. Sampling the exported panel settled it: its interior
is white throughout, so the gaps are spacing, not a window.

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

**An inset shadow paints under the element's own children, so opaque children
that reach the edges erase the outline.** This has now bitten the kit twice — the
quantity stepper, whose buttons cover all four edges, and the variant panel, whose
rows start at its exact top and left. Both are fixed the same way: the outline
moves to an `::after` with `position: absolute; inset: 0`, which paints above the
children and, being inset, still costs the layout nothing.

The tell is a hairline that looks *half* there rather than absent. Measure it
rather than judging by eye — screenshot the component and the Figma export, and
compare the border pixel against the fill. The variant panel read 11 units off
white where the file reads 23; after the fix it reads 21 to 24 on all four sides.
A component with padding cannot have this fault, which is why `ui-filter-panel`
and `ui-sort-dropdown` were never affected.

`--ui-hairline-width` itself is fine and is left alone: `0.5px` is what the design
specifies, and on a 2× display it lands on exactly one device pixel. Probing five
ways of drawing the same line — inset shadow, border and outline, at 0.5px and
1px, on whole and fractional positions — the current inset shadow was the closest
match to the file. If one ever does need more presence, change the token under a
`resolution` media query rather than per component, so every outline moves
together.

**Most of the kit is not wired to data.** The product page is wired, and so is the
product row — see the note in `CLAUDE.md`. Filters and pagination are not.
