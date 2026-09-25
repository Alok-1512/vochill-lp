/* ==========================================================================
   accordion.js  —  FAQ accordion, written from scratch. No plugin.

   Pattern: WAI-ARIA disclosure. Each trigger is a real <button> inside a
   heading, wired to its panel with aria-controls / aria-expanded. The panel
   is height-animated from 0 to its measured content height and then released
   to `auto`, so a panel never gets stuck at a stale height when the viewport
   resizes or a font swaps in.

   `hidden` is removed before measuring and re-applied after collapsing, so
   closed panels stay out of the tab order and out of find-in-page.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var VC = (window.VC = window.VC || {});

  function create(root, options) {
    var settings = options || {};
    var single = settings.single !== false;     // default: one panel at a time
    var items = Array.prototype.slice.call(root.querySelectorAll('.accordion__item'));

    var panels = items.map(function (item) {
      return {
        item: item,
        trigger: item.querySelector('.accordion__trigger'),
        panel: item.querySelector('.accordion__panel')
      };
    }).filter(function (pair) { return pair.trigger && pair.panel; });

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function isOpen(pair) {
      return pair.trigger.getAttribute('aria-expanded') === 'true';
    }

    function open(pair) {
      var panel = pair.panel;
      pair.trigger.setAttribute('aria-expanded', 'true');
      pair.item.classList.add('is-open');
      panel.hidden = false;

      if (reduceMotion) { panel.style.height = 'auto'; return; }

      var target = panel.firstElementChild.getBoundingClientRect().height;
      panel.style.height = '0px';
      /* Force a reflow so the browser registers the 0 before the target. */
      void panel.offsetHeight;
      panel.style.height = target + 'px';
    }

    function close(pair) {
      var panel = pair.panel;
      pair.trigger.setAttribute('aria-expanded', 'false');
      pair.item.classList.remove('is-open');

      if (reduceMotion) { panel.style.height = '0px'; panel.hidden = true; return; }

      var current = panel.firstElementChild.getBoundingClientRect().height;
      panel.style.height = current + 'px';
      void panel.offsetHeight;
      panel.style.height = '0px';
    }

    panels.forEach(function (pair) {
      /* Once the opening transition ends, hand the height back to the
         content so it can reflow freely. */
      pair.panel.addEventListener('transitionend', function (event) {
        if (event.propertyName !== 'height') return;
        if (isOpen(pair)) {
          pair.panel.style.height = 'auto';
        } else {
          pair.panel.hidden = true;
        }
      });

      pair.trigger.addEventListener('click', function () {
        var wasOpen = isOpen(pair);

        if (single) {
          panels.forEach(function (other) {
            if (other !== pair && isOpen(other)) close(other);
          });
        }

        if (wasOpen) close(pair);
        else open(pair);
      });

      /* Sync the initial state written in the markup. */
      if (isOpen(pair)) {
        pair.item.classList.add('is-open');
        pair.panel.hidden = false;
        pair.panel.style.height = 'auto';
      } else {
        pair.panel.hidden = true;
        pair.panel.style.height = '0px';
      }
    });

    /* Keep an open panel correctly sized when the layout reflows. */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        panels.forEach(function (pair) {
          if (isOpen(pair)) pair.panel.style.height = 'auto';
        });
      }, 150);
    });

    return {
      openAt: function (i) { if (panels[i] && !isOpen(panels[i])) panels[i].trigger.click(); },
      closeAll: function () { panels.forEach(function (p) { if (isOpen(p)) close(p); }); }
    };
  }

  VC.Accordion = { create: create };
})(window, document);
