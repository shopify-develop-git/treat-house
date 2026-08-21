/**
 * The box builder's state: which pack, which treats and how many of each, which
 * packaging, and the note that goes in the box.
 *
 * It works out no prices. Every combination of pack and packaging is a variant
 * Shopify has already priced, and each packaging row carries those figures for
 * every pack in `data-packaging-map`; choosing is a lookup, and the total shown
 * is the one the cart will charge. A builder that multiplied a unit price by a
 * count would be right until the first sale, a tax rule or a discount, and then
 * quietly wrong.
 *
 * What it posts is read back out of the DOM rather than kept in a second copy
 * here: the flavours from the cards' own number inputs, the note from its
 * textarea. There is one description of the box on the page, not two that can
 * drift.
 */
const STORAGE_PREFIX = 'treat-house:customize-box:';

class CustomizeBox extends HTMLElement {
  #screen = 1;
  #screens = [];
  #saveKey = '';

  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = 'true';

    this.#screens = [...this.querySelectorAll('[data-screen]')];
    this.#saveKey = STORAGE_PREFIX + (this.closest('.shopify-section')?.id ?? 'default');

    this.addEventListener('change', this.#onChange);
    this.addEventListener('input', this.#onChange);
    this.addEventListener('click', this.#onClick);

    const form = this.querySelector('form');
    form?.addEventListener('submit', () => this.#writeProperties());

    this.#restore();
    this.#selectFirstIfNoneChosen();
    this.#render();
  }

  /* ---------------------------------------------------------------- reading */

  get #packInput() {
    return this.querySelector('input[name="customize-pack"]:checked');
  }

  get #packagingInput() {
    return this.querySelector('input[name="customize-packaging"]:checked');
  }

  get #packHandle() {
    return this.#packInput?.value ?? '';
  }

  get #packSize() {
    return Number(this.#packInput?.dataset.packSize ?? 0);
  }

  get #chosenFlavours() {
    return [...this.querySelectorAll('[data-flavour]')]
      .map((card) => ({
        card,
        handle: card.dataset.flavour,
        title: card.dataset.flavourTitle,
        count: Number(card.querySelector('input[type="number"]')?.value ?? 0),
        image: card.querySelector('img')?.getAttribute('src') ?? '',
      }))
      .filter((flavour) => flavour.count > 0);
  }

  get #flavourTotal() {
    return this.#chosenFlavours.reduce((sum, flavour) => sum + flavour.count, 0);
  }

  /** The variant the current pack and packaging resolve to, with its price. */
  get #entry() {
    const row = this.#packagingInput?.closest('[data-packaging-map]');
    const handle = this.#packHandle;
    if (!row || !handle) return null;
    try {
      return JSON.parse(row.dataset.packagingMap)[handle] ?? null;
    } catch {
      return null;
    }
  }

  /* ---------------------------------------------------------------- events */

  #onChange = (event) => {
    const card = event.target.closest?.('[data-flavour]');
    if (card) card.toggleAttribute('data-chosen', Number(event.target.value) > 0);
    this.#render();
    this.#save();
  };

  #onClick = (event) => {
    const add = event.target.closest?.('[data-flavour-add]');
    if (add) {
      const card = add.closest('[data-flavour]');
      const input = card.querySelector('input[type="number"]');
      input.value = '1';
      card.setAttribute('data-chosen', '');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (event.target.closest?.('[data-step-next]')) this.#go(this.#screen + 1);
    if (event.target.closest?.('[data-step-back]')) this.#go(this.#screen - 1);

    const jump = event.target.closest?.('[data-step-link]');
    if (jump) this.#go(Number(jump.dataset.stepLink));
  };

  #go(next) {
    const target = Math.min(Math.max(next, 1), this.#screens.length);
    if (target === this.#screen) return;
    this.#screen = target;
    this.#render();
    this.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* --------------------------------------------------------------- writing */

  #render() {
    for (const screen of this.#screens) {
      screen.hidden = Number(screen.dataset.screen) !== this.#screen;
    }

    const size = this.#packSize;
    const total = this.#flavourTotal;
    const entry = this.#entry;

    // A stepper can never take the box past the pack it is going into.
    for (const card of this.querySelectorAll('[data-flavour]')) {
      const input = card.querySelector('input[type="number"]');
      if (!input) continue;
      const own = Number(input.value) || 0;
      input.max = String(size ? Math.max(own, size - (total - own)) : 36);
    }

    this.#renderTally(size, total);
    this.#renderPackagingNotes();
    this.#renderSummary(entry, size, total);
    this.#renderReview(entry);
    this.#renderGates(size, total, entry);
  }

  #renderTally(size, total) {
    const tally = this.querySelector('[data-tally]');
    if (!tally) return;
    if (!size) {
      tally.textContent = '';
      return;
    }
    tally.textContent = `${total} of ${size} chosen`;
    tally.toggleAttribute('data-complete', total === size);
  }

  /** What each packaging adds depends on the pack, so the notes follow it. */
  #renderPackagingNotes() {
    const handle = this.#packHandle;
    // The map rides on the input, because that is where the row component puts
    // extra attributes; the note to update is in the label around it.
    for (const row of this.querySelectorAll('[data-packaging-map]')) {
      const note = row.closest('.ui-option-row')?.querySelector('.ui-option-row__price');
      if (!note) continue;
      let map = {};
      try {
        map = JSON.parse(row.dataset.packagingMap);
      } catch {
        /* a row with no readable map keeps whatever Liquid rendered */
      }
      if (map[handle]) note.textContent = map[handle].note;
    }
  }

  #renderSummary(entry, size, total) {
    const packName = this.#packInput?.dataset.packTitle ?? '';
    this.#setText('[data-summary-pack]', packName || '—');
    this.#setText('[data-summary-flavour-count]', String(this.#chosenFlavours.length));

    const chips = this.querySelector('[data-summary-chips]');
    if (chips) {
      const chosen = this.#chosenFlavours;
      chips.hidden = chosen.length === 0;
      chips.replaceChildren(
        ...chosen.map((flavour) => {
          const chip = document.createElement('span');
          chip.className = 'customize-box__chip';
          if (flavour.image) {
            const img = document.createElement('img');
            img.src = flavour.image;
            img.alt = '';
            img.loading = 'lazy';
            chip.append(img);
          }
          chip.append(document.createTextNode(flavour.title));
          const count = document.createElement('span');
          count.className = 'customize-box__chip-count';
          count.textContent = `×${flavour.count}`;
          chip.append(count);
          return chip;
        })
      );
    }

    const packagingRow = this.querySelector('[data-summary-packaging-row]');
    const packagingName = this.#packagingTitle();
    if (packagingRow) {
      packagingRow.hidden = !packagingName;
      this.#setText('[data-summary-packaging]', packagingName);
    }

    const messageRow = this.querySelector('[data-summary-message-row]');
    if (messageRow) messageRow.hidden = this.#message().length === 0;

    if (entry) this.#setText('[data-summary-total]', entry.priceText);
  }

  #renderReview(entry) {
    const flavours = this.#chosenFlavours
      .map((flavour) => `${flavour.title} ×${flavour.count}`)
      .join(', ');
    this.#setReview('.customize-box__review-flavours', flavours);
    this.#setReview('.customize-box__review-pack', this.#packInput?.dataset.packTitle ?? '');
    this.#setReview('.customize-box__review-packaging', this.#packagingTitle());
    this.#setReview('.customize-box__review-message', this.#message());

    // The button belongs to the last screen, and being unable to buy is a state
    // it shows rather than a reason to vanish: a reader who has built a box and
    // finds no button has no way to learn why.
    const add = this.querySelector('[data-add-wrapper]');
    if (add) {
      add.hidden = this.#screen !== this.#screens.length;
      const button = add.querySelector('button');
      if (button) button.disabled = !entry?.available;
    }
  }

  #renderGates(size, total, entry) {
    const complete = Boolean(size) && total === size;
    for (const screen of this.#screens) {
      const next = screen.querySelector('[data-step-next]');
      if (!next) continue;
      const number = Number(screen.dataset.screen);
      next.disabled = number === 1 ? !complete : !entry;
    }

    const variantInput = this.querySelector('[data-variant-input]');
    if (variantInput) variantInput.value = entry ? String(entry.id) : '';
  }

  /* -------------------------------------------------------------- assembly */

  #writeProperties() {
    const flavours = this.#chosenFlavours
      .map((flavour) => `${flavour.title} ×${flavour.count}`)
      .join(', ');
    this.#setValue('[data-property-flavours]', flavours);
    this.#setValue('[data-property-packaging]', this.#packagingTitle());
    this.#setValue('[data-property-message]', this.#message());
  }

  #packagingTitle() {
    return this.#packagingInput?.closest('.ui-option-row')?.querySelector('.ui-option-row__title')?.textContent.trim() ?? '';
  }

  #message() {
    return this.querySelector('.ui-message__control')?.value.trim() ?? '';
  }

  #setText(selector, value) {
    const node = this.querySelector(selector);
    if (node) node.textContent = value;
  }

  #setValue(selector, value) {
    const node = this.querySelector(selector);
    if (node) node.value = value;
  }

  #setReview(selector, value) {
    const node = this.querySelector(`${selector} .ui-review-row__value`);
    if (node) node.textContent = value || '—';
  }

  /* ------------------------------------------------------------ persistence */

  #selectFirstIfNoneChosen() {
    if (!this.#packagingInput) {
      const first = this.querySelector('input[name="customize-packaging"]');
      if (first) first.checked = true;
    }
  }

  #save() {
    const state = {
      pack: this.#packHandle,
      packaging: this.#packagingInput?.value ?? '',
      message: this.#message(),
      flavours: Object.fromEntries(this.#chosenFlavours.map((f) => [f.handle, f.count])),
    };
    try {
      sessionStorage.setItem(this.#saveKey, JSON.stringify(state));
    } catch {
      /* a browser that refuses storage still gets a working builder */
    }
  }

  #restore() {
    let state = null;
    try {
      state = JSON.parse(sessionStorage.getItem(this.#saveKey) ?? 'null');
    } catch {
      state = null;
    }
    if (!state) return;

    const pack = this.querySelector(`input[name="customize-pack"][value="${CSS.escape(state.pack ?? '')}"]`);
    if (pack) pack.checked = true;

    const packaging = this.querySelector(`input[name="customize-packaging"][value="${CSS.escape(state.packaging ?? '')}"]`);
    if (packaging) packaging.checked = true;

    for (const [handle, count] of Object.entries(state.flavours ?? {})) {
      const card = this.querySelector(`[data-flavour="${CSS.escape(handle)}"]`);
      const input = card?.querySelector('input[type="number"]');
      if (!input) continue;
      input.value = String(count);
      card.toggleAttribute('data-chosen', count > 0);
    }

    const message = this.querySelector('.ui-message__control');
    if (message && state.message) message.value = state.message;
  }
}

if (!customElements.get('customize-box')) {
  customElements.define('customize-box', CustomizeBox);
}

// A section that arrives through the Section Rendering API is inserted as
// markup, and an element that comes in that way is not always upgraded. Asking
// for it explicitly costs nothing when it already happened.
const upgradeAll = () => {
  for (const el of document.querySelectorAll('customize-box')) customElements.upgrade(el);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', upgradeAll, { once: true });
} else {
  upgradeAll();
}
