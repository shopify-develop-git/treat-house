/**
 * Fills a product row with what this visitor has already looked at.
 *
 * Shopify has no object for that — it is per-visitor and per-device, so it lives in
 * localStorage and nowhere on the server. The element does two jobs: it writes the
 * product being looked at into that list, and it asks the Search API for cards for
 * the ones already in it.
 *
 * The cards are the section's own. `/search?q=id:… &section_id=` renders this very
 * section a second time with `search.results` in hand, so the markup, the badges and
 * the add-to-cart button come from the same Liquid as every other row on the site
 * rather than from a template written out in JavaScript. That is the same bargain
 * Horizon's `product-recommendations` strikes, over a different endpoint.
 *
 * Search answers in its own relevance order, which for a list of ids is close to
 * arbitrary, so the cards are put back into the order they were seen. Without that
 * the row is products you have looked at, not products you have recently looked at.
 *
 * There is no IntersectionObserver here on purpose. A visitor with no history has
 * the element hidden, and a hidden element never intersects, so waiting for it to
 * scroll into view would mean the first-ever page view never records anything.
 */

const STORE_KEY = 'treat-house:recently-viewed';

/** How many ids are kept. More than any row shows, so a row can skip the current one. */
const HISTORY_LIMIT = 24;

/**
 * @returns {string[]} Product ids, most recently seen first.
 */
function readHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string' && id.length > 0) : [];
  } catch {
    // Corrupt entry, or storage the browser refuses to read. Start over.
    return [];
  }
}

/**
 * @param {string} id
 */
function remember(id) {
  try {
    const ids = [id, ...readHistory().filter((seen) => seen !== id)];
    localStorage.setItem(STORE_KEY, JSON.stringify(ids.slice(0, HISTORY_LIMIT)));
  } catch {
    // Private browsing refuses the write. The row stays empty, which is correct.
  }
}

class UIRecentlyViewed extends HTMLElement {
  /** @type {AbortController | null} */
  #fetching = null;

  connectedCallback() {
    const current = this.dataset.productId ?? '';

    // The row is what was seen *before* this page, so the current product is taken
    // out before it is put in — otherwise every product page recommends itself.
    const seen = readHistory().filter((id) => id !== current);
    if (current) remember(current);

    const limit = Number(this.dataset.limit) || 5;
    const wanted = seen.slice(0, limit);

    if (wanted.length === 0) return;

    this.#fill(wanted);
  }

  disconnectedCallback() {
    this.#fetching?.abort();
    this.#fetching = null;
  }

  /**
   * @param {string[]} ids
   */
  async #fill(ids) {
    const url = new URL(this.dataset.url || '/search', window.location.origin);
    url.searchParams.set('q', ids.map((id) => `id:${id}`).join(' OR '));
    url.searchParams.set('type', 'product');
    url.searchParams.set('section_id', this.dataset.sectionId ?? '');

    this.#fetching?.abort();
    this.#fetching = new AbortController();

    let markup;
    try {
      const response = await fetch(url, { signal: this.#fetching.signal });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      markup = await response.text();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Recently viewed:', error instanceof Error ? error.message : error);
      return;
    } finally {
      this.#fetching = null;
    }

    const parsed = document.createElement('div');
    parsed.innerHTML = markup;

    const fresh = parsed.querySelector(`ui-recently-viewed[id="${this.id}"]`);
    if (!fresh?.querySelector('[data-product-id]')) return;

    this.innerHTML = fresh.innerHTML;
    this.#reorder(ids);
    this.hidden = false;
  }

  /**
   * Puts the cards back into the order the ids were seen in.
   * @param {string[]} ids
   */
  #reorder(ids) {
    const track = this.querySelector('[data-carousel-track]');
    if (!track) return;

    // Back to front, prepending each: the first id ends up prepended last, and so
    // first in the row.
    for (const id of [...ids].reverse()) {
      const item = track.querySelector(`[data-product-id="${id}"]`);
      if (item) track.prepend(item);
    }
  }
}

if (!customElements.get('ui-recently-viewed')) {
  customElements.define('ui-recently-viewed', UIRecentlyViewed);
}
