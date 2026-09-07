/**
 * The delivery date the cart books (Figma: 537:22547 → 538:23485).
 *
 * WHAT THE CALENDAR SUPPORTS — and what it does not. Every rule below is
 * enforced twice: here in the browser, and in Liquid (`cart-delivery-date-valid`)
 * when the cart renders, so a date saved earlier that no longer qualifies is
 * shown as unset and the checkout gate re-engages.
 *
 *   Supported
 *   - Minimum lead time: today + `cart_delivery_min_days` calendar days
 *     (default 3). Days before it are greyed out; the first bookable day is
 *     ringed. Counted from the moment the cart was rendered, in the shop's
 *     timezone; there is no same-day cut-off hour.
 *   - Maximum window: today + `cart_delivery_max_days` calendar days (default
 *     60). Month navigation stops at the last bookable month.
 *   - Disabled weekdays: `cart_delivery_disabled_weekdays`, a comma list of
 *     0 (Sunday) … 6 (Saturday). Empty means every weekday is allowed.
 *   - Blackout dates: `cart_delivery_blackout_dates`, one YYYY-MM-DD per line.
 *     Single dates only — no ranges, no recurring holidays.
 *   - One date per cart, saved as two cart attributes (see below), carried by
 *     the cart form as hidden inputs as well, and copied onto the order as
 *     "Additional details".
 *   - Required before checkout (`require_cart_delivery_date`): the checkout
 *     button is rendered disabled by Liquid until a date is confirmed, and a
 *     capturing guard here opens the calendar instead of submitting if the
 *     button is ever clicked without one.
 *
 *   Not supported (needs an app, a checkout Function, or store data the cart
 *   does not have)
 *   - Server-side enforcement: a visitor with JavaScript off and a hand-typed
 *     /checkout URL, or an accelerated-checkout wallet button if one is turned
 *     on, is not stopped. A Cart & Checkout Validation Function would be.
 *   - Business-day counting or a daily cut-off hour for the lead time.
 *   - Date ranges or repeating rules in the blackout list.
 *   - Destination-based or shipping-method-based availability: the cart does
 *     not know the address or the rate before checkout.
 *   - Capacity per day (a maximum number of orders on one date).
 *
 * Two attributes are written. The named one (`cart_delivery_attribute`,
 * default "Delivery date") carries the date the way the drawer printed it,
 * with the year, so the order shows the customer what they picked.
 * `_delivery_date` carries the ISO date, which is what the drawer reads back to
 * reopen the calendar on the right month — "Thu, Sep 10, 2026" parses
 * differently in every locale, so the display string cannot do that job.
 *
 * The underscore is not a hiding mechanism here. That convention is a line
 * item property one; a cart attribute called `_delivery_date` is still a cart
 * attribute and shows up in the order's additional details like any other. It
 * is named this way to mark it as the machine's copy, not the reader's.
 *
 * A plain custom element rather than Horizon's `Component`: the calendar
 * mostly talks to itself. The one thing it does with the rest of the cart is
 * ask the section renderer to re-render the section after a save, so the
 * pill, the link label and the checkout button all come from server state
 * through the same path a quantity change uses.
 *
 * Two surfaces render the field through one snippet
 * (`cart-delivery-date-field`): the cart drawer (`header-actions.liquid`,
 * which also loads this script) and the /cart page (`blocks/_cart-summary`,
 * with the script loaded by `sections/main-cart.liquid`). Each is a separate
 * custom-element instance with its own picker id, upgraded by the browser
 * wherever it appears; the guard below finds the field that belongs to the
 * checkout button being pressed through the enclosing `cart-items-component`.
 */

import { sectionRenderer } from '@theme/section-renderer';

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
  const match = typeof value === 'string' ? value.trim().match(ISO) : null;
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

/**
 * "0,6" → Set {0, 6}. Anything that is not a whole number 0–6 is ignored.
 *
 * @param {string | undefined} value
 * @returns {Set<number>}
 */
function parseWeekdays(value) {
  const days = new Set();
  for (const part of (value ?? '').split(',')) {
    const day = Number(part.trim());
    if (Number.isInteger(day) && day >= 0 && day <= 6) days.add(day);
  }
  return days;
}

/**
 * "2026-12-25,2026-12-26" → Set of ISO strings. Malformed entries are ignored.
 *
 * @param {string | undefined} value
 * @returns {Set<string>}
 */
function parseBlackout(value) {
  const dates = new Set();
  for (const part of (value ?? '').split(/[,\n]/)) {
    const date = parseISO(part);
    if (date) dates.add(toISO(date));
  }
  return dates;
}

class CartDeliveryDate extends HTMLElement {
  /** @type {Date | null} */
  #pending = null;
  /** @type {Date | null} */
  #chosen = null;
  /** @type {Date} */
  #view = new Date();
  /** @type {Set<number>} */
  #disabledWeekdays = new Set();
  /** @type {Set<string>} */
  #blackout = new Set();
  /** @type {Date} */
  #firstAllowed = new Date();

  /*
   * The parts are looked up each time rather than cached on connect. The
   * cart's section renderer morphs this element's subtree after a quantity
   * change or a save, and a reference taken before the morph may point at a
   * node that is no longer in the document.
   */
  get picker() {
    return this.querySelector('.ui-date-picker');
  }
  get grid() {
    return this.querySelector('[data-date-grid]');
  }
  get weekdays() {
    return this.querySelector('[data-date-weekdays]');
  }
  get monthLabel() {
    return this.querySelector('[data-date-month]');
  }
  get confirmButton() {
    return this.querySelector('[data-date-confirm]');
  }
  get toggleButton() {
    return this.querySelector('[data-date-toggle]');
  }
  get pill() {
    return this.querySelector('[data-date-pill]');
  }
  get error() {
    return this.querySelector('[data-date-error]');
  }

  connectedCallback() {
    if (!this.picker || !this.grid || !this.toggleButton) return;

    this.locale = document.documentElement.lang || 'en';
    this.earliest = parseISO(this.dataset.earliest) ?? new Date();
    this.latest = parseISO(this.dataset.latest) ?? new Date(this.earliest.getFullYear() + 1, 0, 1);
    this.#disabledWeekdays = parseWeekdays(this.dataset.disabledWeekdays);
    this.#blackout = parseBlackout(this.dataset.blackout);
    this.#firstAllowed = this.#findFirstAllowed();

    this.#chosen = parseISO(this.dataset.selected);
    this.#pending = this.#chosen;
    this.#view = new Date(this.#chosen ?? this.#firstAllowed);

    this.#renderWeekdays();
    this.#renderMonth();

    this.addEventListener('click', this.#onClick);

    // Liquid found a saved date that is no longer bookable and showed the row
    // as unset. Clear it from the cart too, so it cannot reach the order.
    if (this.dataset.stale === 'true') this.#clearStale();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
  }

  /** Whether the cart has a confirmed, still-bookable date. */
  get hasDate() {
    return this.#chosen != null && this.#isAllowed(this.#chosen);
  }

  /** Whether checkout is meant to wait for a date. */
  get required() {
    return this.dataset.required === 'true';
  }

  /**
   * Opens the calendar and puts focus in it. Used by the checkout guard when
   * the button is pressed without a date.
   */
  prompt() {
    this.#setOpen(true);
    this.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    const target =
      this.grid?.querySelector('[data-date-day][aria-selected="true"]:not(:disabled)') ??
      this.grid?.querySelector('[data-date-day]:not(:disabled)') ??
      this.toggleButton;
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
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
    const picker = this.picker;
    if (!picker) return;

    picker.toggleAttribute('hidden', !open);
    this.toggleButton?.setAttribute('aria-expanded', String(open));
    this.#showError(false);

    if (open) {
      // A section render (a quantity change, or the one after a save) morphs
      // the server's empty frame over the cells built here — on the drawer's
      // keyed inner and on the cart page's whole section alike. The element
      // itself survives the morph, so nothing reconnects; the frame is filled
      // again on the next open instead.
      if (!this.weekdays?.childElementCount) this.#renderWeekdays();

      // Reopening after a confirm starts from the booked date, not last month.
      this.#pending = this.#chosen;
      this.#view = new Date(this.#chosen ?? this.#firstAllowed);
      this.#renderMonth();
    }
  }

  /**
   * Whether the shop can deliver on a day: inside the window, not a blocked
   * weekday, not a blackout date.
   *
   * @param {Date} date
   */
  #isAllowed(date) {
    if (date < this.earliest || date > this.latest) return false;
    if (this.#disabledWeekdays.has(date.getDay())) return false;
    if (this.#blackout.has(toISO(date))) return false;
    return true;
  }

  /**
   * The first day that can actually be booked. With weekends blocked, that is
   * not always the earliest day of the window — and it is the one the file
   * rings and the one the calendar opens on.
   */
  #findFirstAllowed() {
    const date = new Date(this.earliest);
    while (date <= this.latest) {
      if (this.#isAllowed(date)) return new Date(date);
      date.setDate(date.getDate() + 1);
    }
    return new Date(this.earliest);
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

    const confirm = this.confirmButton;
    if (confirm instanceof HTMLButtonElement) confirm.disabled = this.#pending == null;
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
    const weekdays = this.weekdays;
    if (!weekdays) return;

    const format = new Intl.DateTimeFormat(this.locale, { weekday: 'short' });
    // 1 January 2024 was a Monday.
    const labels = Array.from({ length: 7 }, (_, index) =>
      format.format(new Date(2024, 0, 1 + index)).slice(0, 2)
    );

    weekdays.replaceChildren(
      ...labels.map((label) => {
        const cell = document.createElement('span');
        cell.className = 'ui-date-picker__weekday';
        cell.textContent = label;
        return cell;
      })
    );
  }

  #renderMonth() {
    const grid = this.grid;
    if (!grid) return;

    const year = this.#view.getFullYear();
    const month = this.#view.getMonth();

    const monthLabel = this.monthLabel;
    if (monthLabel) {
      monthLabel.textContent = new Intl.DateTimeFormat(this.locale, {
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
      button.disabled = !this.#isAllowed(date);

      // The file rings the first day the shop can actually deliver on.
      if (sameDay(date, this.#firstAllowed)) button.classList.add('ui-date-picker__day--first');
      if (this.#pending && sameDay(date, this.#pending)) button.setAttribute('aria-selected', 'true');

      cells.push(button);
    }

    grid.replaceChildren(...cells);

    const confirm = this.confirmButton;
    if (confirm instanceof HTMLButtonElement) {
      confirm.disabled = this.#pending == null || !this.#isAllowed(this.#pending);
    }

    for (const nav of this.querySelectorAll('[data-date-nav]')) {
      if (!(nav instanceof HTMLButtonElement)) continue;

      const step = Number(nav.dataset.dateNav);
      const target = new Date(year, month + step, 1).getTime();
      nav.disabled = step < 0 ? target < startOfMonth(this.earliest) : target > startOfMonth(this.latest);
    }
  }

  /**
   * "Thu, Sep 10, 2026" — with the year, so the order's additional details
   * read unambiguously in December for a January date.
   *
   * @param {Date} date
   */
  #format(date) {
    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  /** @param {boolean} show */
  #showError(show) {
    const error = this.error;
    if (error instanceof HTMLElement) error.hidden = !show;
  }

  /**
   * Saves both attributes to the cart and reports whether the cart took them.
   *
   * A 4xx/5xx from /cart/update.js does not throw, so `response.ok` is
   * checked, and the returned cart is read back to confirm the ISO value is
   * actually on it — the only proof the date will reach the order.
   *
   * @param {string} display
   * @param {string} iso
   * @returns {Promise<boolean>}
   */
  async #save(display, iso) {
    const name = this.dataset.attribute || 'Delivery date';

    try {
      const response = await fetch(window.Theme?.routes?.cart_update_url ?? '/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          attributes: { [name]: display, _delivery_date: iso },
        }),
      });
      if (!response.ok) return false;

      const cart = await response.json().catch(() => null);
      const saved = cart?.attributes?._delivery_date ?? '';
      return String(saved) === iso;
    } catch {
      return false;
    }
  }

  async #confirm() {
    const pending = this.#pending;
    if (!pending || !this.#isAllowed(pending)) return;

    const display = this.#format(pending);
    const iso = toISO(pending);
    const confirm = this.confirmButton;

    if (confirm instanceof HTMLButtonElement) confirm.disabled = true;
    this.#showError(false);

    const saved = await this.#save(display, iso);

    if (!saved) {
      // The calendar stays open with the day still selected; the message says
      // why, and the next confirm tries again.
      this.#showError(true);
      if (confirm instanceof HTMLButtonElement) confirm.disabled = false;
      return;
    }

    this.#chosen = pending;
    this.dataset.selected = iso;
    delete this.dataset.stale;
    this.#renderRow(display);
    this.#syncForm(display, iso);
    this.#setGate(false);
    this.#setOpen(false);
    this.#rerender();
  }

  /**
   * The Liquid side found a saved date that is no longer bookable. Post the
   * attributes back empty so the order cannot carry it. Nothing is shown for
   * this beyond the notice Liquid already rendered; failure is silent because
   * the checkout gate is closed regardless.
   */
  async #clearStale() {
    delete this.dataset.stale;
    await this.#save('', '');
  }

  /**
   * The optimistic half of a save: the row shows the date at once, and the
   * server render that follows confirms it.
   *
   * @param {string} display
   */
  #renderRow(display) {
    const pill = this.pill;
    if (pill) {
      pill.textContent = display;
      pill.hidden = false;
    }

    const toggle = this.toggleButton;
    if (toggle) toggle.textContent = this.dataset.changeLabel || 'Change';
  }

  /**
   * Keeps the cart form's hidden inputs in step, so a native submit that
   * happens before the section re-render posts the date just saved.
   *
   * @param {string} display
   * @param {string} iso
   */
  #syncForm(display, iso) {
    const form = document.getElementById('cart-form');
    if (!(form instanceof HTMLFormElement)) return;

    const isoInput = form.querySelector('[data-delivery-date-iso]');
    const displayInput = form.querySelector('[data-delivery-date-display]');
    if (isoInput instanceof HTMLInputElement) isoInput.value = iso;
    if (displayInput instanceof HTMLInputElement) displayInput.value = display;
  }

  /**
   * The checkout button in the same cart component, and the hint under it.
   * Liquid renders both from cart state; this only bridges the moment between
   * a save and the re-render.
   *
   * @param {boolean} gated
   */
  #setGate(gated) {
    const scope = this.closest('cart-items-component') ?? document;
    const button = scope.querySelector('[name="checkout"][data-delivery-date-gate]');
    const hint = scope.querySelector('[data-delivery-date-hint]');

    if (button instanceof HTMLButtonElement) {
      button.disabled = gated;
      if (gated) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
    }
    if (hint instanceof HTMLElement) hint.hidden = !gated;
  }

  /**
   * Re-renders the section this field lives in from the server, the same way
   * a quantity change does, so the pill, the link label, the hidden inputs and
   * the checkout gate all come from cart state through one path. The drawer
   * morphs only its keyed inner (`hydration`), which leaves the open dialog
   * alone; the cart page morphs in full.
   */
  #rerender() {
    const component = this.closest('cart-items-component');
    const sectionId = component instanceof HTMLElement ? component.dataset.sectionId : undefined;
    if (!sectionId) return;

    const isDrawer = component.hasAttribute('data-drawer');
    sectionRenderer
      .renderSection(sectionId, { cache: false, mode: isDrawer ? 'hydration' : 'full' })
      .catch(() => {
        // The optimistic update above already shows the saved date; the next
        // cart change renders the section again.
      });
  }
}

if (!customElements.get('cart-delivery-date')) {
  customElements.define('cart-delivery-date', CartDeliveryDate);
}

/*
 * The checkout guard.
 *
 * Liquid renders the checkout button disabled while the date is missing, so
 * under normal conditions there is nothing to intercept. This is for the
 * moments in between: a section rendered from a stale cache, a button enabled
 * optimistically before a save was rejected, a merchant who turned the
 * requirement on after the page loaded. Capturing, on the document, so it runs
 * before Horizon's own handlers and survives the cart being re-rendered.
 *
 * A checkout button is any `[name="checkout"]` in a cart form (Horizon's is
 * `form="cart-form"`); the field it belongs to is the one in the same
 * `cart-items-component`, or the only one on the page.
 */

/**
 * @param {Element} origin
 * @returns {CartDeliveryDate | null}
 */
function fieldFor(origin) {
  const scope = origin.closest('cart-items-component') ?? document;
  const field = scope.querySelector('cart-delivery-date') ?? document.querySelector('cart-delivery-date');
  return field instanceof CartDeliveryDate ? field : null;
}

/**
 * @param {Element} button
 * @returns {boolean} whether checkout must wait
 */
function guard(button) {
  const field = fieldFor(button);
  if (!field || !field.required || field.hasDate) return false;

  field.prompt();
  return true;
}

document.addEventListener(
  'submit',
  (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('cart-form')) return;

    const submitter = event.submitter;
    if (!(submitter instanceof Element) || submitter.getAttribute('name') !== 'checkout') return;

    if (guard(submitter)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

document.addEventListener(
  'click',
  (event) => {
    const target = event.target instanceof Element ? event.target.closest('[name="checkout"]') : null;
    if (!target) return;

    if (guard(target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);
