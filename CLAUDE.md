# Treat House

Shopify **Horizon** theme. The storefront's visual language is a UI kit ported
from Figma and living in `snippets/ui-*.liquid`.

## Build UI from the kit, not from scratch

**Before writing any markup or CSS for a control, check `docs/ui-kit.md` for a
component that already covers it.** There are 22, and between them they cover
buttons, form fields, filters, sorting, pagination, cards, variant pickers and
the quantity stepper.

In order of preference:

1. **Render the kit component.** `{% render 'ui-button', variant: 'primary', label: 'Shop treats' %}`
2. **Extend it through its parameters.** Every component takes `class` and most
   take `attributes`, so a one-off tweak rarely needs a new component.
3. **Only then write something new** — and build it from the kit's tokens, in a
   `snippets/ui-*.liquid` file with a `{% doc %}` block, so the next person finds
   it the same way.

Two things to avoid:

- **Do not use Horizon's own equivalents** (`.button`, `.button-secondary`,
  `snippets/checkbox.liquid`, `snippets/quantity-selector.liquid`) in new work.
  They are untouched and still drive existing theme features, but they are not
  the design. Mixing the two is how a page ends up half-branded.
- **Do not hardcode colours, fonts or radii.** Use the tokens in
  `snippets/ui-kit-tokens.liquid`. A raw `#6c276a` is a bug waiting for the next
  palette change.

## The merchant sees the schema — build it, don't dump it

**A section owns its media and its layout. Everything the merchant writes is a
block.** Headings, copy and links are `blocks/_ui-*.liquid` rendered through
`{% content_for 'blocks' %}`, not a flat list of `text` settings on the section.

The tell that this went wrong is a numbered run of settings — `avatar_1` through
`avatar_5` — which is a list the merchant cannot lengthen, shorten or reorder.

**Before adding a setting to a section, read `docs/section-settings.md`.** It has
the setting type for each job, the group order the editor shows, the `t:` label
rule, and the two ways an inline style quietly beats a media query.

## Page geometry — read before laying out a section

Most sections sit in the `.section` grid, which puts the content in a central
column between two gutters. Those use `section--page-width` and **add no horizontal
padding of their own** — the grid places them, and a second padding double-pads at
some width and lines up with nothing else on the page.

A full-bleed section that needs its background to reach the window edge stands
outside that grid and pads itself. That is fine, but **take the value from
`--page-margin` rather than retyping the numbers** — otherwise the page has two
sources for one measurement and they drift the first time either moves.

The gutter steps three times, in `assets/base.css`:

| viewport | gutter | content at that width |
| --- | --- | --- |
| under 750px | 16px | viewport − 32 |
| 750–1199px | 40px | viewport − 80 |
| 1200px and up | 80px | viewport − 160, capped at 1280 |

The 80px gutter is what the Figma file draws, but it is drawn at 1440px and only
earns its width there. Held all the way down it takes 160px out of a 1000px
viewport and every section on the page pays for it, which is why it starts at
1200px and not before. **Do not widen it below 1200px, and do not fight it with a
negative margin.**

Content stops at 1280px, so above 1440px the page centres instead of growing and a
card keeps the width it was drawn at.

### Two breakpoints is not enough for a grid

The file draws the ends — a phone and a 1440px desktop — and nothing between. A
grid built from those two alone runs its desktop column count from 750px up, where
there is barely half the width for it. Give a multi-column grid **three** counts,
not two, and check the middle:

```
under 750px    the mobile count the file draws
750–1199px     one fewer column than desktop
1200px and up  the count the file draws
```

`sections/shop-by-occasion.liquid` is the worked example: 2 / 3 / 4, which holds
its card between 210px and 360px across the range against the 305px drawn. Built
with two tiers instead it collapsed to 128px at 750px.

**Measure before claiming a range works.** The window cannot be resized from the
extension and DevTools emulation is often occupied, but an iframe gets its own
viewport for media queries, so the section can be rendered into one at any width
and measured for real. Arithmetic misses things a render does not: the card above
looked fine on paper at 750px and was in fact 44px taller than everywhere else,
because its title had started wrapping.

## What the kit does not do yet

The components are presentational. Filters do not filter, the variant picker does
not change the variant, the stepper does not touch the cart. Wiring them to
Shopify's facets, product forms and cart is open work — if you need working
behaviour, that is a task to do deliberately, not something to assume.

## Before you claim a component looks right

`shopify theme dev` uploads assets on change but **misses files created while it
runs**. A new SVG then renders as `<!-- inline_asset_content: Asset not found. -->`
and the icon is silently absent. If an icon is missing, `touch assets/*.svg`
before debugging the CSS.

### The header is two headers, and an iframe only ever shows you one

`theme.liquid` picks `data-menu-style` at load: `drawer` on a touch device,
`menu` otherwise. The two are not a detail — Horizon keeps a whole separate phone
arrangement behind `[data-menu-style='drawer']` which spans the row across the
page grid and pads it to nothing, at a weight of (1,2,0).

An iframe is not a touch device, so it always reports `menu`. A narrow iframe
therefore renders a header **no phone will ever see**, and a rule that loses to
that drawer block looks perfectly correct while being wrong on every real
handset. That is how the header shipped once with no side margin at all.

So when measuring anything in the header, set `data-menu-style` by hand and read
both:

```js
for (const mode of ['menu', 'drawer']) { header.dataset.menuStyle = mode; /* measure */ }
```

And reach past that block deliberately: `#header-component.header …` is (1,3,0)
and clears it. An id plus one class does not.

Full reference, tokens and conventions: **`docs/ui-kit.md`**

Schema, blocks and what the merchant sees: **`docs/section-settings.md`**
