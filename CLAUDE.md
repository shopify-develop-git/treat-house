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

Full reference, tokens and conventions: **`docs/ui-kit.md`**
