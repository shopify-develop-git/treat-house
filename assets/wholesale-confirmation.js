/*
 * Wholesale application: the thank-you state.
 *
 * The form on sections/wholesale-form.liquid belongs to the Clay B2B Wholesale
 * app, which swaps it for its own message in place once a submission is accepted
 * and announces the accepted customer on `document` as `clay:form:submitted`.
 * Only that acknowledgement, for this form, reveals our confirmation. A loading
 * or error screen can also remove the app's fields and is never proof of success.
 *
 * In the theme editor, selecting either of the panel's static blocks shows the
 * panel so the merchant can see what they are editing.
 */
(function () {
  'use strict';

  function init(root) {
    if (!root || root.dataset.wholesaleConfirmationReady === 'true') return;
    root.dataset.wholesaleConfirmationReady = 'true';

    var panel = root.querySelector('[data-wholesale-form-sent]');
    if (!panel) return;

    var appBlock = root.querySelector('.shopify-block');
    var form = appBlock && appBlock.querySelector('.clay-wholesale-registration-form[id]');
    var submitted = false;

    /* Draft presentation for the existing Clay application. Match both the
       field label and its current placeholder so future merchant edits win. */
    var placeholderUpdates = [
      ['Customer Name', 'Willy Johnson', 'Your full name'],
      ['Customer Phone', '(123) 456-7890', 'Your phone number'],
      ['Customer Email', 'willy.wonka@example.com', 'Your email address'],
      ['Company Name', 'Wonka Chocolate Factory', 'Your company name'],
      ['Company website', 'wonkachocolatefactory.com', 'Your company website'],
      ['Billing Address', '1234 Main St, New York, USA', 'Street address'],
      ['Billing City', 'Florida', 'City'],
      ['Billing State', 'Florida', 'State'],
      ['Billing Zip', '1234', 'Postal code'],
      ['Shipping Address', '1234 Main St, New York, USA', 'Street address'],
      ['Shipping State', 'New York', 'State'],
      ['Shipping Zip', '1234', 'Postal code'],
      ['Phone', '(123) 456-7890', 'Your phone number']
    ];
    var certificateLabel = 'REQUIRED: Upload Certificate of Authority Or Tax Exempt Form';

    function fieldHasLabel(input, label) {
      return Array.from(input.labels || []).some(function (item) {
        return item.textContent.trim().replace(/\s*\*$/, '') === label;
      });
    }

    function certificateInput() {
      if (!form || form.id !== '57a614f4-3ee7-48fe-b7e0-3a910d4ee93d') return null;
      var input = form.querySelector('input[type="file"][id="element-1-3333365c-475b-47d3-b227-7a9d604bdacb"]');
      return input && fieldHasLabel(input, certificateLabel) ? input : null;
    }

    function certificatePresent(input) {
      var container = input.closest('.file-upload-container');
      var name = container && container.querySelector('.file-name');
      /* Clay renders this name from the accepted file in its state. A dropped
         file does not populate input.files, so native `required` would reject it. */
      return !!(name && name.textContent.trim() && name.textContent.trim() !== 'No file selected');
    }

    function prepareFields() {
      if (!form) return;
      form.querySelectorAll('input[placeholder]').forEach(function (input) {
        placeholderUpdates.forEach(function (update) {
          if (input.placeholder === update[1] && fieldHasLabel(input, update[0])) input.placeholder = update[2];
        });
      });
      var input = certificateInput();
      if (!input) return;
      input.setAttribute('aria-required', 'true');
      var error = form.querySelector('[data-wholesale-certificate-error]');
      if (error && certificatePresent(input)) {
        error.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    }

    function guardCertificate(event) {
      var input = certificateInput();
      if (!input || !input.form) return;
      var targetForm = event.target.closest && event.target.closest('form');
      if (targetForm !== input.form || certificatePresent(input)) return;
      if (event.type === 'click' && !event.target.closest('button[type="submit"], input[type="submit"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      var container = input.closest('.file-upload-container');
      var error = form.querySelector('[data-wholesale-certificate-error]');
      if (!error) {
        error = document.createElement('p');
        error.className = 'error-message';
        error.dataset.wholesaleCertificateError = '';
        error.id = input.id + '-required-error';
        error.setAttribute('role', 'alert');
        error.tabIndex = -1;
        error.textContent = 'Please upload your Certificate of Authority or tax exempt form before submitting.';
        container.appendChild(error);
      }
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', error.id);
      error.focus({ preventScroll: true });
      try { container.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* optional */ }
    }

    /* Capture outside the app mount, before Clay's delegated submit handler.
       This is storefront validation; the app's backend requirement is unchanged. */
    root.addEventListener('click', guardCertificate, true);
    root.addEventListener('submit', guardCertificate, true);
    prepareFields();
    if (form) {
      new MutationObserver(prepareFields).observe(form, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['placeholder']
      });
    }

    function reveal() {
      if (submitted) return;
      submitted = true;
      if (appBlock) appBlock.hidden = true;
      panel.hidden = false;
      try {
        panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (e) {
        /* older engines take no options object */
      }
      try {
        panel.focus({ preventScroll: true });
      } catch (e) {
        /* focus is a courtesy, not a requirement */
      }
    }

    document.addEventListener('clay:form:submitted', function (event) {
      var detail = event.detail;
      if (!root.isConnected || !form || !detail || detail.formId !== form.id) return;
      if (!detail.customer || typeof detail.customer !== 'object' || Array.isArray(detail.customer)) return;
      reveal();
    });

    /* Theme editor: show the panel while one of its blocks is selected. */
    document.addEventListener('shopify:block:select', function (event) {
      if (!window.Shopify || !window.Shopify.designMode) return;
      if (!event.target || !panel.contains(event.target)) return;
      panel.hidden = false;
      if (appBlock) appBlock.hidden = true;
    });
    document.addEventListener('shopify:block:deselect', function (event) {
      if (!window.Shopify || !window.Shopify.designMode) return;
      if (submitted || !event.target || !panel.contains(event.target)) return;
      panel.hidden = true;
      if (appBlock) appBlock.hidden = false;
    });
  }

  function initAll(scope) {
    var roots = (scope || document).querySelectorAll('[data-wholesale-form]');
    for (var i = 0; i < roots.length; i += 1) init(roots[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target || document);
  });
})();
