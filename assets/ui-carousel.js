/**
 * Steps a scroll-snap track by one item and disables its buttons at the ends.
 *
 * The scrolling itself is the browser's: the track is a flex row with
 * scroll-snap, so it swipes, keyboard-scrolls and snaps with no script at all.
 * This only adds what CSS cannot do — moving the track from a button, and knowing
 * when there is nothing left to move to.
 *
 * Above the breakpoint where the track becomes a grid there is nothing to scroll,
 * the buttons are hidden, and the element does nothing.
 *
 * It opens on the second item rather than the first. The file draws the row already
 * moved along, with a card either side of the middle one, which is what says the row
 * scrolls — a first card flush to the left edge reads as a row that simply ran out of
 * space. `data-carousel-start` moves that, and 1 leaves it at the beginning.
 *
 * Dependency-free, like the rest of the kit's scripts.
 *
 * <ui-carousel>
 *   <ul data-carousel-track>…</ul>
 *   <button data-carousel-prev></button>
 *   <button data-carousel-next></button>
 * </ui-carousel>
 */
class UICarousel extends HTMLElement {
  #track = null;
  #prev = null;
  #next = null;
  #observer = null;
  #frame = null;

  static #duration = 360;

  connectedCallback() {
    this.#track = this.querySelector('[data-carousel-track]');
    this.#prev = this.querySelector('[data-carousel-prev]');
    this.#next = this.querySelector('[data-carousel-next]');
    if (!this.#track) return;

    this.#prev?.addEventListener('click', () => this.#step(-1));
    this.#next?.addEventListener('click', () => this.#step(1));
    this.#track.addEventListener('scroll', this.#sync, { passive: true });

    // The track turns into a grid at the breakpoint, so its scrollable width
    // changes without anything scrolling.
    this.#observer = new ResizeObserver(this.#sync);
    this.#observer.observe(this.#track);

    this.#sync();
    this.#openOnStartItem();
  }

  /** Jumps, never animates: this runs at load, where a slide-in is noise. */
  #openOnStartItem() {
    const track = this.#track;
    if (track.scrollWidth <= track.clientWidth) return;

    const index = Number(this.dataset.carouselStart || 2) - 1;
    if (index <= 0 || !track.children[index]) return;

    // Item 0 sits centred at rest, so each step along centres the next one.
    track.scrollLeft = index * this.#stepSize();
    this.#sync();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#track?.removeEventListener('scroll', this.#sync);
    this.#cancel();
  }

  /** One item plus the gap after it. */
  #stepSize() {
    const item = this.#track.firstElementChild;
    if (!item) return this.#track.clientWidth;
    const gap = parseFloat(getComputedStyle(this.#track).columnGap) || 0;
    return item.getBoundingClientRect().width + gap;
  }

  /**
   * Animates the step itself rather than asking for `behavior: 'smooth'`.
   *
   * Two reasons. The platform's smooth scroll is not dependable — it is a no-op in
   * some automation builds, which also makes it untestable — and a snapping track
   * re-targets it at the point it started from, so the track never moves. Driving
   * scrollLeft frame by frame sidesteps both, at the cost of turning snapping off
   * for the length of the animation, since mandatory snapping would fight every
   * frame.
   */
  #step(direction) {
    const track = this.#track;
    const from = track.scrollLeft;
    const limit = track.scrollWidth - track.clientWidth;
    const to = Math.max(0, Math.min(from + direction * this.#stepSize(), limit));
    if (Math.round(to) === Math.round(from)) return;

    this.#cancel();

    // Nothing to animate with when the tab is hidden — frames stop coming, and an
    // animation started there would strand the track mid-step with snapping off.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden;
    if (still) {
      track.scrollLeft = to;
      this.#sync();
      return;
    }

    track.style.scrollSnapType = 'none';
    const started = performance.now();
    const easeOut = (t) => 1 - (1 - t) ** 3;

    const frame = (now) => {
      const progress = Math.min((now - started) / UICarousel.#duration, 1);
      track.scrollLeft = from + (to - from) * easeOut(progress);

      if (progress < 1) {
        this.#frame = requestAnimationFrame(frame);
        return;
      }
      this.#frame = null;
      track.style.scrollSnapType = '';
    };

    this.#frame = requestAnimationFrame(frame);
  }

  #cancel() {
    if (!this.#frame) return;
    cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.#track.style.scrollSnapType = '';
  }

  #sync = () => {
    // scrollLeft runs negative in a right-to-left track, so compare on distance.
    const travelled = Math.abs(this.#track.scrollLeft);
    const total = this.#track.scrollWidth - this.#track.clientWidth;
    if (this.#prev) this.#prev.disabled = travelled <= 1;
    if (this.#next) this.#next.disabled = travelled >= total - 1;
  };
}

if (!customElements.get('ui-carousel')) {
  customElements.define('ui-carousel', UICarousel);
}
