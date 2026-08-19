/**
 * Minimal stepping for the UI kit quantity control.
 *
 * Deliberately not the theme's quantity-selector-component: that one talks to the
 * cart and the product form, and this is a presentational kit component that has
 * not been wired to either. All this does is move the input's value within its
 * own min/max and fire the events a form would expect, so whatever adopts it can
 * listen without this file having to know about it.
 */
class UiQuantityStepper extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('[data-ui-quantity-input]');
    if (!this.input) return;

    this.addEventListener('click', this.#onClick);
    this.input.addEventListener('input', this.#syncDisabled);
    this.#syncDisabled();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
  }

  #onClick = (event) => {
    const button = event.target.closest('[data-ui-quantity-step]');
    if (!button || !this.contains(button)) return;

    const step = Number(button.dataset.uiQuantityStep);
    const next = this.#clamp(this.#value + step);
    if (next === this.#value) return;

    this.input.value = String(next);
    this.#syncDisabled();
    // `input` then `change`: the pair a typed edit would produce.
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  #syncDisabled = () => {
    for (const button of this.querySelectorAll('[data-ui-quantity-step]')) {
      const step = Number(button.dataset.uiQuantityStep);
      button.disabled = this.#clamp(this.#value + step) === this.#value;
    }
  };

  get #value() {
    return Number(this.input.value) || 0;
  }

  #clamp(value) {
    const min = this.input.min === '' ? -Infinity : Number(this.input.min);
    const max = this.input.max === '' ? Infinity : Number(this.input.max);
    return Math.min(Math.max(value, min), max);
  }
}

if (!customElements.get('ui-quantity-stepper')) {
  customElements.define('ui-quantity-stepper', UiQuantityStepper);
}
