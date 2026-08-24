/**
 * Keeps `cart-drawer--empty` on the drawer's dialog in step with the cart.
 *
 * Liquid puts that class on at render time — `{% if cart.empty? %}` in
 * header-actions.liquid — and the whole of the kit's empty panel hangs off it:
 * the centred layout, the 40px heading, and hiding Horizon's "Have an account?"
 * line, which the design draws nothing of. Take the last item out and Horizon
 * re-renders the items inside the dialog but never touches the dialog itself, so
 * the class stays off and the panel falls back to Horizon's own arrangement.
 * That is the "legacy" empty cart: the right words in the wrong frame.
 *
 * The class follows the DOM rather than a cart event on purpose. Horizon empties
 * the drawer through more than one path — the remove button, a quantity taken to
 * zero, a cart page action mirrored back — and each announces itself differently,
 * while all of them end with the same markup swapped in. `cart-items__empty-button`
 * is the tell: cart-products.liquid renders it in its `cart.empty?` branch and
 * nowhere else.
 *
 * Only `childList` is observed. Watching attributes as well would see this
 * script's own class change and go round again.
 */
const DIALOG = '.cart-drawer__dialog';
const EMPTY_MARKER = '.cart-items__empty-button';
const EMPTY_CLASS = 'cart-drawer--empty';

const sync = (dialog) => {
  dialog.classList.toggle(EMPTY_CLASS, Boolean(dialog.querySelector(EMPTY_MARKER)));
};

const watch = (dialog) => {
  if (dialog.dataset.emptyWatch) return;
  dialog.dataset.emptyWatch = 'true';
  sync(dialog);
  new MutationObserver(() => sync(dialog)).observe(dialog, { childList: true, subtree: true });
};

const start = () => {
  for (const dialog of document.querySelectorAll(DIALOG)) watch(dialog);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

// The header is a section, and a section can be replaced whole — by the theme
// editor, or by the Section Rendering API. A replaced dialog is a new element
// with no observer on it, so the search runs again when the header reports back.
document.addEventListener('shopify:section:load', start);
