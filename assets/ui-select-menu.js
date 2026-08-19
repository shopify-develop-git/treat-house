/**
 * Turns a native select into the kit's dropdown without giving up what the native
 * one does for free.
 *
 * The select stays in the DOM and stays the value: it is what the form submits, and
 * with this script blocked it is simply what the visitor uses, because the custom
 * trigger and list stay hidden until the element upgrades. Once it does, the select
 * leaves the tab order and the accessibility tree, and the button/listbox pair takes
 * over — arrows, Home, End, Enter, Escape, type-ahead and all.
 *
 * The panel floats rather than pushing the form down. The kit draws it inline
 * because a Figma variant has to grow to hold it, but a dropdown that reflows the
 * page on open is not what the drawing means.
 *
 * Dependency-free, like the rest of the kit's scripts.
 */
class UISelectMenu extends HTMLElement {
  #select = null;
  #trigger = null;
  #list = null;
  #value = null;
  #options = [];
  #typeahead = '';
  #typeaheadTimer = 0;

  connectedCallback() {
    this.#select = this.querySelector('select');
    this.#trigger = this.querySelector('[data-select-trigger]');
    this.#list = this.querySelector('[role="listbox"]');
    this.#value = this.querySelector('[data-select-value]');
    if (!this.#select || !this.#trigger || !this.#list) return;

    this.#options = Array.from(this.#list.querySelectorAll('[role="option"]'));

    // The select keeps the value but stops being something to land on.
    this.#select.tabIndex = -1;
    this.#select.setAttribute('aria-hidden', 'true');

    this.#trigger.addEventListener('click', this.#toggle);
    this.#trigger.addEventListener('keydown', this.#onTriggerKey);
    this.#list.addEventListener('click', this.#onListClick);
    this.#list.addEventListener('keydown', this.#onListKey);
    this.#list.addEventListener('pointermove', this.#onListPointer);
    document.addEventListener('pointerdown', this.#onOutside);

    this.#sync();
  }

  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.#onOutside);
  }

  get #isOpen() {
    return this.#trigger.getAttribute('aria-expanded') === 'true';
  }

  #open = () => {
    this.#trigger.setAttribute('aria-expanded', 'true');
    this.#list.hidden = false;
    const current = this.#options.find((o) => o.dataset.value === this.#select.value);
    this.#activate(current || this.#options[0]);
    this.#list.focus();
  };

  #close = (returnFocus = true) => {
    this.#trigger.setAttribute('aria-expanded', 'false');
    this.#list.hidden = true;
    if (returnFocus) this.#trigger.focus();
  };

  #toggle = () => (this.#isOpen ? this.#close() : this.#open());

  #onOutside = (event) => {
    if (this.#isOpen && !this.contains(event.target)) this.#close(false);
  };

  #activate(option, { scroll = true } = {}) {
    if (!option) return;
    for (const item of this.#options) item.classList.toggle('is-active', item === option);
    this.#list.setAttribute('aria-activedescendant', option.id);
    if (scroll) option.scrollIntoView({ block: 'nearest' });
  }

  #move(step) {
    const active = this.#options.findIndex((o) => o.classList.contains('is-active'));
    const next = Math.min(Math.max(active + step, 0), this.#options.length - 1);
    this.#activate(this.#options[next]);
  }

  #choose(option) {
    if (!option) return;
    this.#select.value = option.dataset.value;
    this.#select.dispatchEvent(new Event('change', { bubbles: true }));
    this.#sync();
    this.#close();
  }

  #sync() {
    const picked = this.#select.selectedOptions[0];
    const isPlaceholder = !picked || picked.value === '';
    if (this.#value) this.#value.textContent = picked ? picked.textContent.trim() : '';
    this.classList.toggle('is-placeholder', isPlaceholder);
    for (const item of this.#options) {
      item.setAttribute('aria-selected', String(item.dataset.value === this.#select.value));
    }
  }

  #onTriggerKey = (event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      this.#open();
    }
  };

  #onListKey = (event) => {
    const active = this.#options.find((o) => o.classList.contains('is-active'));
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); this.#move(1); break;
      case 'ArrowUp': event.preventDefault(); this.#move(-1); break;
      case 'Home': event.preventDefault(); this.#activate(this.#options[0]); break;
      case 'End': event.preventDefault(); this.#activate(this.#options.at(-1)); break;
      case 'Enter':
      case ' ': event.preventDefault(); this.#choose(active); break;
      case 'Escape': event.preventDefault(); this.#close(); break;
      case 'Tab': this.#close(false); break;
      default:
        if (event.key.length === 1) this.#search(event.key);
    }
  };

  #search(char) {
    clearTimeout(this.#typeaheadTimer);
    this.#typeahead += char.toLowerCase();
    this.#typeaheadTimer = setTimeout(() => (this.#typeahead = ''), 500);
    const hit = this.#options.find((o) => o.textContent.trim().toLowerCase().startsWith(this.#typeahead));
    this.#activate(hit);
  }

  /* Hover moves the active option rather than lighting a second one beside it, so the
     pointer and the arrow keys can never disagree about which row is current. */
  #onListPointer = (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) this.#activate(option, { scroll: false });
  };

  #onListClick = (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) this.#choose(option);
  };
}

if (!customElements.get('ui-select-menu')) {
  customElements.define('ui-select-menu', UISelectMenu);
}
