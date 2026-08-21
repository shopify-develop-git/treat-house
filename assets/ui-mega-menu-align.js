/**
 * Starts a mega menu panel's link columns under the item that opened them.
 *
 * The file draws every panel with its first column beneath the text of its own
 * navigation item — Shop Treats' columns under "Shop Treats", Corporate
 * Gifting's under "Corporate Gifting" — while the panel's title stays out at the
 * page margin. Measured across the three panels it draws, the two agree within
 * 1.5px, which is a rule rather than a coincidence.
 *
 * It cannot be written in Liquid or in CSS. The menu is centred, so an item's
 * position is the sum of the widths of everything before it, and those widths
 * are the rendered text — known only once the fonts are in. So it is measured,
 * and written back as a custom property the stylesheet consumes.
 *
 * Three things about how it is wired, each of which was a way the columns moved
 * on their own:
 *
 * It is a module in the document, not a script beside the menu. Horizon
 * re-renders the header through the Section Rendering API, and a `<script>`
 * arriving that way is inserted as markup and never runs.
 *
 * It is not a custom element. An element that re-render brings in is not always
 * upgraded, so its `connectedCallback` never fires and it measures nothing.
 * Listeners on the document have no lifecycle to lose.
 *
 * And the property is put back synchronously when the header is re-rendered.
 * That re-render replaces the markup and takes the inline property with it,
 * dropping the columns to the stylesheet's fallback; restoring it a frame later
 * is a frame of the panel in the wrong place, which is the jump this used to
 * make on a reload or a page change. The observer writes the remembered value
 * straight back, before anything is painted, and only measures again when
 * something has actually moved.
 */
const ITEM = '#header-component .menu-list__list-item';

let measured = new WeakMap();

function apply(item, remeasure) {
  const panel = item.querySelector('.mega-menu');
  const label = item.querySelector('.menu-list__link-title');
  if (!panel || !label) return;

  let value = measured.get(item);

  if (remeasure || value == null) {
    // The panel runs the full width of the window, so its content box — not its
    // border box — is what the columns are laid out from.
    const padding = parseFloat(getComputedStyle(panel).paddingInlineStart) || 0;
    const start = label.getBoundingClientRect().left - (panel.getBoundingClientRect().left + padding);
    value = `${Math.round(start)}px`;
    measured.set(item, value);
  }

  if (panel.style.getPropertyValue('--th-mega-start') !== value) {
    panel.style.setProperty('--th-mega-start', value);
  }
}

function restore() {
  for (const item of document.querySelectorAll(ITEM)) apply(item, false);
}

function remeasure() {
  measured = new WeakMap();
  for (const item of document.querySelectorAll(ITEM)) apply(item, true);
}

// `pointerover` and `focusin` bubble where `pointerenter` and `focus` do not,
// which is what lets one listener serve rows that arrive later.
const onPoint = (event) => {
  const item = event.target?.closest?.(ITEM);
  if (item) apply(item, false);
};

document.addEventListener('pointerover', onPoint, { passive: true });
document.addEventListener('focusin', onPoint);
window.addEventListener('resize', remeasure, { passive: true });

const start = () => {
  // A MutationObserver's callback is delivered before the next paint, so putting
  // the value back here means there is no frame in which the panel is drawn
  // without it. Watching the group rather than the body keeps this to the one
  // subtree that can move the menu.
  const group = document.getElementById('header-group');
  if (group) {
    new MutationObserver(restore).observe(group, {
      childList: true,
      subtree: true,
      // The property does not leave with a replaced node. Horizon morphs the
      // header in place, and morphing an element whose new markup carries no
      // `style` removes the attribute — so what has to be watched is the
      // attribute, not the children. Putting it back writes `style` again,
      // which calls this a second time; that pass finds the value already
      // there, writes nothing, and it stops.
      attributes: true,
      attributeFilter: ['style'],
    });
  }
  remeasure();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

// Before the fonts land the widths belong to the fallback face — a few pixels
// out on each item — so the measurement is taken again once the real one is in.
document.fonts?.ready.then(remeasure);
