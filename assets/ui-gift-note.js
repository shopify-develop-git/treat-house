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

    // The message and the button both carry the state, so both are brought up to
    // it here rather than waiting for the next render. A cart with no message
    // offers to add one; a cart with one offers to change it.
    const message = panel.querySelector(MESSAGE);
    if (message) message.textContent = note;

    const toggle = panel.querySelector(TOGGLE);
    if (toggle) {
      toggle.textContent = note ? (panel.dataset.editLabel ?? '') : (panel.dataset.addLabel ?? '');
    }
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
