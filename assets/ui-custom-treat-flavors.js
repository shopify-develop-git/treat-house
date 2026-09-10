/** The flavor property accompanies the native variant; only Shopify sets its price. */
class UiCustomTreatFlavors extends HTMLElement {
  connectedCallback() {
    this.select = this.querySelector('select');
    this.standardFlavors = JSON.parse(this.querySelector('[data-standard-flavors]').textContent);
    this.scope = this.closest('.ui-product-variants');
    this.addEventListener('change', this.onChange);
    this.select.addEventListener('invalid', this.onInvalid);
    this.scope?.addEventListener('variant:update', this.onVariantUpdate);
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.onChange);
    this.select.removeEventListener('invalid', this.onInvalid);
    this.scope?.removeEventListener('variant:update', this.onVariantUpdate);
  }

  flavorRadios() {
    return [...(this.scope?.querySelectorAll(`variant-picker input[data-fieldset-index="${this.dataset.flavorIndex}"]`) || [])];
  }

  targetRadio() {
    if (!this.standardFlavors.includes(this.select.value)) return null;
    return this.flavorRadios().find(input => input.value === this.dataset.standardValue);
  }

  setError(message) {
    this.select.setCustomValidity(message);
    this.querySelector('[data-flavor-status]').textContent = message;
    const trigger = this.querySelector('[data-select-trigger]');
    for (const control of [this.select, trigger]) {
      if (message) control?.setAttribute('aria-invalid', 'true');
      else control?.removeAttribute('aria-invalid');
    }
    trigger?.setAttribute('aria-describedby', this.select.getAttribute('aria-describedby'));
  }

  onInvalid = (event) => {
    event.preventDefault();
    this.setError(this.select.value ? this.select.validationMessage : 'Please select your flavor.');
    const trigger = customElements.get('ui-select-menu') && this.querySelector('[data-select-trigger]');
    (trigger || this.select).focus();
  };

  onChange = (event) => {
    if (event.target !== this.select) return;
    if (!this.standardFlavors.includes(this.select.value)) {
      this.setError('Please choose your flavor.');
      return;
    }
    // Some custom products store flavor only as a line-item property.
    if (!this.hasAttribute('data-flavor-index')) {
      this.setError('');
      return;
    }
    const radio = this.targetRadio();
    if (!radio || radio.dataset.optionAvailable === 'false') {
      this.setError('This flavor is unavailable with these options. Please choose another flavor.');
      return;
    }
    this.setError('');
    if (!radio.checked) {
      this.setError('Updating your flavor. Please wait.');
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  onVariantUpdate = (event) => {
    if (!this.select.value || !this.hasAttribute('data-flavor-index')) return;
    const radio = this.targetRadio();
    const option = event.detail?.resource?.options?.[Number(this.dataset.flavorIndex)];
    const valid = radio && radio.dataset.optionAvailable !== 'false' && event.detail?.resource?.available && option === radio.value;
    this.setError(valid ? '' : 'This flavor is unavailable with these options. Please choose another flavor.');
  };
}

if (!customElements.get('ui-custom-treat-flavors')) {
  customElements.define('ui-custom-treat-flavors', UiCustomTreatFlavors);
}
