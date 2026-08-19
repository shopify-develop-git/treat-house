/**
 * Types a value into a date mask and leaves the untyped remainder on screen.
 *
 * The kit does not clear the placeholder on first keystroke: `MM/DD/YYYY` shrinks
 * from the left as digits land, so the part still to come stays legible in grey.
 * A native placeholder cannot do that — it is all or nothing — so the remainder is
 * drawn by a ghost element sitting under the field, with a transparent run of text
 * standing in for what has already been typed to keep the two in step.
 *
 * Separators come for free: finish a group and the mask's own `/` is appended, so
 * only digits ever need typing.
 *
 * Dependency-free for the same reason as ui-character-count — the kit snippets
 * should load on their own.
 *
 * <ui-date-mask data-mask="MM/DD/YYYY">
 *   <input type="text" placeholder="MM/DD/YYYY">
 *   <span data-mask-ghost></span>
 * </ui-date-mask>
 */
class UIDateMask extends HTMLElement {
  #input = null;
  #ghost = null;
  #mask = 'MM/DD/YYYY';

  connectedCallback() {
    this.#input = this.querySelector('input');
    this.#ghost = this.querySelector('[data-mask-ghost]');
    if (!this.#input || !this.#ghost) return;

    this.#mask = this.dataset.mask || this.#mask;
    this.#input.addEventListener('input', this.#onInput);
    this.#render();
  }

  disconnectedCallback() {
    this.#input?.removeEventListener('input', this.#onInput);
  }

  #onInput = () => {
    const formatted = this.#format(this.#input.value);
    if (formatted !== this.#input.value) this.#input.value = formatted;
    this.#render();
  };

  /** Keeps the digits, drops everything else, and lays them back into the mask. */
  #format(raw) {
    const slots = this.#mask.replace(/[^A-Za-z]/g, '').length;
    const digits = raw.replace(/\D/g, '').slice(0, slots);
    let out = '';
    let used = 0;

    for (const char of this.#mask) {
      if (/[A-Za-z]/.test(char)) {
        if (used >= digits.length) break;
        out += digits[used++];
      } else {
        if (used === 0) break;
        out += char;
        if (used >= digits.length) break;
      }
    }
    return out;
  }

  #render() {
    const typed = this.#input.value;
    const spacer = document.createElement('span');
    spacer.textContent = typed;

    const remainder = document.createElement('span');
    remainder.className = 'ui-input__mask-remainder';
    remainder.textContent = this.#mask.slice(typed.length);

    this.#ghost.replaceChildren(spacer, remainder);
  }
}

if (!customElements.get('ui-date-mask')) {
  customElements.define('ui-date-mask', UIDateMask);
}
