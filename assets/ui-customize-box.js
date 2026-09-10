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
import { CartAddEvent } from '@theme/events';
import { formatMoney } from '@theme/money-formatting';

const STORAGE_PREFIX = 'treat-house:customize-box:';

class CustomizeBox extends HTMLElement {
  #screen = 1;
  #screens = [];
  #saveKey = '';
  #sellable = false;
  #adding = false;
  #previousPack = '';
  #capacityMessage = '';

  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = 'true';

    this.#screens = [...this.querySelectorAll('[data-screen]')];
    this.#saveKey = STORAGE_PREFIX + (this.closest('.shopify-section')?.id ?? 'default');

    this.addEventListener('change', this.#onChange);
    this.addEventListener('input', this.#onChange);
    this.addEventListener('click', this.#onClick);

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
    return this.#count(this.#packInput?.dataset.packSize);
  }

  #count(value) {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  }

  get #chosenFlavours() {
    return [...this.querySelectorAll('[data-flavour]')]
      .map((card) => ({
        card,
        handle: card.dataset.flavour,
        title: card.dataset.flavourTitle,
        count: this.#count(card.querySelector('input[type="number"]')?.value),
        price: Number(card.dataset.flavourPrice ?? 0),
        variantId: card.dataset.flavourVariant ?? '',
        available: card.dataset.flavourAvailable === 'true',
        image: card.querySelector('img')?.getAttribute('src') ?? '',
      }))
      .filter((flavour) => flavour.count > 0);
  }

  get #flavourTotal() {
    return this.#chosenFlavours.reduce((sum, flavour) => sum + flavour.count, 0);
  }

  /**
   * What the box costs so far, in minor units, and it is the cart's own sum
   * rather than a figure quoted ahead of it.
   *
   * The pack product used to answer this: pick a twelve and the summary said
   * $36.00 before a single treat had been chosen. That figure was never wrong by
   * accident — it is 12 x $3.00 — but it was the price of a product the cart is
   * never sent, and it told a shopper who had picked nothing that they owed
   * thirty-six dollars. It also had every flavour at the same rate written into
   * it, so a treat priced differently would have been added for free.
   *
   * Adding up the lines is what the cart does, so the two cannot disagree, and
   * the total now starts at nothing and climbs as the treats go in.
   */
  get #totalMinorUnits() {
    const flavours = this.#chosenFlavours.reduce((sum, flavour) => sum + flavour.price * flavour.count, 0);
    const entry = this.#entry;
    const packaging = entry?.unitId ? (entry.unitPrice ?? 0) * (entry.units || 1) : 0;
    return flavours + packaging;
  }

  /** The running total, in the shop's own money format. */
  #totalText() {
    const format = this.dataset.moneyFormat || '${{amount}}';
    const currency = this.dataset.currency || 'USD';
    return formatMoney(this.#totalMinorUnits, format, currency);
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
    if (event.target.matches?.('input[name="customize-pack"]') && !event.target.checked) return;
    this.#capacityMessage = '';
    if (event.target.matches?.('input[name="customize-pack"]') && this.#flavourTotal > this.#packSize) {
      const excess = this.#flavourTotal - this.#packSize;
      const requestedSize = this.#packSize;
      const previous = this.querySelector(`input[name="customize-pack"][value="${CSS.escape(this.#previousPack)}"]`);
      // Keep the shopper's mix intact when a smaller box cannot hold it.
      if (previous) {
        previous.checked = true;
        this.#capacityMessage = `Remove ${excess} treat${excess === 1 ? '' : 's'} before choosing a ${requestedSize}-pack.`;
      }
    }
    const card = event.target.closest?.('[data-flavour]');
    if (card && event.target.matches?.('input[type="number"]')) {
      const otherTotal = this.#chosenFlavours
        .filter((flavour) => flavour.card !== card)
        .reduce((sum, flavour) => sum + flavour.count, 0);
      event.target.value = String(Math.min(this.#count(event.target.value), Math.max(0, this.#packSize - otherTotal)));
    }
    this.#render();
    this.#save();
  };

  #onClick = (event) => {
    const add = event.target.closest?.('[data-flavour-add]');
    if (add) {
      const card = add.closest('[data-flavour]');
      const input = card.querySelector('input[type="number"]');
      if (!input || !this.#packSize || this.#flavourTotal >= this.#packSize) return;
      input.value = '1';
      card.setAttribute('data-chosen', '');
      // `input` then `change`, the pair a typed edit produces. The stepper
      // re-reads its buttons on `input` alone, so sending only `change` left a
      // freshly added flavour with its minus disabled from the zero it just left.
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (event.target.closest?.('[data-add-button]')) {
      this.#addToCart(event.target.closest('[data-add-button]'));
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
    this.#syncFlavourLimits();
    this.#previousPack = this.#packHandle;
    for (const screen of this.#screens) {
      screen.hidden = Number(screen.dataset.screen) !== this.#screen;
    }

    const size = this.#packSize;
    const total = this.#flavourTotal;
    const entry = this.#entry;

    this.#renderHeading();
    this.#renderTally(size, total);
    this.#renderPackagingNotes();
    this.#renderSummary(entry, size, total);
    this.#renderReview(entry);
    this.#renderGates(size, total, entry);
  }

  /** Keep every flavour within the capacity left by the other flavours. */
  #syncFlavourLimits() {
    const cards = [...this.querySelectorAll('[data-flavour]')];
    let remaining = this.#packSize;
    // Normalise persisted values as well as typed numbers. Valid mixes are
    // unchanged; old overfilled sessions are brought back inside their box.
    for (const card of cards) {
      const input = card.querySelector('input[type="number"]');
      if (!input) continue;
      const count = Math.min(this.#count(input.value), remaining);
      input.value = String(count);
      remaining -= count;
      card.toggleAttribute('data-chosen', count > 0);
    }
    for (const card of cards) {
      const input = card.querySelector('input[type="number"]');
      if (!input) continue;
      input.max = String(this.#count(input.value) + remaining);
      const add = card.querySelector('[data-flavour-add]');
      if (add) add.disabled = remaining === 0;
      // The kit stepper observes input, not max mutations. Refresh its plus
      // AND minus after changing the limit, without re-entering this builder.
      input.dispatchEvent(new Event('input'));
    }
  }

  /**
   * The hero title past step one. Liquid carries both wordings on the spans, so
   * nothing here knows what the page says — only which of the two to show.
   *
   * The heading is the one thing this element writes that sits outside it: the
   * hero is drawn above the form, and has to stay there, because a shop with no
   * pack collection picked shows the hero and a setup note and never renders the
   * form at all. So the search runs from the section, not from `this` — which is
   * why the title silently refused to change the first time.
   *
   * A merchant who leaves the later wording empty keeps the first one, rather
   * than watching the title empty itself on step two.
   */
  #renderHeading() {
    const section = this.closest('.customize-box');
    if (!section) return;
    for (const part of section.querySelectorAll('[data-heading-part]')) {
      const after = part.dataset.after;
      part.textContent = this.#screen > 1 && after ? after : part.dataset.first;
    }
  }

  #renderTally(size, total) {
    const tally = this.querySelector('[data-tally]');
    if (!tally) return;
    if (!size) {
      tally.textContent = '';
      return;
    }
    tally.textContent = `${total} of ${size} chosen${this.#capacityMessage ? '. ' + this.#capacityMessage : ''}`;
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
            img.className = 'customize-box__chip-image';
            img.src = flavour.image;
            img.alt = '';
            img.loading = 'lazy';
            chip.append(img);
          }

          // The words sit in their own padded block beside the picture, which
          // is flush to the chip's edge.
          const body = document.createElement('span');
          body.className = 'customize-box__chip-body';

          const name = document.createElement('span');
          name.className = 'customize-box__chip-name';
          name.textContent = flavour.title;
          body.append(name);

          const count = document.createElement('span');
          count.className = 'customize-box__chip-count';
          count.textContent = `×${flavour.count}`;
          body.append(count);

          chip.append(body);
          return chip;
        })
      );
    }

    const packagingRow = this.querySelector('[data-summary-packaging-row]');
    const packagingName = this.#packagingTitle();
    if (packagingRow) {
      packagingRow.hidden = !packagingName;
      this.#setText('[data-summary-packaging-name]', packagingName);

      // Only a surcharge is worth repeating beside the name. The note is also
      // "Included", or empty for a choice with no product behind it, and neither
      // says anything the row does not already say. Liquid writes a money note by
      // prepending "+ ", in every locale, so the sign is what separates the two.
      const note = entry?.note ?? '';
      this.#setText('[data-summary-packaging-extra]', note.startsWith('+') ? ` (${note})` : '');
    }

    const messageRow = this.querySelector('[data-summary-message-row]');
    if (messageRow) messageRow.hidden = this.#message().length === 0;

    this.#setText('[data-summary-total]', this.#totalText());
  }

  #renderReview(entry) {
    const flavours = this.#chosenFlavours
      .map((flavour) => `${flavour.title} ×${flavour.count}`)
      .join(', ');
    this.#setReview('.customize-box__review-flavours', flavours);
    // The file writes this line as "12 Pack ($3.75 / treat)" — the same per-treat
    // figure the tile carries, which the tile hands over rather than it being
    // worked out twice.
    const packTitle = this.#packInput?.dataset.packTitle ?? '';
    const packNote = this.#packInput?.dataset.packNote ?? '';
    this.#setReview('.customize-box__review-pack', packTitle && packNote ? `${packTitle} (${packNote})` : packTitle);
    this.#setReview('.customize-box__review-packaging', this.#packagingTitle());
    this.#setReview('.customize-box__review-message', this.#message());

    // The button belongs to the last screen, and being unable to buy is a state
    // it shows rather than a reason to vanish: a reader who has built a box and
    // finds no button has no way to learn why.
    const add = this.querySelector('[data-add-wrapper]');
    if (add) {
      add.hidden = this.#screen !== this.#screens.length;
      // Whether it can be pressed is decided in #renderGates, which runs after
      // this and owns the answer.
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

    // The pack product is not bought any more, so its variant no longer decides
    // anything. What has to be sellable is what actually goes in the cart: every
    // chosen flavour, and the packaging when it stands for a product.
    const flavours = this.#chosenFlavours;
    const packagingSellable = Boolean(entry) && (!entry.unitId || entry.unitAvailable !== false);
    this.#sellable =
      complete && flavours.length > 0 && flavours.every((f) => f.variantId && f.available) && packagingSellable;

    const button = this.querySelector('[data-add-button]');
    if (button) button.disabled = !this.#sellable || this.#adding;
  }

  /* -------------------------------------------------------------- assembly */

  /**
   * The box as cart lines: one per flavour, plus one for the packaging when the
   * choice stands for a product. The pack product is not among them — its price
   * is the sum of the flavours, so sending it too would charge the box twice.
   *
   * The gift message rides a line as well as the order attribute below. The
   * attribute is what was asked for, but Shopify keeps one per cart, so a second
   * box would overwrite the first; the copy on the line is what keeps two boxes
   * legible.
   *
   * The packaging line is the one that should carry it, since the card goes in
   * the box. A packaging choice with no product behind it has no line, though,
   * and step 4 is offered whatever is chosen — so the message falls back to the
   * first flavour rather than existing only in the attribute Shopify is about to
   * overwrite.
   */
  /** Continue after the highest surviving box number, even when earlier boxes were removed. */
  async #nextBoxNumber() {
    try {
      const cart = await fetch('/cart.js', { headers: { Accept: 'application/json' } }).then((r) => r.json());
      const seen = new Set();
      let highestNumber = 0;
      for (const line of cart.items ?? []) {
        const id = line.properties?._box;
        if (!id) continue;
        seen.add(id);
        const match = String(line.properties?.Box ?? '').match(/^Custom \d+-Pack #([1-9]\d*)$/);
        const number = Number(match?.[1]);
        if (Number.isSafeInteger(number)) highestNumber = Math.max(highestNumber, number);
      }
      // Legacy boxes without a readable number still occupy a place in the cart.
      return Math.max(seen.size, highestNumber) + 1;
    } catch {
      // A cart that cannot be read is not a reason to refuse the box. One is the
      // honest guess: most carts hold no box at all.
      return 1;
    }
  }

  #cartItems(boxNumber) {
    const message = this.#message();

    /*
     * Every line of one box carries the same `_box`, and this is the whole reason
     * the cart can hold a box together. A box arrives as several lines — one per
     * flavour and one for the packaging — and until now nothing tied them: the
     * cart saw unrelated products, gave each its own stepper, and a shopper could
     * set a flavour to 15 inside a box that holds 12. The mark is what lets the
     * cart recognise the set and refuse to let it drift.
     *
     * The leading underscore is Shopify's: a property named `_something` is kept
     * on the line and left out of the cart, the checkout, the order and the emails
     * a customer sees. So this is bookkeeping, not a line of copy.
     *
     * `_box_size` rides along because the cart has no other way to know what the
     * box was built to hold — the pack size lives in the builder and is gone by
     * the time the lines land.
     */
    const boxId = `bx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const boxSize = String(this.#packSize || this.#flavourTotal);

    /*
     * Two marks, and they do different jobs. `_box` is the machine's — the
     * underscore keeps it off the cart, the checkout, the order and the emails,
     * and it exists only so the lines of one box can find each other.
     *
     * `Box` has no underscore, so it is printed everywhere a line item property
     * is printed. It is what tells a shopper that these four rows are one thing
     * rather than four, and what tells the kitchen which box a flavour belongs to
     * when an order carries two of them. An id would have done neither: nobody
     * reads `bx-k3f9a` and thinks "the first box".
     *
     * The number follows the highest box number already in the cart, so the
     * second box a shopper builds is #2. Remove the first afterwards and the
     * second stays #2 — the labels are the order they were built in, which is
     * the order the kitchen packs them in, and renumbering the survivor would
     * only make the packing slip disagree with the confirmation email.
     */
    const boxProperties = {
      _box: boxId,
      _box_size: boxSize,
      Box: `Custom ${boxSize}-Pack #${boxNumber}`,
    };

    const items = this.#chosenFlavours.map((flavour) => ({
      id: Number(flavour.variantId),
      quantity: flavour.count,
      properties: { ...boxProperties },
    }));

    const entry = this.#entry;
    if (entry?.unitId) {
      const packaging = {
        id: Number(entry.unitId),
        quantity: entry.units || 1,
        properties: { ...boxProperties },
      };
      items.push(packaging);
    }

    const carrier = entry?.unitId ? items.at(-1) : items[0];
    if (message && carrier) carrier.properties['Gift message'] = message;

    return items;
  }

  async #addToCart(button) {
    this.#render();
    if (this.#adding || !this.#sellable) return;
    this.#adding = true;
    button.disabled = true;
    this.#setAddError('');

    try {
      const boxNumber = await this.#nextBoxNumber();
      // The shopper can edit the mix while the existing cart is being read.
      this.#render();
      if (!this.#sellable) return;
      const message = this.#message();
      const items = this.#cartItems(boxNumber);
      if (!items.length) return;
      const response = await fetch(Theme?.routes?.cart_add_url ?? '/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items }),
      });
      const body = await response.json();

      if (!response.ok) {
        // Shopify answers a refused line with a description worth reading —
        // usually that something ran out — so it is shown rather than swallowed.
        this.#setAddError(body.description || body.message || '');
        return;
      }

      // Attributes are not part of /cart/add, so the note is a second request.
      // It follows the add: a note left on a cart that never received the box
      // would outlive the attempt.
      if (message) {
        try {
          await fetch('/cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ attributes: { 'Gift message': message } }),
          });
        } catch (error) {
          // The confirmed add already stores the note on its box line. A failed
          // optional order-level copy must not invite the shopper to add twice.
          console.warn('Box added; the gift message remains on its cart line.', error);
        }
      }

      this.#announce(Theme?.translations?.added ?? '');
      // The same event Horizon's own add-to-cart raises. It bubbles to document,
      // where the cart icon and the cart items are listening, so the drawer and
      // the count refresh without this file knowing anything about either.
      this.dispatchEvent(
        new CartAddEvent({}, this.id || 'customize-box', {
          source: 'customize-box',
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        })
      );
    } catch (error) {
      console.error(error);
      this.#setAddError(String(error?.message ?? error));
    } finally {
      this.#adding = false;
      button.disabled = !this.#sellable;
    }
  }

  #setAddError(text) {
    const node = this.querySelector('[data-add-error]');
    if (!node) return;
    node.textContent = text;
    node.hidden = !text;
  }

  #announce(text) {
    const region = this.querySelector('[data-live-region]');
    if (region) region.textContent = text;
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

      // Setting `.value` fires nothing, and the stepper works out which of its
      // buttons to disable only when it hears from its own input. Restore in
      // silence and every flavour comes back with its minus disabled — frozen
      // from the zero the server rendered — so a box reopened full could not be
      // changed at all. This is the event that would have accompanied a real
      // edit; it deliberately does not bubble, so the host does not re-render
      // and re-save once per restored flavour on load.
      input.dispatchEvent(new Event('input'));
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
