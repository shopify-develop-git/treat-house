/**
 * Keeps a character counter in step with the field it wraps.
 *
 * Deliberately free of `@theme/component`: the counter needs no lifecycle, no
 * refs and no section rehydration, and staying dependency-free keeps the UI kit
 * snippets loadable on their own.
 *
 * The server renders the starting count, so the field still reads correctly with
 * the script blocked — it simply stops updating.
 *
 * <ui-character-count>
 *   <textarea maxlength="200"></textarea>
 *   <span data-character-count>0 / 200</span>
 * </ui-character-count>
 */
class UICharacterCount extends HTMLElement {
  #field = null;
  #output = null;

  connectedCallback() {
    this.#field = this.querySelector('textarea, input');
    this.#output = this.querySelector('[data-character-count]');
    if (!this.#field || !this.#output) return;

    this.#update();
    this.#field.addEventListener('input', this.#update);
  }

  disconnectedCallback() {
    this.#field?.removeEventListener('input', this.#update);
  }

  #update = () => {
    const limit = this.#field.getAttribute('maxlength');
    const used = this.#field.value.length;
    this.#output.textContent = limit ? `${used} / ${limit}` : `${used}`;
  };
}

if (!customElements.get('ui-character-count')) {
  customElements.define('ui-character-count', UICharacterCount);
}
