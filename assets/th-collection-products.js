/**
 * Progressively reveals the products already rendered in this collection batch.
 * Without JavaScript every card stays visible and native pagination still works.
 */
if (!customElements.get('th-collection-products')) {
  class THCollectionProducts extends HTMLElement {
    #initialized = false;
    #cards = [];
    #pageSize = 24;
    #visibleCount = 0;
    #more;
    #progress;

    connectedCallback() {
      if (this.#initialized) return;

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
      this.#visibleCount = Math.min(this.#pageSize, this.#cards.length);
      this.#initialized = true;
      button.addEventListener('click', this.#showMore);
      this.#render();
    }

    #showMore = event => {
      event.preventDefault();
      if (this.#visibleCount >= this.#cards.length) return;

      const firstNewCard = this.#cards[this.#visibleCount];
      this.#visibleCount = Math.min(this.#visibleCount + this.#pageSize, this.#cards.length);
      this.#render();
      firstNewCard.querySelector('a[href]')?.focus();
    };

    #render() {
      this.#cards.forEach((card, index) => {
        card.hidden = index >= this.#visibleCount;
      });
      this.#progress.textContent = `Showing ${this.#visibleCount} of ${this.#cards.length} products`;
      this.#progress.hidden = this.#cards.length <= this.#pageSize;
      this.#more.hidden = this.#visibleCount >= this.#cards.length;
    }
  }

  customElements.define('th-collection-products', THCollectionProducts);
}
