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
 * Measured once the fonts have settled — before that the widths are the
 * fallback face's and the answer would be wrong — then again on pointerenter,
 * which is the moment a panel is about to open and the answer is certainly
 * current, and on resize. The first pass is what stops the first panel opening
 * at one offset and correcting itself to another.
 */
class MegaMenuAlign extends HTMLElement {
  #items = [];

  connectedCallback() {
    this.#items = [...this.querySelectorAll('.menu-list__list-item')].filter((item) =>
      item.querySelector('.mega-menu')
    );

    for (const item of this.#items) {
      item.addEventListener('pointerenter', () => this.#align(item));
      item.addEventListener('focusin', () => this.#align(item));
    }

    const settle = document.fonts?.ready ?? Promise.resolve();
    settle.then(() => {
      for (const item of this.#items) this.#align(item);
    });

    this.#resize = new ResizeObserver(() => {
      for (const item of this.#items) this.#align(item);
    });
    this.#resize.observe(this);
  }

  disconnectedCallback() {
    this.#resize?.disconnect();
  }

  #resize = null;

  #align(item) {
    const panel = item.querySelector('.mega-menu');
    const label = item.querySelector('.menu-list__link-title');
    if (!panel || !label) return;

    // The panel runs the full width of the window, so its content box — not its
    // border box — is what the columns are laid out from.
    const padding = parseFloat(getComputedStyle(panel).paddingInlineStart) || 0;
    const start = label.getBoundingClientRect().left - (panel.getBoundingClientRect().left + padding);

    panel.style.setProperty('--th-mega-start', `${Math.round(start)}px`);
  }
}

if (!customElements.get('ui-mega-menu-align')) {
  customElements.define('ui-mega-menu-align', MegaMenuAlign);
}
