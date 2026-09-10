/**
 * Keeps the initial native page small, then enhances larger collections from a
 * layout-free section response. Without JavaScript or on request failure, the
 * server's honest page count, cards and native pagination remain available.
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
    #hydrationStarted = false;
    #request;
    #initialReveal = 0;

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

      if (this.dataset.hydrateSection) {
        this.#initialized = true;
        this.dataset.hydrationState = 'loading';
        if (document.readyState === 'complete') this.#hydrate();
        else window.addEventListener('load', this.#hydrate, { once: true });
        return;
      }
      if (this.dataset.nativePartial === 'true') {
        // The theme editor deliberately keeps its native page. Partial data
        // must never acquire full-catalog filter/count behavior.
        this.#initialized = true;
        this.dataset.hydrationState = 'fallback';
        return;
      }
      this.#initializeProducts();
    }

    #initializeProducts() {
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
        this.#visibleCount = Math.min(Math.max(this.#pageSize, this.#initialReveal), this.#cards.length);
        this.#initialReveal = 0;
        this.#render();
      }
      if (this.dataset.hydrationState !== 'complete') this.dataset.hydrationState = 'ready';
    }

    disconnectedCallback() {
      window.removeEventListener('popstate', this.#restoreFilters);
      window.removeEventListener('load', this.#hydrate);
      this.#request?.abort();
    }

    #requestKey(href) {
      const url = new URL(href);
      url.hash = '';
      // A back/forward local-filter change can be applied to the same batch.
      url.searchParams.delete('th_pack');
      url.searchParams.delete('th_price');
      url.searchParams.sort();
      return url.href;
    }

    #hydrate = async () => {
      if (this.#hydrationStarted || !this.isConnected) return;
      this.#hydrationStarted = true;
      const originalUrl = new URL(window.location.href);
      const requestKey = this.#requestKey(originalUrl.href);
      const url = new URL(originalUrl);
      url.searchParams.set('section_id', this.dataset.hydrateSection);
      for (const key of ['sections', 'page', 'th_pack', 'th_price']) url.searchParams.delete(key);
      const status = this.querySelector('[data-collection-load-status]');
      if (status) {
        status.textContent = 'Loading more treats and filters…';
        status.hidden = false;
      }
      this.#request = new AbortController();
      const timeout = setTimeout(() => this.#request?.abort(), 12000);
      try {
        const response = await fetch(url.href, { credentials: 'same-origin', signal: this.#request.signal });
        if (!response.ok) throw new Error('Catalog request failed');
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('template[data-collection-batch]');
        const grid = this.querySelector('[data-collection-grid]');
        if (!template || !grid || template.dataset.complete !== 'true' ||
            template.dataset.collectionHandle !== this.dataset.collectionHandle) {
          throw new Error('Catalog batch incomplete');
        }
        const batchGrid = template.content.querySelector('[data-collection-grid]');
        const cards = batchGrid ? [...batchGrid.children].filter(card => card.matches('li[data-product-id]')) : [];
        const count = Number(template.dataset.count);
        if (!batchGrid || !Number.isSafeInteger(count) || count < 0 || count !== cards.length ||
            new Set(cards.map(card => card.dataset.productId)).size !== count) {
          throw new Error('Catalog count mismatch');
        }
        const metadata = JSON.parse(template.content.querySelector('[data-collection-product-metadata]')?.textContent || '[]');
        if (!Array.isArray(metadata) || metadata.length !== count ||
            !cards.every(card => metadata.some(product => String(product.id) === card.dataset.productId && Array.isArray(product.variants)))) {
          throw new Error('Catalog metadata incomplete');
        }
        if (!this.isConnected || this.#requestKey(window.location.href) !== requestKey) {
          this.dataset.hydrationState = 'stale';
          if (status) status.hidden = true;
          return;
        }

        // Keep the original native page's products exposed when following an
        // older page= link. Do not collapse the shopper back to the first batch.
        const originalIds = new Set([...grid.children].map(card => card.dataset.productId));
        if (Number(this.dataset.nativePage) > 1) {
          this.#initialReveal = cards.reduce((last, card, index) => originalIds.has(card.dataset.productId) ? index + 1 : last, 0);
        }
        const nativeProducts = window.ShopifyAnalytics?.meta?.products;
        if (Array.isArray(nativeProducts)) {
          for (const product of metadata) {
            if (!nativeProducts.some(entry => String(entry.id) === String(product.id))) nativeProducts.push(product);
          }
        }
        // Scripts parsed in the response are data only. Existing theme modules
        // upgrade the new custom elements; native page/pixel scripts never replay.
        template.content.querySelectorAll('script').forEach(script => script.remove());
        grid.replaceChildren(...cards);
        grid.hidden = count === 0;
        const filterSlot = this.querySelector('[data-collection-filter-slot]');
        if (filterSlot) {
          const filters = template.content.querySelector('[data-collection-filters]');
          filterSlot.replaceChildren(...(filters ? [filters] : []));
        }
        this.querySelector('[data-collection-fallback-empty]')?.remove();
        this.querySelector('.collection-products__pagination')?.remove();
        const counter = this.querySelector('[data-collection-count]');
        if (counter) counter.textContent = `${count} ${count === 1 ? 'product' : 'products'}`;
        if (status) status.hidden = true;
        this.dataset.hydrationState = 'complete';
        this.#initializeProducts();
        if (!count) {
          const empty = this.querySelector('[data-collection-filter-empty]');
          if (empty) empty.hidden = false;
        }
      } catch {
        this.dataset.hydrationState = 'failed';
        if (status) {
          status.textContent = 'More filters could not load. Use the page links below to keep browsing.';
          status.hidden = false;
        }
      } finally {
        clearTimeout(timeout);
        this.#request = null;
      }
    };

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
      this.#visibleCount = Math.min(Math.max(this.#pageSize, !pack && !band ? this.#initialReveal : 0), this.#matching.length);
      this.#initialReveal = 0;
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
