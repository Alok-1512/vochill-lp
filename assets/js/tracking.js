/* ==========================================================================
   tracking.js  —  dataLayer wiring

   window.dataLayer is initialised in the <head> of index.html, before any
   other script, so nothing can ever push into an undefined array.

   Events implemented:
     view_item     once per page load, the first time the product section is
                   actually visible in the viewport (IntersectionObserver).
     add_to_cart   only after the cart request resolves successfully — it is
                   fired from the .then() of the add, never from the click.

   Both payloads follow the GA4 ecommerce schema and carry the displayed
   page variation, so a GTM trigger can split reporting by variation.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var VC = (window.VC = window.VC || {});
  var params = new URLSearchParams(window.location.search);

  window.dataLayer = window.dataLayer || [];

  VC.debug = params.get('debug') === '1';

  /* ---- page variation ---------------------------------------------------
     Which creative the visitor was shown. Sourced from ?variation=, which is
     what an A/B tool (or a Shopify theme setting) would set. It is echoed
     into every ecommerce payload AND rendered in the footer so QA can see at
     a glance which version produced an event. */
  var VARIATIONS = {
    a: { id: 'A', name: 'control' },
    b: { id: 'B', name: 'benefit-led-hero' }
  };
  var requested = String(params.get('variation') || 'A').toLowerCase();
  VC.pageVariation = VARIATIONS[requested] || VARIATIONS.a;

  /* ---- payload builders -------------------------------------------------- */

  /**
   * One GA4 ecommerce item for the given variant.
   * Unit price sits on `price`; the line total is the event-level `value`.
   */
  function itemPayload(variant, quantity) {
    var product = VC.product;
    return {
      item_id: variant.sku,                     // SKU — the merchant-facing ID
      item_product_id: String(variant.productId), // Shopify product ID
      item_variant_id: String(variant.id),      // Shopify variant ID
      item_name: variant.productTitle,          // product name, e.g. "Stemless Wine Chiller Pair"
      item_brand: product.brand,
      item_category: product.category,
      item_variant: variant.title,              // e.g. "Couple Pair / Quartz"
      price: VC.toAmount(variant.price),        // unit price, e.g. 60.9
      quantity: quantity
    };
  }

  function ecommercePayload(variant, quantity) {
    return {
      currency: VC.product.currency,                       // "USD"
      value: VC.toAmount(variant.price * quantity),        // total value
      items: [itemPayload(variant, quantity)]
    };
  }

  /**
   * Push an ecommerce event. The `ecommerce: null` reset first is the GA4
   * recommendation — without it, keys from a previous event can leak into
   * the next one because the dataLayer merges objects.
   */
  function pushEcommerce(eventName, variant, quantity) {
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: eventName,
      page_variation: VC.pageVariation.id,
      page_variation_name: VC.pageVariation.name,
      ecommerce: ecommercePayload(variant, quantity)
    });
  }

  /* ---- events ------------------------------------------------------------ */

  var viewItemFired = false;   // hard guard: once per page load, full stop.

  function fireViewItem(variant) {
    if (viewItemFired) return;
    viewItemFired = true;
    pushEcommerce('view_item', variant, 1);
  }

  function fireAddToCart(variant, quantity) {
    pushEcommerce('add_to_cart', variant, quantity);
  }

  /**
   * Watch the product section and fire view_item the first time a meaningful
   * slice of it is on screen. The observer disconnects immediately after, so
   * scrolling back up cannot fire a duplicate.
   */
  function observeProductSection(getVariant) {
    var section = document.getElementById('product');
    if (!section) return;

    if (!('IntersectionObserver' in window)) {
      fireViewItem(getVariant());   // old browsers: fire on load rather than never
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          fireViewItem(getVariant());
          observer.disconnect();
          return;
        }
      }
    }, { threshold: 0.3 });

    observer.observe(section);
  }

  VC.Tracking = {
    variation: VC.pageVariation,
    itemPayload: itemPayload,
    fireAddToCart: fireAddToCart,
    observeProductSection: observeProductSection,
    hasFiredViewItem: function () { return viewItemFired; }
  };

  /* ======================================================================
     dataLayer inspector — a self-QA aid, not part of the design.
     It mirrors every push into a panel so the events can be verified on a
     phone or on the hosted preview without opening devtools. It wraps
     dataLayer.push rather than replacing it, so a real GTM container
     installed alongside would still receive everything.
     ====================================================================== */
  (function inspector() {
    var chip   = document.querySelector('[data-datalayer-toggle]');
    var panel  = document.querySelector('[data-datalayer-panel]');
    var list   = document.querySelector('[data-datalayer-list]');
    var count  = document.querySelector('[data-datalayer-count]');
    if (!panel || !list) return;

    var pushed = 0;
    var nativePush = window.dataLayer.push.bind(window.dataLayer);

    function render(payload) {
      if (!payload || !payload.event) return;   // skip the `ecommerce: null` resets
      var li = document.createElement('li');
      var tag = document.createElement('span');
      tag.className = 'datalayer-event';
      tag.textContent = payload.event;
      var pre = document.createElement('pre');
      pre.textContent = JSON.stringify(payload, null, 2);
      li.appendChild(tag);
      li.appendChild(pre);
      list.appendChild(li);
      list.scrollTop = list.scrollHeight;
    }

    window.dataLayer.push = function () {
      var result = nativePush.apply(null, arguments);
      for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] && arguments[i].event) {
          pushed++;
          if (VC.debug) window.console.info('[dataLayer]', arguments[i]);
        }
        render(arguments[i]);
      }
      if (count) count.textContent = String(pushed);
      return result;
    };

    /* Anything already queued before this ran (there should be nothing,
       but be safe if a tag manager landed first). */
    window.dataLayer.forEach(render);

    function toggle(force) {
      var open = typeof force === 'boolean' ? force : panel.hidden;
      panel.hidden = !open;
      document.querySelectorAll('[data-datalayer-toggle]').forEach(function (button) {
        button.setAttribute('aria-expanded', String(open));
      });
    }

    document.querySelectorAll('[data-datalayer-toggle]').forEach(function (button) {
      button.addEventListener('click', function () { toggle(); });
    });

    var clear = document.querySelector('[data-datalayer-clear]');
    if (clear) {
      clear.addEventListener('click', function () { list.innerHTML = ''; });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) toggle(false);
    });

    /* The inspector is QA tooling, not part of the design, so it only
       appears with ?debug=1 (advertised in the footer). */
    if (VC.debug) {
      if (chip) chip.hidden = false;
      toggle(true);
    } else if (chip) {
      chip.hidden = true;
    }
  })();
})(window, document);
