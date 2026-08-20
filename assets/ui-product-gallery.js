/**
 * Switching for the UI kit's product gallery.
 *
 * Every photograph is already in the page, so this only moves attributes around —
 * there is no URL to build here and no request to make, which is why a variant
 * change can reveal its featured media without this file knowing anything about
 * image sizing.
 *
 * Switching is a crossfade. `hidden` stays the resting state between turns, so a
 * product's other photographs are not fetched before anyone asks for them, and the
 * fade happens in the moment when both the outgoing and the incoming slide are out
 * of it. The timing is not written here: it is read back off the slide, so the wait
 * before the outgoing one is hidden cannot drift from the time it takes to
 * disappear — and `prefers-reduced-motion` comes free with it, since a slide with
 * no transition reports no duration and the swap lands at once.
 *
 * It also listens for the theme's `variant:update`, the event Horizon's variant
 * picker fires once it has fetched the new variant. Listening on the section rather
 * than on the document keeps a second gallery elsewhere on the page — a quick-add
 * dialog, say — out of this one's business.
 */
const VARIANT_UPDATE = 'variant:update';
const FADING = 'data-ui-gallery-fading';

class UiProductGallery extends HTMLElement {
  /** @type {Element | null} */
  #active = null;

  /** @type {number | undefined} */
  #timer;

  connectedCallback() {
    this.addEventListener('click', this.#onClick);

    this.section = this.closest('.shopify-section') ?? document;
    this.section.addEventListener(VARIANT_UPDATE, this.#onVariantUpdate);

    this.#active = this.querySelector('[data-ui-gallery-media]:not([hidden])');
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    this.section?.removeEventListener(VARIANT_UPDATE, this.#onVariantUpdate);
    clearTimeout(this.#timer);
  }

  get #slides() {
    return Array.from(this.querySelectorAll('[data-ui-gallery-media]'));
  }

  #onClick = (event) => {
    const thumb = event.target.closest('[data-ui-gallery-thumb]');
    if (thumb && this.contains(thumb)) {
      this.select(thumb.dataset.uiGalleryThumb);
      return;
    }

    const arrow = event.target.closest('[data-ui-gallery-step]');
    if (arrow && this.contains(arrow)) this.step(Number(arrow.dataset.uiGalleryStep));
  };

  #onVariantUpdate = (event) => {
    const mediaId = event.detail?.resource?.featured_media?.id;
    if (mediaId == null) return;

    this.select(String(mediaId));
  };

  /**
   * Moves one photograph along, wrapping at the ends.
   *
   * Wrapping rather than disabling: most products here carry three or four
   * photographs, and an arrow that greys itself out at the ends is a dead control
   * half the time you reach for it.
   *
   * @param {number} delta
   */
  step(delta) {
    const slides = this.#slides;
    if (slides.length < 2) return;

    const from = slides.indexOf(this.#active);
    const next = slides[(from + delta + slides.length) % slides.length];
    if (next) this.select(next.dataset.uiGalleryMedia);
  }

  /**
   * Crossfades to the slide for a media id, and marks its thumbnail.
   * @param {string} mediaId
   */
  select(mediaId) {
    const next = this.querySelector(`[data-ui-gallery-media="${mediaId}"]`);
    // A variant can point at media this gallery is not showing. Leaving the
    // current photograph up beats blanking the frame.
    if (!next) return;

    this.#markThumbs(mediaId);
    if (next === this.#active) return;

    const previous = this.#active;
    clearTimeout(this.#timer);

    // A slide still fading from an earlier click is dropped now, so the frame only
    // ever holds the two this crossfade is between.
    for (const slide of this.#slides) {
      if (slide === next || slide === previous) continue;
      slide.hidden = true;
      slide.removeAttribute(FADING);
    }

    next.hidden = false;
    next.setAttribute(FADING, '');
    // Read the layout back, so the browser has a zero to animate away from.
    // Without it both attribute changes land in the same frame and the fade is
    // skipped entirely.
    next.getBoundingClientRect();
    next.removeAttribute(FADING);

    this.#active = next;
    if (!previous) return;

    previous.setAttribute(FADING, '');

    const duration = parseFloat(getComputedStyle(next).transitionDuration) * 1000 || 0;
    this.#timer = setTimeout(() => {
      previous.hidden = true;
      previous.removeAttribute(FADING);
    }, duration);
  }

  /** @param {string} mediaId */
  #markThumbs(mediaId) {
    for (const thumb of this.querySelectorAll('[data-ui-gallery-thumb]')) {
      thumb.setAttribute('aria-pressed', String(thumb.dataset.uiGalleryThumb === mediaId));
    }
  }
}

if (!customElements.get('ui-product-gallery')) {
  customElements.define('ui-product-gallery', UiProductGallery);
}
