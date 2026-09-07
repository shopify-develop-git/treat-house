/*
 * Wholesale application: the thank-you state.
 *
 * The form on sections/wholesale-form.liquid belongs to the Clay B2B Wholesale
 * app, which swaps it for its own message in place once a submission is accepted
 * and announces the send on `document` as `clay:form:submitted`. This listens for
 * that and reveals the section's own confirmation panel instead.
 *
 * The event name is the app's, so it is not the only thing relied on. The app's
 * block is also watched: once the visitor has pressed the submit button and the
 * app has taken the form (no submit, no fields) and put something else in its
 * place and left it that way for a moment, that is read as a send too. Nothing
 * fires before a press, so the app mounting its form on load — empty container,
 * then fields — is never mistaken for a submission; and the wait means a
 * submitting state or an error render, which put the form back, are not either.
 *
 * In the theme editor, selecting either of the panel's static blocks shows the
 * panel so the merchant can see what they are editing.
 */
(function () {
  'use strict';

  var SUBMIT = 'button[type="submit"], input[type="submit"], button.button.primary';
  var FIELD = 'input:not([type="hidden"]), select, textarea';

  function init(root) {
    if (!root || root.dataset.wholesaleConfirmationReady === 'true') return;
    root.dataset.wholesaleConfirmationReady = 'true';

    var panel = root.querySelector('[data-wholesale-form-sent]');
    if (!panel) return;

    var appBlock = root.querySelector('.shopify-block');
    var submitted = false;
    var pressed = false;
    var observer = null;
    var settle = null;

    /*
     * The app takes the form apart in steps — a disabled button, a spinner, the
     * fields gone, then its own message — and an error render can put the fields
     * straight back. So the fallback waits for the block to hold still for a
     * moment before reading it, and reads it fresh at that point rather than
     * trusting the shape it had mid-swap. The app's own event still reveals at
     * once.
     */
    var SETTLE_MS = 1500;

    function settled() {
      settle = null;
      if (!pressed || submitted) return;
      if (appBlock.querySelector(SUBMIT)) return;
      if (appBlock.querySelector(FIELD)) return;
      if ((appBlock.textContent || '').trim() === '') return;
      reveal();
    }

    function reveal() {
      if (submitted) return;
      submitted = true;
      if (observer) observer.disconnect();
      if (settle) {
        clearTimeout(settle);
        settle = null;
      }
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

    document.addEventListener('clay:form:submitted', reveal);

    if (appBlock && typeof MutationObserver === 'function') {
      appBlock.addEventListener('click', function (event) {
        var target = event.target;
        if (target && target.closest && target.closest(SUBMIT)) pressed = true;
      });
      appBlock.addEventListener('submit', function () {
        pressed = true;
      });

      observer = new MutationObserver(function () {
        if (!pressed || submitted) return;
        if (settle) clearTimeout(settle);
        settle = setTimeout(settled, SETTLE_MS);
      });
      observer.observe(appBlock, { childList: true, subtree: true });
    }

    /* Theme editor: show the panel while one of its blocks is selected. */
    document.addEventListener('shopify:block:select', function (event) {
      if (!event.target || !panel.contains(event.target)) return;
      panel.hidden = false;
      if (appBlock) appBlock.hidden = true;
    });
    document.addEventListener('shopify:block:deselect', function (event) {
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
