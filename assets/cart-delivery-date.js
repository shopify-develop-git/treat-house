/**
 * ZIP-first ground estimates shared by the cart drawer and cart page.
 * Estimates use statewide directional ranges, never a carrier promise. ASAP
 * needs no date; an opted-in later request must be valid and acknowledged.
 * A page-wide intent state and serialized writes prevent stale section morphs
 * and slower responses from replacing a newer destination/date selection.
 */
import { calculateProductionTiming } from '@theme/th-shipping-timing';
import { calculateDeliveryEstimate, normalizeDeliveryZip, DELIVERY_ESTIMATE_BASIS } from '@theme/th-delivery-estimate';

const fields = new Set();
const postalLoads = new Map();
let state;
let postalSnapshot = null;
let writes = Promise.resolve();
let latestWrite = Promise.resolve(true);
let revision = 0;
let queuedSignature = '';
let serverClockOffset = 0;
let repaintQueued = false;
let cartRevision = 0;
const REQUEST_PROPERTY = 'Requested delivery date';
const SYNC_SOURCE = 'delivery-request-sync';
const lockedRows = new Set();

function hidden(node, value) { if (node && node.hidden !== value) node.hidden = value; }
function text(node, value) { if (node && node.textContent !== value) node.textContent = value; }
function data(node, key, value) { if (node.dataset[key] !== value) node.dataset[key] = value; }

async function loadPostal(url) {
  if (!url) throw new Error('Missing ZIP data');
  if (!postalLoads.has(url)) {
    postalLoads.set(url, fetch(url).then(response => {
      if (!response.ok) throw new Error('ZIP lookup unavailable');
      return response.json();
    }).then(result => {
      if (!result?.states || typeof result.states !== 'object') throw new Error('Invalid ZIP data');
      postalSnapshot = result;
      return result;
    }).catch(error => { postalLoads.delete(url); throw error; }));
  }
  return postalLoads.get(url);
}

function refreshAll(persist = false) {
  if (state?.saving) {
    for (const row of document.querySelectorAll('.cart-items__table-row')) {
      if (!row.hasAttribute('inert')) { row.setAttribute('inert', ''); lockedRows.add(row); }
    }
  } else {
    for (const row of lockedRows) row.removeAttribute('inert');
    lockedRows.clear();
  }
  for (const field of fields) field.refresh();
  for (const field of fields) field.paint();
  const source = fields.values().next().value;
  if (persist && source && source.lookupReady) queueSave(source);
}

async function syncRequestProperties(cart, attributes, isCurrent, onChanged) {
  if (!Array.isArray(cart?.items)) throw new Error('Missing cart lines');
  const value = attributes._delivery_mode === 'requested' && attributes._delivery_date
    ? attributes[REQUEST_PROPERTY] || attributes._delivery_date : '';
  let changed = false;
  let remaining = cart.items.length + 5;
  while (isCurrent()) {
    const pending = cart.items.filter(line => String(line.properties?.[REQUEST_PROPERTY] || '') !== value);
    const item = pending[0];
    if (!item) return { cart, changed };
    if (!remaining--) throw new Error('Cart changed during delivery save');
    if (!value) state.lineClearRequired = true;
    const properties = { ...(item.properties || {}) };
    delete properties[REQUEST_PROPERTY];
    delete properties._delivery_preference;
    if (value) properties[REQUEST_PROPERTY] = value;
    // Shopify cannot replace properties with an empty object. Keep a private
    // preference marker when removing the only public property.
    if (!Object.keys(properties).length) properties._delivery_preference = 'asap';
    const sections = pending.length === 1 ? [...new Set([...document.querySelectorAll('cart-items-component[data-section-id]')].map(node => node.dataset.sectionId))].slice(0, 5) : [];
    const response = await fetch(window.Theme?.routes?.cart_change_url ?? `${window.Shopify?.routes?.root || '/'}cart/change.js`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: item.key, quantity: item.quantity, properties, ...(sections.length ? { sections, sections_url: window.location.pathname } : {}) }),
    });
    if (!response.ok) throw new Error('Could not update delivery request');
    const updated = await response.json();
    if (!Array.isArray(updated?.items)) throw new Error('Missing cart line acknowledgement');
    const acknowledged = updated.items.some(line => line.variant_id === item.variant_id &&
      Object.entries(properties).every(([key, value]) => String(line.properties?.[key] ?? '') === String(value)) &&
      String(line.properties?.[REQUEST_PROPERTY] || '') === value);
    if (!acknowledged) throw new Error('Delivery line property was not saved');
    cart = updated;
    changed = true;
    onChanged(cart);
  }
  return { cart, changed };
}

function queueSave(source) {
  const attributes = source.deliveryAttributes();
  const signature = JSON.stringify(attributes);
  const queueKey = `${cartRevision}:${signature}`;
  if (signature === state.savedSignature && !state.saving && !state.failed) return Promise.resolve(true);
  if (queueKey === queuedSignature && state.saving) return latestWrite;
  const current = ++revision;
  queuedSignature = queueKey;
  state.saving = true;
  state.failed = false;
  refreshAll();
  const write = async () => {
    if (current !== revision) return false;
    let saved = false;
    let changedCart = null;
    try {
      const response = await fetch(window.Theme?.routes?.cart_update_url ?? '/cart/update.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ attributes }),
      });
      let cart = response.ok ? await response.json() : null;
      if (cart && Object.entries(attributes).every(([key, value]) => String(cart.attributes?.[key] ?? '') === value)) {
        const result = await syncRequestProperties(cart, attributes, () => current === revision, cart => { changedCart = cart; });
        cart = result.cart;
        if (result.changed) changedCart = cart;
        saved = current === revision && Object.entries(attributes).every(([key, value]) => String(cart.attributes?.[key] ?? '') === value) && cart.items.every(item =>
          String(item.properties?.[REQUEST_PROPERTY] || '') ===
          (attributes._delivery_mode === 'requested' && attributes._delivery_date ? attributes[REQUEST_PROPERTY] || attributes._delivery_date : ''));
      }
    } catch { /* The active request remains retryable. */ }
    if (current === revision) {
      state.saving = false;
      state.failed = !saved;
      if (saved) {
        state.savedSignature = signature;
        state.lineClearRequired = false;
      }
      refreshAll();
    }
    if (changedCart) document.dispatchEvent(new CustomEvent('cart:update', {
      bubbles: true,
      detail: { resource: changedCart, sourceId: SYNC_SOURCE, data: { source: SYNC_SOURCE, sections: changedCart.sections } },
    }));
    return saved && current === revision;
  };
  latestWrite = writes.then(write, write);
  writes = latestWrite.catch(() => false);
  return latestWrite;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

// The drawer and cart page may both clear a legacy date. Serialize their writes
// so a slow clear cannot arrive after a shopper's newer requested-date save.


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
  return Number.isNaN(date.getTime()) || toISO(date) !== value.trim() ? null : date;
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
    if (part.trim() === '') continue;
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
  #pending = null;
  #chosen = null;
  #view = new Date();
  #disabledWeekdays = new Set([0, 6]);
  #blackout = new Set();
  #firstAllowed = new Date();
  #clockStamp = null;
  #timer;
  #typingTimer;
  #timingValid = false;
  #postal = null;
  #lookupLoading = false;
  #lookupFailed = false;
  #calendarOpen = false;
  #calendarInitialized = false;

  get picker() { return this.querySelector('.ui-date-picker'); }
  get grid() { return this.querySelector('[data-date-grid]'); }
  get weekdays() { return this.querySelector('[data-date-weekdays]'); }
  get monthLabel() { return this.querySelector('[data-date-month]'); }
  get confirmButton() { return this.querySelector('[data-date-confirm]'); }
  get toggleButton() { return this.querySelector('[data-date-toggle]'); }
  get pill() { return this.querySelector('[data-date-pill]'); }
  get error() { return this.querySelector('[data-date-error]'); }
  get zipInput() { return this.querySelector('[data-delivery-zip]'); }
  get lookupReady() { return Boolean(this.#postal) || this.#lookupFailed; }

  connectedCallback() {
    this.locale = document.documentElement.lang || 'en';
    this.earliest = parseISO(this.dataset.earliest) ?? new Date();
    this.latest = parseISO(this.dataset.latest) ?? new Date();
    if (!state) {
      state = {
        zip: this.dataset.zip || '', mode: this.dataset.mode === 'requested' ? 'requested' : 'asap',
        selected: this.dataset.selected || '', estimate: null, dispatchDate: '',
        saving: false, failed: false, savedSignature: '', draft: false, asapClearing: false, lineClearRequired: false,
      };
      if (state.mode === 'asap') state.selected = '';
    }
    fields.add(this);
    this.addEventListener('click', this.#onClick);
    this.addEventListener('input', this.#onInput);
    this.addEventListener('keydown', this.#onKeydown);
    this.#timer = window.setInterval(() => refreshAll(Boolean(state.zip || state.mode === 'requested')), 30_000);
    refreshAll();
    this.#load();
  }

  disconnectedCallback() {
    fields.delete(this);
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('input', this.#onInput);
    this.removeEventListener('keydown', this.#onKeydown);
    window.clearInterval(this.#timer);
    window.clearTimeout(this.#typingTimer);
  }

  async #load() {
    if (this.#lookupLoading) return;
    this.#lookupLoading = true;
    this.#lookupFailed = false;
    this.paint();
    try { this.#postal = await loadPostal(this.dataset.zipStatesUrl); }
    catch { this.#lookupFailed = true; }
    this.#lookupLoading = false;
    if (!this.isConnected) return;
    refreshAll(true);
  }

  get required() { return state.mode === 'requested' || state.asapClearing || state.lineClearRequired; }
  get hasDate() {
    this.refresh();
    if (state.asapClearing || state.lineClearRequired) return false;
    const selected = parseISO(state.selected);
    return Boolean(selected && this.#isAllowed(selected) && !state.saving && !state.failed && !state.draft &&
      state.savedSignature === JSON.stringify(this.deliveryAttributes()));
  }

  prompt() {
    if (state.mode === 'requested' && state.estimate?.ok) {
      this.#setOpen(true);
      this.#focusCalendar();
    } else {
      this.zipInput?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      this.zipInput?.focus({ preventScroll: true });
    }
  }

  #focusCalendar() {
    if (!this.picker || this.picker.hidden) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    this.picker.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    const target = this.grid?.querySelector('[data-date-day][aria-selected="true"]:not(:disabled)') ??
      this.grid?.querySelector('[data-date-day]:not(:disabled)');
    target?.focus({ preventScroll: true });
  }

  #onInput = event => {
    if (!event.target.matches('[data-delivery-zip]')) return;
    window.clearTimeout(this.#typingTimer);
    // Capture intent before debounce so checkout cannot use the previous ZIP.
    state.zip = event.target.value.trim();
    state.selected = ''; state.draft = false; state.estimate = null;
    for (const field of fields) field.#pending = null;
    refreshAll();
    this.#typingTimer = window.setTimeout(() => this.#applyZip(), 350);
  };

  #onKeydown = event => {
    if (event.key === 'Enter' && event.target.matches('[data-delivery-zip]')) {
      event.preventDefault(); event.stopPropagation(); this.#applyZip();
    }
  };

  #onClick = event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-estimate-submit]')) { this.#applyZip(); return; }
    if (target.closest('[data-delivery-asap]')) { this.#asap(); return; }
    if (target.closest('[data-date-toggle]')) {
      this.refresh();
      if (!state.estimate?.ok || !this.picker) return;
      if (state.mode !== 'requested') {
        state.mode = 'requested'; state.selected = ''; state.draft = false;
        refreshAll(); queueSave(this);
      }
      // This action always reveals the calendar. An unfinished request must
      // never become a hidden requirement for checkout.
      this.#setOpen(true);
      this.#focusCalendar();
      return;
    }
    const nav = target.closest('[data-date-nav]');
    if (nav) { this.#step(Number(nav.dataset.dateNav)); return; }
    const day = target.closest('[data-date-day]');
    if (day instanceof HTMLButtonElement && !day.disabled) {
      this.#select(day); state.draft = true; this.#setGate(true); return;
    }
    if (target.closest('[data-date-confirm]')) this.#confirm();
  };

  async #applyZip() {
    window.clearTimeout(this.#typingTimer);
    const raw = this.zipInput?.value.trim() || '';
    if (raw !== state.zip) {
      state.zip = raw; state.selected = ''; state.draft = false; state.estimate = null;
      for (const field of fields) field.#pending = null;
    }
    if (!this.#postal) await this.#load();
    refreshAll();
    await queueSave(this);
  }

  async #asap() {
    state.asapClearing = state.mode === 'requested' || state.lineClearRequired;
    if (state.mode === 'requested' && state.selected) state.lineClearRequired = true;
    state.mode = 'asap'; state.selected = ''; state.draft = false;
    for (const field of fields) { field.#pending = null; field.#setOpen(false); }
    refreshAll();
    await queueSave(this);
    state.asapClearing = false;
    refreshAll();
  }

  #setOpen(open) {
    this.#calendarOpen = open;
    if (!this.picker) return;
    hidden(this.picker, !open);
    this.toggleButton?.setAttribute('aria-expanded', String(open));
    if (open) {
      this.refresh();
      this.#prepareCalendar();
      this.#renderWeekdays(); this.#renderMonth();
    } else {
      this.#calendarInitialized = false;
    }
  }

  #prepareCalendar() {
    if (this.#calendarInitialized) return;
    this.#firstAllowed = this.#findFirstAllowed();
    this.#chosen = parseISO(state.selected);
    this.#pending = this.#chosen;
    this.#view = new Date(this.#chosen ?? this.#firstAllowed);
    this.#calendarInitialized = true;
  }

  #isAllowed(date) {
    return this.#timingValid && date >= this.earliest && date <= this.latest &&
      !this.#disabledWeekdays.has(date.getDay()) && !this.#blackout.has(toISO(date));
  }

  refresh() {
    if (postalSnapshot) this.#postal = postalSnapshot;
    const stamp = this.dataset.serverNow || '';
    if (stamp !== this.#clockStamp) {
      this.#clockStamp = stamp;
      const epoch = Number(stamp) * 1000;
      const serverNow = stamp && Number.isFinite(epoch) ? epoch : Date.now();
      serverClockOffset = Math.max(serverNow, serverClockOffset + performance.now()) - performance.now();
    }
    const timing = calculateProductionTiming({
      now: serverClockOffset + performance.now(), cutoffHour: Number(this.dataset.cutoffHour ?? 17),
      leadBusinessDays: Number(this.dataset.productionDays ?? 1),
      productionBlackoutDates: (this.dataset.productionBlackout || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean),
    });
    const windowDays = Number(this.dataset.windowDays || 60);
    const validTiming = timing.ok && Number.isInteger(windowDays) && windowDays >= 8 && windowDays <= 180;
    state.dispatchDate = validTiming ? timing.dispatchDate : '';
    const result = this.#postal && validTiming ? calculateDeliveryEstimate({
      zip: state.zip, zipStates: this.#postal.states, dispatchDate: timing.dispatchDate,
      transitBlackoutDates: this.dataset.transitBlackout || '',
    }) : null;
    // A loading sibling must not erase a result already computed by the other cart view.
    if (this.#postal || this.#lookupFailed || !validTiming) state.estimate = result;
    this.#timingValid = Boolean(validTiming && state.estimate?.ok);
    if (validTiming) {
      this.latest = parseISO(timing.localDate);
      this.latest.setDate(this.latest.getDate() + windowDays);
      text(this.querySelector('[data-dispatch-date]'), this.#format(parseISO(timing.dispatchDate)));
    }
    hidden(this.querySelector('[data-dispatch-row]'), !validTiming);
    this.earliest = parseISO(state.estimate?.arrivalTo) ?? new Date(this.latest.getFullYear() + 1, 0, 1);
    this.#disabledWeekdays = parseWeekdays(this.dataset.disabledWeekdays);
    this.#disabledWeekdays.add(0); this.#disabledWeekdays.add(6);
    this.#blackout = new Set([...parseBlackout(this.dataset.blackout), ...parseBlackout(this.dataset.transitBlackout)]);
    if (this.lookupReady && state.selected && !this.#isAllowed(parseISO(state.selected) ?? new Date(0))) {
      state.selected = ''; state.draft = false; this.#pending = null;
    }
  }

  deliveryAttributes() {
    const name = this.dataset.attribute || 'Requested delivery date';
    const estimate = state.estimate?.ok ? state.estimate : null;
    const selected = state.mode === 'requested' ? parseISO(state.selected) : null;
    return {
      'Ship-to ZIP': normalizeDeliveryZip(state.zip),
      'Delivery preference': state.mode === 'requested' ? 'Requested delivery date' : 'As soon as possible',
      _delivery_mode: state.mode,
      _delivery_estimate_origin: '11101',
      _delivery_estimate_state: estimate?.state || '',
      _delivery_estimate_from: estimate?.arrivalFrom || '',
      _delivery_estimate_to: estimate?.arrivalTo || '',
      _delivery_estimate_dispatch: estimate ? state.dispatchDate : '',
      _delivery_estimate_basis: estimate ? DELIVERY_ESTIMATE_BASIS : '',
      _delivery_date: selected ? toISO(selected) : '',
      _delivery_date_type: selected ? 'requested' : '',
      [name]: selected ? this.#format(selected) : '',
      ...(name !== 'Delivery date' ? { 'Delivery date': '' } : {}),
    };
  }

  paint() {
    if (!state) return;
    const estimate = state.estimate?.ok ? state.estimate : null;
    const requested = state.mode === 'requested';
    const hasRequest = requested && Boolean(state.selected);
    const attributes = this.deliveryAttributes();
    const requestSaved = hasRequest && this.#timingValid && !state.saving && !state.failed &&
      !state.draft && state.savedSignature === JSON.stringify(attributes);
    data(this, 'zip', state.zip); data(this, 'mode', state.mode); data(this, 'selected', state.selected);
    if (this.zipInput && document.activeElement !== this.zipInput && this.zipInput.value !== state.zip) this.zipInput.value = state.zip;
    const status = this.querySelector('[data-estimate-status]');
    let message = '';
    if (state.zip && !normalizeDeliveryZip(state.zip)) message = 'Enter a five-digit ZIP code.';
    else if (state.zip && this.#lookupLoading && !estimate) message = 'Checking your ZIP code…';
    else if (state.zip && !estimate) message = 'Delivery options for this destination will be shown at checkout.';
    if (state.failed) message = state.lineClearRequired && state.mode === 'asap' ? 'We couldn’t clear your delivery request. Choose Ship as soon as possible to retry.' : state.mode === 'requested' ? 'We couldn’t save your request. Try again or choose As soon as possible.' : 'We couldn’t save this estimate. You can still continue to checkout.';
    text(status, message); hidden(status, !message);
    if (this.zipInput) this.zipInput.setAttribute('aria-invalid', String(Boolean(state.zip && !normalizeDeliveryZip(state.zip))));
    hidden(this.querySelector('[data-estimate-result]'), !estimate || hasRequest);
    if (estimate) {
      text(this.querySelector('[data-estimate-range]'), this.#formatRange(parseISO(estimate.arrivalFrom), parseISO(estimate.arrivalTo)));
      text(this.querySelector('[data-estimate-destination]'), `To ${estimate.zip}`);
    }
    text(this.querySelector('[data-delivery-mode-label]'), requested ? (state.selected ? 'Requested delivery date' : 'Choose a later date') : 'As soon as possible');
    hidden(this.querySelector('[data-delivery-mode-label]'), hasRequest);
    text(this.querySelector('.ui-cart-estimate__label'), requested ? 'Soonest estimated arrival' : 'Estimated arrival');
    hidden(this.querySelector('[data-delivery-asap]'), !requested && !state.lineClearRequired);
    const summary = this.querySelector('[data-request-summary]');
    hidden(summary, !hasRequest);
    if (summary) summary.dataset.requestState = requestSaved ? 'saved' : 'pending';
    text(this.querySelector('[data-request-label]'), state.draft ? 'Previous requested date' : 'Requested delivery date');
    text(this.querySelector('[data-request-status]'), state.draft ? 'Save your new date below to update this request.' :
      state.failed ? 'Request not saved. Please try again below.' :
      requestSaved ? `Request saved for delivery to ${state.zip}.` :
      state.saving ? 'Saving your request…' : 'Checking your saved request…');
    hidden(this.pill, !hasRequest);
    if (state.selected) text(this.pill, this.#format(parseISO(state.selected)));
    if (this.toggleButton) {
      const unavailable = !estimate || !this.picker;
      if (this.toggleButton.disabled !== unavailable) this.toggleButton.disabled = unavailable;
      text(this.toggleButton, requested ? (state.selected ? 'Change requested date' : 'Choose a date below') : 'Choose a later delivery date');
    }
    hidden(this.error, !(requested && state.failed));
    if (requested && state.failed) text(this.error, 'Your request was not saved. Try again or choose As soon as possible.');
    if (!requested) this.#calendarOpen = false;
    const showCalendar = Boolean(requested && estimate &&
      (this.#calendarOpen || !state.selected || state.draft || state.failed));
    hidden(this.picker, !showCalendar);
    this.toggleButton?.setAttribute('aria-expanded', String(showCalendar));
    if (showCalendar) {
      this.#prepareCalendar();
      if (!this.weekdays?.childElementCount) this.#renderWeekdays();
      this.#renderMonth();
    } else {
      this.#calendarInitialized = false;
    }
    for (const input of document.querySelectorAll('[data-delivery-attribute]')) {
      const value = attributes[input.dataset.deliveryAttribute];
      if (value != null && input.value !== value) input.value = value;
    }
    this.#setGate(state.asapClearing || state.lineClearRequired || (requested && (!state.selected || !this.#timingValid || state.saving || state.failed || state.draft || state.savedSignature !== JSON.stringify(attributes))));
  }

  #setGate(gated) {
    for (const button of document.querySelectorAll('[name="checkout"][data-delivery-date-gate]')) {
      if (button.disabled !== gated) button.disabled = gated;
      if (gated) button.setAttribute('aria-disabled', 'true'); else button.removeAttribute('aria-disabled');
    }
    for (const hint of document.querySelectorAll('[data-delivery-date-hint]')) hidden(hint, !gated);
    for (const wallet of document.querySelectorAll('[data-delivery-accelerated]')) hidden(wallet, gated || state.failed || state.saving);
    for (const hint of document.querySelectorAll('[data-delivery-date-hint]')) text(hint, state.asapClearing ? 'Saving your delivery preference…' : 'Save your requested date or choose As soon as possible.');
  }

  async #confirm() {
    this.refresh();
    const pending = this.#pending;
    if (!pending || !this.#isAllowed(pending)) { this.#showError(true); return; }
    this.#calendarOpen = true;
    state.selected = toISO(pending); state.mode = 'requested'; state.draft = false;
    refreshAll();
    const saved = await queueSave(this);
    this.refresh();
    // A save response must not replace a newer day chosen while it was in flight.
    if (saved && !state.draft && this.#pending && sameDay(this.#pending, pending) &&
      state.selected === toISO(pending) && this.#isAllowed(pending)) {
      for (const field of fields) { field.#chosen = pending; field.#pending = pending; field.#setOpen(false); }
    } else if (!state.selected) {
      queueSave(this);
    }
    refreshAll();
  }
  /**
   * The first allowed request date determines the month the calendar opens on.
   * It is not automatically selected or highlighted.
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

    const focusedDay = grid.contains(document.activeElement) ? document.activeElement.dataset.dateDay : '';
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

      if (this.#pending && sameDay(date, this.#pending)) button.setAttribute('aria-selected', 'true');

      cells.push(button);
    }

    grid.replaceChildren(...cells);
    if (focusedDay) grid.querySelector(`[data-date-day="${focusedDay}"]:not(:disabled)`)?.focus({ preventScroll: true });

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

  #formatRange(from, to) {
    const format = new Intl.DateTimeFormat(this.locale, { month: 'short', day: 'numeric', ...(from.getFullYear() !== to.getFullYear() ? { year: 'numeric' } : {}) });
    return format.formatRange ? format.formatRange(from, to) : `${format.format(from)} – ${format.format(to)}`;
  }

  /** @param {boolean} show */
  #showError(show) {
    const error = this.error;
    if (error instanceof HTMLElement) error.hidden = !show;
  }

}

if (!customElements.get('cart-delivery-date')) customElements.define('cart-delivery-date', CartDeliveryDate);

function guarded(origin) {
  const field = (origin.closest('cart-items-component') ?? document).querySelector('cart-delivery-date') ?? fields.values().next().value;
  if (!field || !field.required || field.hasDate) return false;
  refreshAll(); field.prompt(); return true;
}
document.addEventListener('submit', event => {
  if (!(event.target instanceof HTMLFormElement) || !event.target.classList.contains('cart-form')) return;
  if (event.submitter?.getAttribute('name') === 'checkout' && guarded(event.submitter)) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);
document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('[name="checkout"]') : null;
  if (target && guarded(target)) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);

function scheduleRepaint() {
  if (repaintQueued) return;
  repaintQueued = true;
  queueMicrotask(() => { repaintQueued = false; refreshAll(); });
}
document.addEventListener('cart:update', event => {
  if (event.detail?.sourceId !== SYNC_SOURCE && event.detail?.data?.source !== SYNC_SOURCE) {
    cartRevision++;
    if (state) state.savedSignature = '';
    refreshAll(true);
  }
  scheduleRepaint();
});
// Horizon morphs vanilla custom elements without reconnecting them. Detect
// Replaced controls and server datasets can arrive without a cart:update event.
// Repair hidden/emptied calendars too, while ignoring our completed cell paints.
new MutationObserver(records => {
  const controls = 'cart-delivery-date,.ui-cart-shipping,.ui-date-picker,[data-delivery-zip],[data-delivery-attribute],[name="checkout"]';
  if (records.some(record => record.type === 'attributes'
    ? record.attributeName === 'hidden'
      ? record.target.matches?.('.ui-date-picker')
      : record.target.matches?.(controls)
    : (record.target.matches?.('[data-date-grid],[data-date-weekdays]') && record.target.childElementCount === 0) ||
      [...record.addedNodes].some(node => node instanceof Element && (node.matches(controls) || node.querySelector(controls))))) scheduleRepaint();
}).observe(document.documentElement, {
  childList: true, subtree: true, attributes: true,
  attributeFilter: ['data-server-now', 'data-zip', 'data-mode', 'data-selected', 'data-production-days', 'data-cutoff-hour', 'data-production-blackout', 'data-transit-blackout', 'data-window-days', 'data-blackout', 'data-disabled-weekdays', 'value', 'disabled', 'hidden'],
});
