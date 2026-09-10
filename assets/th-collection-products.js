/**
 * Progressively reveals the products already rendered in this collection batch.
 * Without JavaScript every card stays visible and native pagination still works.
 */
if (!customElements.get('th-collection-products')) {
  class THCollectionProducts extends HTMLElement {
    #initialized = false;
    #cards = [];
    #matching = [];
    #pageSize = 24;
    #visibleCount = 0;
    #more;
    #progress;
    #filters;
    #pack;
    #price;

    connectedCallback() {
      if (this.#initialized) return;

      // These draft-era metafields contain test values or incomplete booleans.
      // Recover old bookmarked/applied facet URLs before using their partial set.
      const currentUrl = new URL(window.location.href);
      let obsoleteFilter = false;
      for (const key of ['gift_ready', 'custom_image', 'delivery_timing', 'pack_size', 'recipient', 'occasion']) {
        const name = `filter.p.m.custom.${key}`;
        if (currentUrl.searchParams.has(name)) {
          currentUrl.searchParams.delete(name);
          obsoleteFilter = true;
        }
      }
      for (const name of ['filter.v.price.gte', 'filter.v.price.lte']) {
        if (currentUrl.searchParams.has(name)) {
          currentUrl.searchParams.delete(name);
          obsoleteFilter = true;
        }
      }
      if (obsoleteFilter) {
        currentUrl.searchParams.delete('page');
        window.location.replace(currentUrl.href);
        this.#initialized = true;
        return;
      }

      // The server supplies this only for an out-of-range native page. Recover
      // before looking for a grid, since that empty page may not contain one.
      if (this.dataset.firstPageUrl) {
        try {
          const firstPage = new URL(this.dataset.firstPageUrl, window.location.href);
          if (firstPage.origin === window.location.origin && firstPage.href !== window.location.href) {
            window.location.replace(firstPage.href);
            this.#initialized = true;
            return;
          }
        } catch {
          // Keep the server's first-page link and available products usable.
        }
      }

      const grid = this.querySelector('[data-collection-grid]');
      const button = this.querySelector('[data-collection-more-button]');
      this.#more = this.querySelector('[data-collection-more]');
      this.#progress = this.querySelector('[data-collection-progress]');
      // Incomplete markup must retain access to all server-rendered products.
      if (!grid || !button || !this.#more || !this.#progress) return;

      const requestedSize = Number(this.dataset.pageSize);
      if (Number.isSafeInteger(requestedSize) && requestedSize > 0) {
        this.#pageSize = requestedSize;
      }
      this.#cards = Array.from(grid.children).filter(card => card.matches('li[data-product-id]'));
      this.#matching = this.#cards;
      this.#initialized = true;
      button.addEventListener('click', this.#showMore);
      this.#filters = this.querySelector('[data-collection-filters]');
      this.#pack = this.querySelector('[data-collection-pack]');
      this.#price = this.querySelector('[data-collection-price]');
      if (this.#filters) {
        this.#filters.hidden = false;
        this.#filters.addEventListener('change', this.#filterChanged);
        this.querySelector('[data-collection-filter-clear]')?.addEventListener('click', this.#clearFilters);
        window.addEventListener('popstate', this.#restoreFilters);
        this.#restoreFilters();
      } else {
        this.#visibleCount = Math.min(this.#pageSize, this.#cards.length);
        this.#render();
      }
    }

    disconnectedCallback() {
      window.removeEventListener('popstate', this.#restoreFilters);
    }

    #restoreFilters = () => {
      const params = new URL(window.location.href).searchParams;
      for (const [select, key] of [[this.#pack, 'th_pack'], [this.#price, 'th_price']]) {
        if (!select) continue;
        const requested = params.get(key);
        select.value = [...select.options].some(option => option.value === requested) ? requested : select.options[0].value;
        // The shared select component mirrors programmatic changes as well as taps.
        select.dispatchEvent(new Event('change'));
      }
      this.#applyFilters(false);
    };

    #filterChanged = () => this.#applyFilters(true);

    #clearFilters = () => {
      for (const select of [this.#pack, this.#price]) {
        if (!select) continue;
        select.selectedIndex = 0;
        select.dispatchEvent(new Event('change'));
      }
      this.#applyFilters(true);
    };

    #applyFilters(updateHistory) {
      const pack = this.#pack?.value.match(/^(6|12|24|36)-pack$/)?.[1] || '';
      const bands = { 'Under $25': [0, 2500], '$25 to $50': [2500, 5000], '$50 to $100': [5000, 10000], '$100 and up': [10000, Infinity] };
      const band = bands[this.#price?.value];
      this.#matching = this.#cards.filter(card => {
        const price = Number(card.dataset.productPrice);
        return (!pack || card.dataset.productPack === pack) &&
          (!band || (Number.isFinite(price) && price >= band[0] && price < band[1]));
      });
      this.#visibleCount = Math.min(this.#pageSize, this.#matching.length);
      const url = new URL(window.location.href);
      for (const [key, value] of [['th_pack', pack ? `${pack}-pack` : ''], ['th_price', band ? this.#price.value : '']]) {
        if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
      }
      if (updateHistory) window.history.pushState({}, '', url);
      // Native Shopify sorting supplies the order; retain these local filters
      // when that sorted page is loaded rather than silently resetting them.
      for (const link of this.querySelectorAll('.collection-products__sort a[href]')) {
        const target = new URL(link.href, url);
        for (const key of ['th_pack', 'th_price']) {
          if (url.searchParams.has(key)) target.searchParams.set(key, url.searchParams.get(key));
          else target.searchParams.delete(key);
        }
        link.href = target.href;
      }
      const clear = this.querySelector('[data-collection-filter-clear]');
      if (clear) clear.hidden = !pack && !band;
      this.#render();
    }

    #showMore = event => {
      event.preventDefault();
      if (this.#visibleCount >= this.#matching.length) return;

      const firstNewCard = this.#matching[this.#visibleCount];
      this.#visibleCount = Math.min(this.#visibleCount + this.#pageSize, this.#matching.length);
      this.#render();
      firstNewCard.querySelector('a[href]')?.focus();
    };

    #render() {
      const visible = new Set(this.#matching.slice(0, this.#visibleCount));
      this.#cards.forEach(card => {
        card.hidden = !visible.has(card);
      });
      this.#progress.textContent = `Showing ${this.#visibleCount} of ${this.#matching.length} products`;
      this.#progress.hidden = this.#matching.length <= this.#pageSize;
      this.#more.hidden = this.#visibleCount >= this.#matching.length;
      if (this.#filters) {
        const count = this.querySelector('[data-collection-count]');
        if (count) count.textContent = `${this.#matching.length} ${this.#matching.length === 1 ? 'product' : 'products'}`;
        const empty = this.querySelector('[data-collection-filter-empty]');
        if (empty) empty.hidden = this.#matching.length !== 0;
      }
    }
  }

  customElements.define('th-collection-products', THCollectionProducts);
}
