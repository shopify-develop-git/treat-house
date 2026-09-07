/**
 * A box built in the customizer leaves the cart as one thing.
 *
 * The builder adds several lines — one per flavour, one for the packaging — and
 * marks each of them with the same `_box` property (see ui-customize-box.js).
 * Nothing else joins them: to Shopify they are ordinary, unrelated lines, and to
 * the cart they were ordinary too. A shopper could set a flavour to fifteen
 * inside a box that holds twelve, or delete the flavours and be left holding an
 * empty box. The quantity half is answered in Liquid, which draws a number where
 * the stepper would be. This is the other half.
 *
 * The remove button on a box line carries `data-cart-box-remove`. A click on one
 * clears every line wearing that mark, in a single `/cart/update.js` — quantities
 * keyed by line key, which is what that endpoint takes and what lets a set go in
 * one request rather than in a race of several.
 *
 * Three things about how this is wired:
 *
 * It listens on the document rather than binding buttons. The cart drawer is
 * re-rendered by the Section Rendering API on every change, so anything bound to
 * a button is bound to a button that is about to be replaced.
 *
 * It runs in the capture phase and stops the event there. Horizon's own
 * `on:click="/onLineItemRemove/…"` is still on the button and would remove the
 * one line the shopper clicked; letting it run as well would fire two cart writes
 * for one click. Leaving it in the markup is deliberate all the same — with the
 * script absent the button still removes something, which is better than a button
 * that does nothing.
 *
 * And the line keys are read from the DOM, not from a cart fetch. Every row
 * already prints `data-key`, so the set is known without asking the server what
 * it just told us.
 */

const REMOVE = '[data-cart-box-remove]';
const ROW = '[data-cart-box-row]';

/*
 * Liquid asks [quantity-selector] for a locked stepper and gets one, and then
 * `component-cart-quantity-selector.js` hydrates and hands the buttons back:
 * each selector works out for itself which of its buttons to disable from its
 * own value, and knows nothing about `can_update_quantity`. Measured — a plus
 * clicked on a locked line took a flavour from 12 to 13.
 *
 * So the lock is put back after every render, and a click is refused in the
 * capture phase whatever the button's state says. The attribute is what a
 * pointer and a screen reader read; the intercept is what actually holds.
 */
function lock(root = document) {
  for (const row of root.querySelectorAll?.(ROW) ?? []) {
    for (const control of row.querySelectorAll('input, button')) {
      if (control.closest(REMOVE)) continue;
      control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
    }
  }
}

/*
 * A timer, not `requestAnimationFrame`. A frame is only ever offered to a tab
 * that is being drawn, so in a background tab — a cart left open behind another
 * one — the relock simply never ran and the buttons stayed live. A timeout is
 * throttled there rather than suspended, which is the difference that matters.
 */
const relock = () => setTimeout(lock, 0);

lock();
document.addEventListener('DOMContentLoaded', relock);
document.addEventListener('cart:update', relock);
new MutationObserver(relock).observe(document.documentElement, { childList: true, subtree: true });

/** Every line key in the cart belonging to one box. */
function keysForBox(root, boxId) {
  const buttons = root.querySelectorAll(`[data-cart-box-remove="${CSS.escape(boxId)}"]`);
  const keys = [];

  for (const button of buttons) {
    const key = button.closest('[data-key]')?.dataset.key;
    if (key && !keys.includes(key)) keys.push(key);
  }

  return keys;
}

async function removeBox(keys) {
  const updates = {};
  for (const key of keys) updates[key] = 0;

  const response = await fetch('/cart/update.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ updates }),
  });

  if (!response.ok) return;

  // The same event Horizon raises after its own cart writes, so the drawer, the
  // count and the summary refresh the way they do everywhere else rather than
  // this needing to know how any of them are built.
  document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: { source: 'cart-box-lines' } }));
}

document.addEventListener(
  'click',
  (event) => {
    // A stepper button inside a box row never gets to run, disabled or not.
    const inRow = event.target?.closest?.(ROW);
    if (inRow && !event.target.closest(REMOVE)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const button = event.target?.closest?.(REMOVE);
    if (!button) return;

    const boxId = button.dataset.cartBoxRemove;
    const keys = keysForBox(button.getRootNode?.() ?? document, boxId);

    // One line and no siblings is not a box worth intercepting — let Horizon
    // handle it, so a half-removed box still behaves like an ordinary cart.
    if (keys.length < 2) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    removeBox(keys);
  },
  true
);
