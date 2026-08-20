/**
 * Switching for the UI kit's product gallery.
 *
 * Every image is already in the page and all but one carry `hidden`, so this only
 * moves that attribute around — there is no URL to build here and no request to
 * make, which is why a variant change can reveal its featured media without this
 * file knowing anything about image sizing.
 *
 * It also listens for the theme's `variant:update`, the event Horizon's variant
 * picker fires once it has fetched the new variant. Listening on the section
 * rather than on the document keeps a second gallery elsewhere on the page — a
 * quick-add dialog, say — out of this one's business.
 */
const VARIANT_UPDATE = 'variant:update';

class UiProductGallery extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.#onClick);

    this.section = this.closest('.shopify-section') ?? document;
    this.section.addEventListener(VARIANT_UPDATE, this.#onVariantUpdate);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    this.section?.removeEventListener(VARIANT_UPDATE, this.#onVariantUpdate);
  }

  #onClick = (event) => {
    const thumb = event.target.closest('[data-ui-gallery-thumb]');
    if (!thumb || !this.contains(thumb)) return;

    this.select(thumb.dataset.uiGalleryThumb);
  };

  #onVariantUpdate = (event) => {
    const mediaId = event.detail?.resource?.featured_media?.id;
    if (mediaId == null) return;

    this.select(String(mediaId));
  };

  /**
   * Shows the slide for a media id, and marks its thumbnail.
   * @param {string} mediaId
   */
  select(mediaId) {
    const slide = this.querySelector(`[data-ui-gallery-media="${mediaId}"]`);
    // A variant can point at media this gallery is not showing. Leaving the
    // current image up beats blanking the stage.
    if (!slide) return;

    for (const candidate of this.querySelectorAll('[data-ui-gallery-media]')) {
      candidate.toggleAttribute('hidden', candidate !== slide);
    }

    for (const thumb of this.querySelectorAll('[data-ui-gallery-thumb]')) {
      thumb.setAttribute('aria-pressed', String(thumb.dataset.uiGalleryThumb === mediaId));
    }
  }
}

if (!customElements.get('ui-product-gallery')) {
  customElements.define('ui-product-gallery', UiProductGallery);
}
