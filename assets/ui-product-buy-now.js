/**
 * "Buy now" for the UI kit's buy row.
 *
 * The file draws a plain secondary button beside Add to cart, which is not what
 * Shopify's accelerated checkout renders — that one brings its own wallet buttons
 * and its own styling. So this is the honest reading of the button's own words: it
 * adds the current selection to the cart and then goes to checkout.
 *
 * It does that by clicking the Add to cart button rather than posting itself, so
 * quantity, line item properties and the variant all come from the one form the
 * theme already validates, and a variant that cannot be bought stops this button
 * for the same reason it stops the other one.
 *
 * `cart:update` is what Horizon's product form fires once the add has landed, and
 * `cart:error` is what it fires when it has not. Both are listened for once and
 * then dropped: without the error case a failed add would leave the page waiting
 * on a redirect that never comes, with the button stuck.
 */
const CART_UPDATE = 'cart:update';
const CART_ERROR = 'cart:error';

class UiBuyNow extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    this.#disarm();
  }

  #onClick = (event) => {
    const trigger = event.target.closest('button');
    if (!trigger || !this.contains(trigger) || trigger.disabled) return;

    const form = this.closest('product-form-component');
    const addToCart = form?.querySelector('[ref="addToCartButton"]');
    if (!addToCart || addToCart.disabled) return;

    this.#arm(form);
    trigger.setAttribute('aria-busy', 'true');
    addToCart.click();
  };

  #arm(form) {
    this.#disarm();
    this.form = form;
    form.addEventListener(CART_UPDATE, this.#onAdded);
    form.addEventListener(CART_ERROR, this.#onFailed);
  }

  #disarm() {
    this.form?.removeEventListener(CART_UPDATE, this.#onAdded);
    this.form?.removeEventListener(CART_ERROR, this.#onFailed);
    this.form = undefined;
  }

  #onAdded = () => {
    this.#disarm();
    window.location.assign(this.dataset.checkoutUrl || '/checkout');
  };

  #onFailed = () => {
    this.#disarm();
    // The form prints the reason itself; all this has to undo is its own button.
    this.querySelector('button')?.removeAttribute('aria-busy');
  };
}

if (!customElements.get('ui-buy-now')) {
  customElements.define('ui-buy-now', UiBuyNow);
}
