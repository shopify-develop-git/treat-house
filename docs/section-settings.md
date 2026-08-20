# Sections, blocks and the theme editor

How a section is put together for the merchant: what becomes a setting, what
becomes a block, what it is called and where it sits in the editor.

`docs/ui-kit.md` covers the components a section renders. This file covers the
shape of the section around them.

---

## 0. The rule everything else follows

**A section owns its media and its layout. Everything the merchant writes is a
block.**

Image, background, height, alignment, gap, padding: section settings. Headings,
copy, links, review lines, list entries: blocks.

This is how Horizon itself is built, and the payoff is that a page can be
rearranged in the theme editor without a deploy. The merchant reorders the
heading and the copy, drops the second button, adds a third avatar, and nothing
needs a developer.

- The region the merchant fills is `{% content_for 'blocks' %}`, one per section.
- A region that has to stay where it is — a review line pinned under the copy, a
  form bar on the bottom edge — is a **static block**:
  `{% content_for 'block', type: '_ui-review-line', id: 'review-line' %}`.
  Wrap it in an `{% if %}` on a section setting when it needs a switch.
- A static block can host its own blocks, so the parts of that region are blocks
  too.
- Something structural, without which the block is broken, stays a setting of the
  block. A button's label is the example: a button with no words is not a layout
  choice.
- Every block outputs `{{ block.shopify_attributes }}` on its root and carries
  `"tag": null` so it does not wrap itself in an element nobody asked for.
- The section's `presets` names its default blocks and their `block_order`, so
  adding the section gives the designed layout and not an empty frame.

### The smell that says you broke it

`avatar_1`, `avatar_2`, `avatar_3`, `avatar_4`, `avatar_5`.

A numbered run of settings is a list the merchant cannot lengthen, shorten or
reorder, and every entry costs a `case` in the Liquid. It is a block, always.

---

## 1. Naming

Our blocks live in `blocks/` and carry the `_ui-` prefix: `_ui-heading.liquid`,
`_ui-text.liquid`, `_ui-link.liquid`.

- The leading underscore is Horizon's mark for a **private** block — reachable
  only from a parent that names it in its `blocks` array, never from the block
  picker. Ours are private by default: a heading built for our sections has no
  business being dropped into Horizon's slideshow.
- `ui-` is already the prefix for everything of ours in `snippets/`, so it stays
  one prefix across the theme rather than two. `blocks/_heading.liquid` is
  Horizon's and is not to be edited.
- Section files keep plain names — `home-hero.liquid`, `our-story.liquid`. A
  section's file name is written into `templates/*.json`, so renaming one is a
  migration, not a tidy-up.
- The prefix never reaches the merchant. The name in the editor comes from the
  schema's `name`, so `_ui-heading.liquid` shows up as "Heading".

---

## 2. A heading is one `richtext` field

The merchant picks the level in the editor toolbar and breaks the line in the
same control, so the tag and the copy come from one field instead of two.

```json
{
  "type": "richtext",
  "id": "heading",
  "label": "t:settings.heading",
  "info": "Pick the heading level in the toolbar. Shift and Enter breaks the line. Italic marks the words drawn in purple.",
  "default": "<h2>Section heading</h2>"
}
```

Two alternatives were considered and are wrong here:

- `inline_richtext` is refused by Shopify with "Tag `<br>` is not permitted", and
  our headings break where a wrap would not. "Who doesn't love / a Krispie
  Treat?" is two lines because the file draws two lines; no `max-width` produces
  that break reliably.
- A `text` field plus a separate tag `select` works and costs the merchant a
  second control, with no bold, italic or link.

**The two-tone heading is `<em>`.** Treat House draws part of the headline in
purple. That is one field with the accent words italicised, and CSS turns the
italic into the colour:

```css
.ui-heading em {
  font-style: normal;
  color: var(--ui-heading-accent-color, var(--ui-color-primary));
}
```

Not two settings. Two settings force the break, forbid a third colour change and
put a comma in the wrong half the first time the copy is edited.

### Rendering one

The field carries its own tag, so print it into a plain wrapper and style what
comes out:

```liquid
{% if block.settings.heading != blank %}
  <div class="ui-heading" style="--ui-heading-size: {{ block.settings.heading_size }}px;">
    {{ block.settings.heading }}
  </div>
{% endif %}
```

```css
.ui-heading > :is(h1, h2, h3, h4, h5, h6, p) { margin: 0; }
```

- Do not `escape` it. Richtext returns markup on purpose and escaping prints the
  tags to the shopper.
- Do not drop the `!= blank` guard. An empty field renders nothing, not an empty
  box with the section's gap still around it.
- The `:is()` list covers `p` as well as `h1`–`h6`, or a merchant who picks
  "Paragraph" gets unstyled body text.

### Tag and size are independent

The tag carries no styling. Size, weight and case are the block's own settings,
so switching `h1` to `h2` for SEO does not change how the heading looks.

Default is `<h2>` — a section is almost never the page title. `<h1>` is the
exception, and a hero at the top of the home page is the exception that ships as
one. Product, collection and article templates already spend their `h1` on the
page title.

---

## 3. Labels are translation keys, when the key already exists

Every merchant-visible string is a `t:` key if Shopify already maintains one:
`t:settings.heading`, `t:settings.gap`, `t:content.padding`, `t:options.left`.
Look in `locales/en.default.schema.json` before writing a literal.

**Do not add keys to `locales/*.schema.json`.** The file's own header says it is
generated and may be overwritten by the admin language editor. A key we invent
disappears on the next regeneration and the merchant is shown the raw
`t:settings.badge_text` string. So: an existing key, or plain English.

Namespaces in use: `t:names`, `t:settings`, `t:options`, `t:content`,
`t:categories`, `t:info`, `t:text_defaults`, `t:html_defaults`.

---

## 4. Which setting type for which job

| Job | Type | Notes |
| --- | --- | --- |
| Heading | `richtext` | See §2. Never `inline_richtext`. |
| A paragraph or several | `richtext` | Blank line between paragraphs; the block spaces them. |
| One line that may carry a link or bold | `inline_richtext` | No `<br>`. |
| A plain label, a badge, a word | `text` | |
| A destination | `url` | |
| A number the merchant tunes | `range` | Always `min`, `max`, `step`, `unit`, `default`. |
| One of a few looks | `select` | Values are the CSS token, labels are `t:options.*`. |
| On or off | `checkbox` | |
| An image | `image_picker` | Desktop and mobile are two pickers, not one. |
| A colour off the palette | `color_scheme` | Prefer this to `color` for a whole section. |
| A colour override | `color` | With `"placeholder": "t:settings.default"` so blank means "leave it". |

A `range` is capped at 101 steps: `(max - min) / step` must be 100 or less, and
`default` has to land on the grid. Theme check passes an illegal one and the
storefront refuses to compile the section, so it surfaces only as an upload error
in `shopify theme dev`. Narrow the range rather than coarsening the step when the
drawn value has to stay reachable.

Use `visible_if` to hide a setting that does nothing in the current state:

```json
{ "visible_if": "{{ section.settings.height_mode == 'fixed' }}" }
```

---

## 5. Order and grouping in the editor

**The editor shows settings in file order.** Group them with `header` entries and
keep the run of groups short — three or four, not eight.

The order we use:

```
(ungrouped)   the one or two settings that decide what the section is
Media         images, video, their alt text and position
Layout        alignment, height, gaps, anything switchable
Colors        color_scheme and any override
Padding       padding-block-start, padding-block-end
```

Padding is last in every section, so a merchant learns where it is once.

**A setting is a decision, not a variable.** Not every number from Figma earns a
control. The drawn geometry — a 20px radius, a 0.5px hairline, the exact 618px
media column — stays in CSS. What becomes a setting is what a merchant on a
different page would plausibly want different: height, alignment, the gap between
copy and buttons, whether the badge shows.

Adding a range for a value nobody will move costs the merchant a scroll and costs
us a breakpoint that now has to respect an inline style.

---

## 6. Per-instance values reach CSS through custom properties

A section or block writes its settings as custom properties in an inline `style`
on its root, and the stylesheet reads them with a fallback:

```liquid
<div
  class="home-hero"
  style="
    {%- render 'spacing-style', settings: section.settings %}
    --home-hero-content-gap: {{ section.settings.content_gap }}px;
  "
  {{ section.shopify_attributes }}
>
```

```css
.home-hero__body { gap: var(--home-hero-content-gap, 32px); }
```

Padding goes through `snippets/spacing-style.liquid`, which emits
`--padding-block-start` and friends and scales anything over 20px by
`--spacing-scale`.

Two traps:

- **`--spacing-scale` is declared on `.spacing-style` in `base.css` and nowhere
  else.** A block dropped into a section that does not carry that class has no
  scale, the whole declaration is invalid at computed-value time, and the
  merchant's 32px silently becomes zero rather than something smaller. A block
  that reads those variables declares its own fallback:

  ```css
  .ui-link-row {
    padding-block: var(--padding-block-start, 0px) var(--padding-block-end, 0px);
    --spacing-scale: var(--spacing-scale-md);
  }
  @media screen and (min-width: 990px) {
    .ui-link-row { --spacing-scale: var(--spacing-scale-default); }
  }
  ```

- **An inline style outweighs any rule in a stylesheet.** A media query cannot
  override the property the inline `style` already set. It can only reach a
  second property that the first is measured against — a `--*-scale`, a cap, or a
  separate `--*-mobile`. Write the breakpoint against that, never against the
  value itself.

---

## 7. Presets

A section's preset ships the designed layout, not an empty frame:

```json
"presets": [
  {
    "name": "Home hero",
    "category": "t:categories.banners",
    "blocks": {
      "heading": { "type": "_ui-heading", "settings": { "heading": "<h1>Who doesn't love <em>a Krispie Treat?</em></h1>" } },
      "copy": { "type": "_ui-text" },
      "links": { "type": "_ui-link-row" }
    },
    "block_order": ["heading", "copy", "links"]
  }
]
```

Every block also carries its own one-line `presets` entry so it can be added from
the parent's picker.

---

## 8. Blocks render kit components, they do not restyle them

A block is a merchant-facing wrapper around something in `docs/ui-kit.md`.
`_ui-link` renders `ui-button` and passes a `variant`; it does not write its own
button CSS. A new look is a variant in the kit snippet, reached by every existing
call site — never a second block with two lines changed.

The same applies to forking: `_ui-heading-2.liquid` is the failure this rule
exists to prevent. A variant seen twice is a parameter.

---

## 9. A section is two elements

Content stops at the page width; background does not. So:

```liquid
<div class="our-story">           <!-- full width: background, top and bottom rule -->
  <div class="our-story__inner">  <!-- capped and centred: the content -->
```

The inner element carries `max-width: var(--page-width)`, `margin-inline: auto`
and `padding-inline: var(--ui-page-margin)`. Putting the cap on the section root
caps the background with it, which is the bug this rule exists to prevent. The
gutter ladder is in `CLAUDE.md`.

---

## What exists now

| Block | What the merchant sets | Used by |
| --- | --- | --- |
| `_ui-heading` | richtext heading, size, mobile size, max width, colour, accent colour | `home-hero`, `our-story`, `shop-by-occasion`, `partner-story`, `best-sellers` (static), `testimonials` (static) |
| `_ui-text` | richtext copy, size, mobile size, max width, colour | `home-hero`, `our-story`, `shop-by-occasion`, `partner-story`, `newsletter` |
| `_ui-link` | label, url, variant, full width, new tab | `home-hero`, `shop-by-occasion`, `partner-story`, `best-sellers` (static), `_ui-link-row` |
| `_ui-link-row` | gap; hosts link blocks | `home-hero` |
| `_ui-review-line` | stars, rating, review count, layout, text size, mobile text size, gap; the row as one picture, or avatar blocks | `home-hero`, `testimonials` (static) |
| `_ui-avatar` | image; sized by the row it stands in | `_ui-review-line` |
| `_ui-stat-row` | gap; hosts statistic blocks | `corporate-gifts`, static |
| `_ui-stat` | figure, label | `_ui-stat-row` |
| `_ui-testimonial` | richtext quote, star count, name, role, photo | `testimonials` |
| `_ui-feature-panel` | show the badge, the badge, the cut-out under the copy; hosts a heading and a text block | `why-choose-us`, static |
| `_ui-feature-card` | icon, title, richtext copy | `why-choose-us` |
| `_ui-faq-item` | question, richtext answer, open to begin with | `faq` |
| `_ui-rule` | colour, thickness, the space either side | `product-main` |
| `_ui-product-price` | show the was-price, size, mobile size | `product-main` |
| `_ui-product-chips` | per-product metafield, gap; hosts tag blocks | `product-main` |
| `_ui-product-chip` | label, icon | `_ui-product-chips` |
| `_ui-product-assurances` | per-product metafield, gap, narrowest item; hosts item blocks | `product-main` |
| `_ui-product-assurance` | label, icon | `_ui-product-assurances` |
| `_ui-product-variants` | the wording above the control | `product-main` |
| `_ui-product-prompt` | a line of copy and the link at the far end | `product-main` |
| `_ui-product-gift-message` | title, copy, button label, order line name, placeholder, limit | `product-main` |
| `_ui-product-buy` | button wording, price on the button, quantity, Buy now, wallet buttons | `product-main` |
| `_ui-product-panel` | title, icon, opens or not, padding, the two pieces of copy and their metafields; hosts detail lines | `product-main` |
| `_ui-product-detail-row` | label, value, per-product metafield | `_ui-product-panel` |

## Some things belong to the shop, not to a section

The phone number, the email address and the four social links live in **Theme
settings → Contact and social**, as `contact_phone`, `contact_email` and
`social_<network>_url`. The top bar and the footer both print them.

Give a block its own field for these only when a place genuinely needs a different
value, and have it fall back to the theme setting when the field is empty — the
block stays in charge, the theme is the floor. A shop with two sources for one
phone number eventually shows two different phone numbers.
| `_ui-newsletter-form` | placeholder, button label, accessible label | `newsletter`, static |
| `_ui-footer-brand` | logo, tagline, four social urls | `site-footer`, static |
| `_ui-footer-column` | title, menu | `site-footer` |
| `_ui-footer-contact` | title, place, phone, email | `site-footer` |
| `_ui-footer-legal` | copyright, policy menu | `site-footer`, static |

### The same block, reading the product

`_ui-heading`, `_ui-text` and `_ui-review-line` each grew a `source` setting rather
than a product-page twin. Left on its default each one is what it always was; set to
the product, the heading takes `product.title`, the copy takes the description, and
the review line takes `metafields.reviews.rating` and `rating_count`. A fourth,
fifth and sixth block would have been the same type, the same controls and the same
CSS with one line reading somewhere else — which is §8's rule, applied to where the
words come from rather than to how they look.

The two-tone heading needs somewhere per-product to live, so on that path the accent
comes from `custom.title_accent` — the words to draw in purple, spelled as they
appear in the title — instead of from `<em>` in a field the merchant is no longer
typing into.

### A section can read somewhere else too

`best-sellers` grew the same kind of setting. `source` is `chosen` — the products
the merchant picks — or `related`, Shopify's recommendations for the product being
looked at, or `recently_viewed`, this visitor's own history. The file draws four
rows and all four are this one section with the settings moved, so a change to the
card reaches every row rather than three of four.

Neither of the two answers exists at render time: recommendations and a search both
need a request carrying the question. So the row renders empty and a custom element
around the whole band asks for the section a second time with the question attached
and swaps in what comes back — `<product-recommendations>` is Horizon's own, script
included, and `<ui-recently-viewed>` is the same shape over the Search API. Two
things that fall out of that and are easy to get wrong:

- **An empty row is not filled with the onboarding cards** unless `request.design_mode`
  says a merchant is looking at it. A shopper waiting on their own products would
  otherwise be shown five invented ones.
- **`data-has-recommendations` is not written until the answer is in.** Horizon hides
  a `product-recommendations` whose descendant says `false`, and its script waits on
  an `IntersectionObserver` — an element hidden before it asks never intersects, so
  it never asks.

### Per-product overrides are metafields, and the block holds the default

The product page's editorial copy is set once in the theme editor and overridden per
product, so a shop's hundredth product is not a hundred settings. Every block that
takes an override names the field it reads, and a blank metafield leaves the block's
own wording standing:

| Metafield (`custom.*`) | Type | What reads it |
| --- | --- | --- |
| `title_accent` | text | `_ui-heading`, on `source: product_title` |
| `badge`, `badge_tone` | text | `product-main`'s gallery, and `best-sellers` before it |
| `product_chips` | list of text, each `icon:Label` | `_ui-product-chips` |
| `product_assurances` | list of text, each `icon:Label` | `_ui-product-assurances` |
| `gift_message_note` | text | `_ui-product-gift-message` |
| `ships_from`, `estimated_delivery`, `shipping_method` | text | `_ui-product-detail-row` |
| `ingredients_summary`, `ingredients_full` | text / richtext | `_ui-product-panel` |
| `storage_summary`, `storage_full` | text / richtext | `_ui-product-panel` |

The two lists are lists for the reason §0 gives: a shop that wants a fourth claim on
one product adds a line, rather than waiting for a fourth setting. The metafield key
is itself a setting on the row, so the name is the merchant's to choose and this file
is not the only place it is written down.

`_ui-heading` and `_ui-text` carry the section's decisions as inherited custom
properties rather than settings: `--ui-heading-color`, `--ui-text-color`,
`--ui-text-weight` and the two max widths. A block writes its own only when the
merchant moves the matching control, so a section can hand it the drawn figure
and still be overruled by hand.

`_ui-heading` replaced `snippets/ui-section-heading.liquid`, which held the same
type at the same steps but took the accent as a second string. One richtext field
carries both the accent and where it falls, so `heading_accent_position` went with
it. The snippet has no callers left.

Keep this table current. A block missing from it is a block that gets written a
second time.
