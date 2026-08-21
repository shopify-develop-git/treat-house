/**
 * The delivery date the cart drawer books (Figma: 537:22547 → 538:23485).
 *
 * Wraps the shipping panel and the calendar under it, because the two are one
 * control: the panel's third row is the trigger and the readout, and the
 * calendar is what it opens. The date is a cart attribute rather than a line
 * property — it belongs to the order, not to any one treat, and an attribute is
 * what a packer already reads off the order.
 *
 * Two attributes are written. The named one carries the date the way the drawer
 * printed it, so the order shows the customer what they picked. `_delivery_date`
 * carries the ISO date, which is what the drawer reads back to reopen the
 * calendar on the right month — "Thu, Sep 9" has no year in it and parses
 * differently in every locale, so the display string cannot do that job.
 *
 * The underscore is not a hiding mechanism here. That convention is a line item
 * property one; a cart attribute called `_delivery_date` is still a cart
 * attribute and shows up in the order's additional details like any other. It is
 * named this way to mark it as the machine's copy, not the reader's.
 *
 * A plain custom element rather than Horizon's `Component`: nothing here hangs
 * off the cart form or its section rendering, so there is no reason to take on
 * the ref/`on:` conventions to talk to a calendar that only talks to itself.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses `YYYY-MM-DD` as a local date.
 *
 * `new Date('2026-07-08')` is midnight UTC, which is the 7th anywhere west of
 * Greenwich — so the shop's earliest date would land a day early for a good
 * part of the world. Splitting the parts and building a local date keeps the
 * day the shop meant.
 *
 * @param {string | null | undefined} value
 * @returns {Date | null}
 */
function parseISO(value) {
  const match = typeof value === 'string' ? value.match(ISO) : null;
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {Date} date
 * @returns {string}
 */
function toISO(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** @param {Date} a @param {Date} b */
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** @param {Date} date @returns {number} */
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getTime();

class CartDeliveryDate extends HTMLElement {
  /** @type {Date | null} */
  #pending = null;
  /** @type {Date | null} */
  #chosen = null;
  /** @type {Date} */
  #view = new Date();

  connectedCallback() {
    this.picker = this.querySelector('.ui-date-picker');
    this.grid = this.querySelector('[data-date-grid]');
    this.weekdays = this.querySelector('[data-date-weekdays]');
    this.monthLabel = this.querySelector('[data-date-month]');
    this.confirmButton = this.querySelector('[data-date-confirm]');
    this.toggleButton = this.querySelector('[data-date-toggle]');
    this.pill = this.querySelector('[data-date-pill]');

    if (!this.picker || !this.grid || !this.toggleButton) return;

    this.locale = document.documentElement.lang || 'en';
    this.earliest = parseISO(this.dataset.earliest) ?? new Date();
    this.latest = parseISO(this.dataset.latest) ?? new Date(this.earliest.getFullYear() + 1, 0, 1);
    this.#chosen = parseISO(this.dataset.selected);
    this.#pending = this.#chosen;
    this.#view = new Date(this.#chosen ?? this.earliest);

    this.#renderWeekdays();
    this.#renderMonth();

    this.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
  }

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-date-toggle]')) {
      this.#setOpen(this.picker?.hasAttribute('hidden') ?? false);
      return;
    }

    const nav = target.closest('[data-date-nav]');
    if (nav instanceof HTMLElement) {
      this.#step(Number(nav.dataset.dateNav));
      return;
    }

    const day = target.closest('[data-date-day]');
    if (day instanceof HTMLButtonElement && !day.disabled) {
      this.#select(day);
      return;
    }

    if (target.closest('[data-date-confirm]')) this.#confirm();
  };

  /** @param {boolean} open */
  #setOpen(open) {
    if (!this.picker) return;

    this.picker.toggleAttribute('hidden', !open);
    this.toggleButton?.setAttribute('aria-expanded', String(open));

    if (open) {
      // Reopening after a confirm starts from the booked date, not last month.
      this.#pending = this.#chosen;
      this.#view = new Date(this.#chosen ?? this.earliest);
      this.#renderMonth();
    }
  }

  /**
   * Marks one day as chosen by moving an attribute, rather than by drawing the
   * month again.
   *
   * Drawing it again is what the rest of this file does, and here it closed the
   * drawer. Horizon's dialog decides whether a click was meant for it by asking
   * `dialog.contains(event.target)` (utilities.js → `isClickedOutside`), and it
   * asks on the way up from the same click this handler is still inside.
   * Replacing the grid takes the clicked button out of the document first, so a
   * detached target read as a click on the backdrop and the cart shut.
   *
   * Only the two cells that change are touched, which is also the cheaper thing
   * to do and keeps the keyboard's focus where the visitor put it.
   *
   * @param {HTMLButtonElement} button
   */
  #select(button) {
    this.#pending = parseISO(button.dataset.dateDay);

    for (const chosen of this.grid?.querySelectorAll('[aria-selected="true"]') ?? []) {
      chosen.removeAttribute('aria-selected');
    }
    button.setAttribute('aria-selected', 'true');

    if (this.confirmButton instanceof HTMLButtonElement) {
      this.confirmButton.disabled = this.#pending == null;
    }
  }

  /** @param {number} step */
  #step(step) {
    if (!Number.isFinite(step)) return;

    this.#view = new Date(this.#view.getFullYear(), this.#view.getMonth() + step, 1);
    this.#renderMonth();
  }

  /**
   * Monday first, as the file draws it, and two letters — which is what the
   * design shows and what every short weekday name in a Latin locale trims to
   * without turning into the single letter `narrow` would give.
   */
  #renderWeekdays() {
    if (!this.weekdays) return;

    const format = new Intl.DateTimeFormat(this.locale, { weekday: 'short' });
    // 1 January 2024 was a Monday.
    const labels = Array.from({ length: 7 }, (_, index) =>
      format.format(new Date(2024, 0, 1 + index)).slice(0, 2)
    );

    this.weekdays.replaceChildren(
      ...labels.map((label) => {
        const cell = document.createElement('span');
        cell.className = 'ui-date-picker__weekday';
        cell.textContent = label;
        return cell;
      })
    );
  }

  #renderMonth() {
    if (!this.grid) return;

    const year = this.#view.getFullYear();
    const month = this.#view.getMonth();

    if (this.monthLabel) {
      this.monthLabel.textContent = new Intl.DateTimeFormat(this.locale, {
        month: 'long',
        year: 'numeric',
      }).format(this.#view);
    }

    const cells = [];
    // getDay() is Sunday-first; the file's week starts on Monday.
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let index = 0; index < lead; index++) {
      const blank = document.createElement('span');
      blank.className = 'ui-date-picker__day ui-date-picker__day--empty';
      cells.push(blank);
    }

    const days = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const date = new Date(year, month, day);
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'ui-date-picker__day';
      button.dataset.dateDay = toISO(date);
      button.textContent = String(day);
      button.disabled = date < this.earliest || date > this.latest;

      // The file rings the first day the shop can actually deliver on.
      if (sameDay(date, this.earliest)) button.classList.add('ui-date-picker__day--first');
      if (this.#pending && sameDay(date, this.#pending)) button.setAttribute('aria-selected', 'true');

      cells.push(button);
    }

    this.grid.replaceChildren(...cells);

    if (this.confirmButton instanceof HTMLButtonElement) {
      this.confirmButton.disabled = this.#pending == null;
    }

    for (const nav of this.querySelectorAll('[data-date-nav]')) {
      if (!(nav instanceof HTMLButtonElement)) continue;

      const step = Number(nav.dataset.dateNav);
      const target = new Date(year, month + step, 1).getTime();
      nav.disabled = step < 0 ? target < startOfMonth(this.earliest) : target > startOfMonth(this.latest);
    }
  }

  /** @param {Date} date */
  #format(date) {
    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  async #confirm() {
    const pending = this.#pending;
    if (!pending) return;

    const name = this.dataset.attribute || 'Delivery date';
    const display = this.#format(pending);

    if (this.confirmButton instanceof HTMLButtonElement) this.confirmButton.disabled = true;

    try {
      await fetch(window.Theme?.routes?.cart_update_url ?? '/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          attributes: { [name]: display, _delivery_date: toISO(pending) },
        }),
      });
    } catch {
      // The drawer keeps the date it is showing; the next confirm tries again.
      if (this.confirmButton instanceof HTMLButtonElement) this.confirmButton.disabled = false;
      return;
    }

    this.#chosen = pending;
    this.#renderRow(display);
    this.#setOpen(false);
  }

  /** @param {string} display */
  #renderRow(display) {
    if (this.pill) {
      this.pill.textContent = display;
      this.pill.hidden = false;
    }

    if (this.toggleButton) {
      this.toggleButton.textContent = this.dataset.changeLabel || 'Change';
    }
  }
}

if (!customElements.get('cart-delivery-date')) {
  customElements.define('cart-delivery-date', CartDeliveryDate);
}
