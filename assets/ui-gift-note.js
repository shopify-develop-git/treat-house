/**
 * The gift note's Save button.
 *
 * Horizon's `cart-note` already posts the note as the shopper types, debounced
 * by 200ms. That is the right safety net and it stays: someone who wanders off
 * mid-sentence keeps their words. What it does not do is say so, and a box that
 * saves in silence reads as a box that did not save — which is what was reported
 * from review.
 *
 * So the button is not what makes the note persist. It is what tells the shopper
 * it has. It posts at once rather than waiting the debounce out, closes the
 * disclosure, and leaves a line they can read. The two saves can overlap on the
 * same value, which costs a request and changes nothing.
 *
 * Delegated from the document rather than bound per panel. The cart drawer and
 * the cart page both render this markup, and both are replaced whole by the
 * Section Rendering API on every cart change — a listener on the panel would be
 * thrown away with it, and re-binding means watching for the swap. The click has
 * to reach the document either way.
 */
const PANEL = '.ui-gift-note';
const SAVE = '[data-gift-note-save]';
const STATUS = '[data-gift-note-status]';
const MESSAGE = '[data-gift-note-message]';
const TOGGLE = '[data-gift-note-toggle]';

/**
 * Brings a panel's two pieces of state — the message and the button's label — in
 * line with a note. Everything except the textarea, which belongs to whoever is
 * typing in it: a shopper mid-sentence when someone else's request lands should
 * not have their words replaced by the server's copy.
 */
const render = (panel, note) => {
  const message = panel.querySelector(MESSAGE);
  if (message) message.textContent = note;

  const toggle = panel.querySelector(TOGGLE);
  if (toggle) {
    toggle.textContent = note ? (panel.dataset.editLabel ?? '') : (panel.dataset.addLabel ?? '');
  }
};

const save = async (panel, button) => {
  const field = panel.querySelector('textarea');
  const status = panel.querySelector(STATUS);
  const details = panel.querySelector('details');
  if (!field) return;

  button.disabled = true;

  try {
    await fetch(window.Theme?.routes?.cart_update_url ?? '/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ note: field.value }),
    });

    const note = field.value.trim();

    if (details) details.open = false;
    if (status) status.textContent = '';

    // Brought up to date here rather than waiting for the next render. A cart
    // with no message offers to add one; a cart with one offers to change it.
    render(panel, note);
  } catch (error) {
    // The note is not lost — the autosave above has it, or will on the next
    // keystroke — so the line says to try again rather than reporting a loss.
    if (status) status.textContent = panel.dataset.errorLabel ?? '';
  } finally {
    button.disabled = false;
  }
};

document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest(SAVE) : null;
  if (!button) return;

  const panel = button.closest(PANEL);
  if (panel) save(panel, button);
});

/**
 * The panel is drawn by Liquid, and every cart change hands it back re-rendered
 * from the server. That is normally right and normally in time. It is not
 * something this file controls, though: the add comes from a product card, a
 * quick-add or another section entirely, each asking for the cart's sections on
 * its own schedule, and a panel that comes back rendered a moment before the
 * note landed shows a cart that has a message as one that does not — which is
 * the "I have to reload the page" report.
 *
 * So the panel does not trust what it is handed. On every cart change it asks
 * the cart what the note actually is and says that. One small request against a
 * class of staleness that is otherwise invisible until a shopper reloads.
 */
document.addEventListener('cart:update', async () => {
  const panels = document.querySelectorAll(PANEL);
  if (!panels.length) return;

  try {
    const cart = await fetch(window.Theme?.routes?.cart_url ? `${window.Theme.routes.cart_url}.js` : '/cart.js', {
      headers: { Accept: 'application/json' },
    }).then((response) => response.json());

    for (const panel of panels) render(panel, (cart.note ?? '').trim());
  } catch (error) {
    // Leave what the server drew. It is right far more often than not.
  }
});
