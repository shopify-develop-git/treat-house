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
 * Which item it opens on comes from `--ui-carousel-start`, read off the element, so a
 * stylesheet can set it per breakpoint. The peeking arrangement wants the second: the
 * file draws that row already moved along, with a card either side of the middle one,
 * which is what says it scrolls. A row of full-width columns wants the first, since
 * there is no peeking card to reveal. `data-carousel-start` is the fallback.
 *
 * While the track has somewhere to scroll the element carries `data-scrollable`, so a
 * stylesheet can show the buttons only when they would do something.
 *
 * A `[data-carousel-dots]` container, if there is one, is filled with a button per
 * item and kept in step with the scroll. They are real buttons rather than painted
 * dots because they are the one control that says how long the row is, and a visitor
 * on a keyboard should be able to reach any of it.
 *
 * The track can also be dragged with a mouse, which a scrolling row does not do on
 * its own — a touch screen drags it already, a trackpad scrolls it sideways, and a
 * mouse has neither. Touch is left alone: the platform's own drag has momentum and
 * snapping that a script would only make worse.
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
  #dots = null;
  #buttons = [];
  #drag = null;
  #swallowClick = false;

  static #duration = 360;

  /** How far a mouse travels before it counts as a drag rather than a click. */
  static #dragThreshold = 4;

  /** Pointer speed, in px per ms, past which a release carries on one more item. */
  static #flickSpeed = 0.4;

  /** Shortest gap between two pointer samples worth reading a speed from, in ms. */
  static #minSample = 8;

  /** A pointer still for this long before release was placing the row, not throwing it. */
  static #stillFor = 100;

  connectedCallback() {
    this.#track = this.querySelector('[data-carousel-track]');
    this.#prev = this.querySelector('[data-carousel-prev]');
    this.#next = this.querySelector('[data-carousel-next]');
    if (!this.#track) return;

    this.#prev?.addEventListener('click', () => this.#step(-1));
    this.#next?.addEventListener('click', () => this.#step(1));
    this.#track.addEventListener('scroll', this.#sync, { passive: true });

    this.#dots = this.querySelector('[data-carousel-dots]');
    this.#buildDots();

    this.#track.addEventListener('pointerdown', this.#onPointerDown);
    this.#track.addEventListener('pointermove', this.#onPointerMove);
    this.#track.addEventListener('pointerup', this.#onPointerUp);
    this.#track.addEventListener('pointercancel', this.#onPointerUp);
    this.#track.addEventListener('dragstart', this.#onDragStart);

    // Capture, so a card that swallows its own clicks never sees the one that ends
    // a drag. Whatever is under the pointer when a drag stops was not chosen.
    this.#track.addEventListener('click', this.#onClick, true);

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

    const declared = getComputedStyle(this).getPropertyValue('--ui-carousel-start').trim();
    const index = Number(declared || this.dataset.carouselStart || 1) - 1;
    if (index <= 0 || !track.children[index]) return;

    // Item 0 sits centred at rest, so each step along centres the next one.
    track.scrollLeft = index * this.#stepSize();
    this.#sync();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#track?.removeEventListener('scroll', this.#sync);
    this.#track?.removeEventListener('pointerdown', this.#onPointerDown);
    this.#track?.removeEventListener('pointermove', this.#onPointerMove);
    this.#track?.removeEventListener('pointerup', this.#onPointerUp);
    this.#track?.removeEventListener('pointercancel', this.#onPointerUp);
    this.#track?.removeEventListener('dragstart', this.#onDragStart);
    this.#track?.removeEventListener('click', this.#onClick, true);
    this.#endDrag();
    this.#cancel();
  }

  #onPointerDown = (event) => {
    // Touch and pen already drag the track themselves, and better.
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (this.#track.scrollWidth <= this.#track.clientWidth) return;

    this.#cancel();
    this.#swallowClick = false;
    this.#drag = {
      id: event.pointerId,
      startX: event.clientX,
      startScroll: this.#track.scrollLeft,
      lastX: event.clientX,
      lastAt: event.timeStamp,
      speed: 0,
      moved: false,
    };
  };

  #onPointerMove = (event) => {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.id) return;

    const travelled = event.clientX - drag.startX;

    // A few pixels of slip on the way to a click is not a drag. Until the pointer
    // passes that, the track has not moved and a link underneath still works.
    if (!drag.moved) {
      if (Math.abs(travelled) < UICarousel.#dragThreshold) return;
      drag.moved = true;
      this.#track.style.scrollSnapType = 'none';
      this.toggleAttribute('data-dragging', true);

      // Capture keeps the moves coming once the pointer leaves the track, which it
      // will — the row is as wide as the window. It throws if the pointer is already
      // gone, and a drag that has started still has to finish either way.
      try {
        this.#track.setPointerCapture(drag.id);
      } catch {
        /* nothing to capture */
      }
      // The press may already have started a selection before it became a drag.
      window.getSelection()?.removeAllRanges();
    }

    // Samples taken closer together than a frame are mostly noise. The first move
    // lands a fraction of a millisecond after the press, and ten pixels over that
    // reads as a hundred a millisecond — fast enough to flick every drag there is.
    // Skipping it leaves the reference where it was, so the next sample spans both.
    const elapsed = event.timeStamp - drag.lastAt;
    if (elapsed >= UICarousel.#minSample) {
      const moved = event.clientX - drag.lastX;
      // Weighted towards the newest sample, so slowing down before release shows.
      drag.speed = drag.speed * 0.3 + (moved / elapsed) * 0.7;
      drag.lastX = event.clientX;
      drag.lastAt = event.timeStamp;
    }

    this.#track.scrollLeft = drag.startScroll - travelled;
  };

  #onPointerUp = (event) => {
    const drag = this.#drag;
    if (!drag || (event && event.pointerId !== drag.id)) return;

    const { moved } = drag;
    // Holding the row still before letting go means putting it somewhere, whatever
    // speed it was carrying on the way there.
    const paused = event ? event.timeStamp - drag.lastAt > UICarousel.#stillFor : true;
    const speed = paused ? 0 : drag.speed;

    this.#endDrag();
    if (!moved) return;

    // The click that ends a drag is a side effect of letting go, not a choice.
    this.#swallowClick = true;

    // Snapping is left off here on purpose. Restoring it would let the browser jump
    // to its own nearest point before the settle below has a say. #step turns it
    // back on however it exits.
    const step = this.#stepSize();
    const last = this.#track.children.length - 1;
    let index = step > 0 ? Math.round(this.#track.scrollLeft / step) : 0;

    // A flick carries one item further than where the pointer let go, which is what
    // makes a quick sweep move the row rather than nudge it back.
    if (Math.abs(speed) > UICarousel.#flickSpeed) index += speed < 0 ? 1 : -1;

    this.#goTo(Math.max(0, Math.min(index, last)));
  };

  #endDrag() {
    const drag = this.#drag;
    this.#drag = null;
    if (!drag) return;

    try {
      if (this.#track.hasPointerCapture?.(drag.id)) this.#track.releasePointerCapture(drag.id);
    } catch {
      /* already released */
    }
    this.removeAttribute('data-dragging');
  }

  #onDragStart = (event) => {
    // Native dragging of an image or link would take the pointer with it.
    if (this.#drag) event.preventDefault();
  };

  #onClick = (event) => {
    if (!this.#swallowClick) return;
    this.#swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  #buildDots() {
    if (!this.#dots) return;

    const items = [...this.#track.children];
    this.#dots.replaceChildren();
    this.#buttons = items.map((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'ui-carousel__dot';
      dot.setAttribute('aria-label', `${index + 1}`);
      dot.addEventListener('click', () => this.#goTo(index));
      this.#dots.append(dot);
      return dot;
    });
  }

  #goTo(index) {
    const from = this.#track.scrollLeft;
    const to = index * this.#stepSize();
    this.#step((to - from) / Math.max(this.#stepSize(), 1));
  }

  #syncDots() {
    if (!this.#buttons.length) return;
    const step = this.#stepSize();
    const current = step > 0 ? Math.round(Math.abs(this.#track.scrollLeft) / step) : 0;
    this.#buttons.forEach((dot, index) => {
      dot.toggleAttribute('data-current', index === current);
      dot.setAttribute('aria-current', index === current ? 'true' : 'false');
    });
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
    if (Math.round(to) === Math.round(from)) {
      // Nothing to move, but a drag may have left snapping off for us to hand back.
      track.style.scrollSnapType = '';
      return;
    }

    this.#cancel();

    // Nothing to animate with when the tab is hidden — frames stop coming, and an
    // animation started there would strand the track mid-step with snapping off.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden;
    if (still) {
      track.scrollLeft = to;
      track.style.scrollSnapType = '';
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

    this.toggleAttribute('data-scrollable', total > 1);
    this.#syncDots();
    if (this.#prev) this.#prev.disabled = travelled <= 1;
    if (this.#next) this.#next.disabled = travelled >= total - 1;
  };
}

if (!customElements.get('ui-carousel')) {
  customElements.define('ui-carousel', UICarousel);
}
