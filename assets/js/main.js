/* ==========================================================================
   main.js  —  page wiring.

   Composes the pieces: chooses the cart transport, renders the variant
   picker, keeps the gallery/price/sticky bar in sync with the selection,
   runs the add-to-cart flow, and starts the view_item observer.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var VC = window.VC;
  var params = new URLSearchParams(window.location.search);

  /* ── 0. Cart backend ──────────────────────────────────────────────────
     Nothing to choose here: mock-cart-api.js intercepts fetch() unless the
     page is opened with ?live=1. */
  var useLiveCart = params.get('live') === '1';

  /* ── 1. State ─────────────────────────────────────────────────────────── */
  var catalog = VC.product;
  var state = {
    product: catalog.defaults.product,
    bundle:  catalog.defaults.bundle,
    color:   catalog.defaults.color,
    variant: null,      // resolved from the three keys above
    quantity: 1,        // no selector in the design — one bundle per add
    busy: false
  };

  var el = {
    productTabs:   document.querySelector('[data-product-tabs]'),
    bundles:       document.querySelector('[data-bundles]'),
    colorSelect:   document.querySelector('[data-color-select]'),
    colorButton:   document.querySelector('[data-color-button]'),
    colorList:     document.querySelector('[data-color-list]'),
    colorCurrent:  document.querySelector('[data-color-current]'),
    colorThumb:    document.querySelector('[data-color-thumb]'),
    subtitle:      document.querySelector('[data-product-subtitle]'),
    reviewCount:   document.querySelector('[data-review-count]'),
    checks:        document.querySelector('[data-checks]'),
    note:          document.querySelector('[data-product-note]'),
    price:         document.querySelector('[data-price]'),
    comparePrice:  document.querySelector('[data-compare-price]'),
    saveBadge:     document.querySelector('[data-save-badge]'),
    productTitle:  document.querySelector('[data-product-title]'),
    form:          document.querySelector('[data-add-form]'),
    addButton:     document.querySelector('[data-add-button]'),
    addLabel:      document.querySelector('[data-add-label]'),
    addSpinner:    document.querySelector('[data-add-spinner]'),
    feedback:      document.querySelector('[data-add-feedback]'),
    stickyBar:     document.querySelector('[data-sticky-bar]'),
    stickyName:    document.querySelector('[data-sticky-name]'),
    stickyPrice:   document.querySelector('[data-sticky-price]'),
    stickyAdd:     document.querySelector('[data-sticky-add]'),
    variationLabel:document.querySelector('[data-variation-label]')
  };

  /* ── 2. Page variation ────────────────────────────────────────────────
     Variation B is a different hero creative. Whichever is shown is echoed
     into every ecommerce payload by tracking.js. */
  var VARIATION_COPY = {
    B: {
      heroTitle: 'Wine at <em>Exactly</em> the Right Temperature',
      heroLede: 'One frozen cradle holds your glass at its ideal serving temperature for over an hour — no ice, no dilution, no rushing to finish before it turns warm.',
      heroCtaPrimary: 'Shop the Stemless Set'
    }
  };

  (function applyVariation() {
    if (el.variationLabel) {
      el.variationLabel.textContent = VC.pageVariation.id + ' · ' + VC.pageVariation.name;
    }
    document.body.setAttribute('data-page-variation', VC.pageVariation.id);

    var copy = VARIATION_COPY[VC.pageVariation.id];
    if (!copy) return;
    Object.keys(copy).forEach(function (slot) {
      var node = document.querySelector('[data-var-slot="' + slot + '"]');
      if (node) node.innerHTML = copy[slot];
    });
  })();

  /* ── 3. Gallery + zoom lightbox ───────────────────────────────────────── */
  var galleryRoot = document.querySelector('[data-gallery]');
  var gallery = null;
  var lightbox = null;

  if (galleryRoot) {
    gallery = VC.Gallery.create(galleryRoot, { observeVisibility: true });
    gallery.setMedia(catalog.getProduct(state.product).media);

    var lightboxRoot = document.querySelector('[data-lightbox]');
    if (lightboxRoot) {
      lightbox = VC.Gallery.createLightbox(lightboxRoot, catalog.getProduct(state.product).media, {
        onOpen:  function () { gallery.setActive(false); },   // one video at a time
        onClose: function (endIndex) { gallery.goTo(endIndex); gallery.setActive(true); }
      });
      var zoom = galleryRoot.querySelector('[data-gallery-zoom]');
      if (zoom) zoom.addEventListener('click', function () { lightbox.open(gallery.index); });
    }
  }

  /* ── 4. Pickers: product tabs, bundle options, colour dropdown ─────────
     Every change resolves a new variant, which drives the price block, the
     cart request's variant ID and the dataLayer payload. */

  /* A radio-style option button with a thumbnail and a label. */
  function optionButton(className, thumb, labelHtml, onSelect) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    button.innerHTML =
      '<img src="' + thumb + '" alt="" width="64" height="64" loading="lazy" decoding="async">' +
      '<span>' + labelHtml + '</span>';
    button.addEventListener('click', onSelect);
    return button;
  }

  /* Arrow keys move between options inside a radiogroup (roving focus). */
  function enableRovingFocus(group) {
    group.addEventListener('keydown', function (event) {
      var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(event.key in keys)) return;
      var items = Array.prototype.slice.call(group.querySelectorAll('[role="radio"]'));
      var i = items.indexOf(document.activeElement);
      if (i < 0) return;
      var nextItem = items[(i + keys[event.key] + items.length) % items.length];
      nextItem.focus();
      nextItem.click();
      event.preventDefault();
    });
  }

  function syncRadios(group, activeKey) {
    if (!group) return;
    var items = group.querySelectorAll('[role="radio"]');
    for (var i = 0; i < items.length; i++) {
      var on = items[i].dataset.key === activeKey;
      items[i].setAttribute('aria-checked', String(on));
      items[i].tabIndex = on ? 0 : -1;
    }
  }

  function buildPickers() {
    if (el.productTabs) {
      catalog.products.forEach(function (p) {
        var b = optionButton('product-tabs__tab', p.thumb, p.tab, function () {
          state.product = p.key; applySelection();
        });
        b.dataset.key = p.key;
        el.productTabs.appendChild(b);
      });
      enableRovingFocus(el.productTabs);
    }

    if (el.bundles) {
      catalog.bundles.forEach(function (bundle) {
        var b = optionButton('bundle-options__card', bundle.thumb, bundle.labelHtml || bundle.label, function () {
          state.bundle = bundle.key; applySelection();
        });
        b.dataset.key = bundle.key;
        b.setAttribute('aria-label', bundle.label);

        /* Each card sits in a wrapper so an optional badge can hang below it. */
        var wrap = document.createElement('div');
        wrap.className = 'bundle-options__item';
        wrap.appendChild(b);
        if (bundle.badge) {
          var badge = document.createElement('span');
          badge.className = 'bundle-options__badge';
          badge.id = 'badge-' + bundle.key;
          badge.textContent = bundle.badge;
          b.setAttribute('aria-describedby', badge.id);
          wrap.appendChild(badge);
        }
        el.bundles.appendChild(wrap);
      });
      enableRovingFocus(el.bundles);
    }

    if (el.colorList) {
      catalog.colors.forEach(function (c) {
        var li = document.createElement('li');
        li.className = 'color-select__option';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.tabIndex = -1;
        li.dataset.key = c.key;
        li.innerHTML =
          '<img src="' + c.thumb + '" alt="" width="40" height="40" loading="lazy" decoding="async">' +
          '<span>' + c.title + (c.soldOut ? ' <em>Sold out</em>' : '') + '</span>';
        li.addEventListener('click', function () { chooseColor(c.key); });
        el.colorList.appendChild(li);
      });
    }
  }

  /* ---- colour dropdown (custom listbox) ---- */
  function openColors() {
    if (!el.colorList) return;
    el.colorList.hidden = false;
    el.colorButton.setAttribute('aria-expanded', 'true');
    var current = el.colorList.querySelector('[aria-selected="true"]') || el.colorList.firstElementChild;
    if (current) current.focus();
  }

  function closeColors(returnFocus) {
    if (!el.colorList || el.colorList.hidden) return;
    el.colorList.hidden = true;
    el.colorButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) el.colorButton.focus();
  }

  function chooseColor(key) {
    state.color = key;
    applySelection();
    closeColors(true);
  }

  if (el.colorButton) {
    el.colorButton.addEventListener('click', function () {
      if (el.colorList.hidden) openColors(); else closeColors(false);
    });
    el.colorButton.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { openColors(); event.preventDefault(); }
    });
  }
  if (el.colorList) {
    el.colorList.addEventListener('keydown', function (event) {
      var options = Array.prototype.slice.call(el.colorList.children);
      var i = options.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') { options[Math.min(i + 1, options.length - 1)].focus(); event.preventDefault(); }
      else if (event.key === 'ArrowUp') { options[Math.max(i - 1, 0)].focus(); event.preventDefault(); }
      else if (event.key === 'Home') { options[0].focus(); event.preventDefault(); }
      else if (event.key === 'End') { options[options.length - 1].focus(); event.preventDefault(); }
      else if (event.key === 'Enter' || event.key === ' ') {
        if (i >= 0) chooseColor(options[i].dataset.key);
        event.preventDefault();
      } else if (event.key === 'Escape' || event.key === 'Tab') {
        closeColors(event.key === 'Escape');
      }
    });
  }
  document.addEventListener('click', function (event) {
    if (el.colorSelect && !el.colorSelect.contains(event.target)) closeColors(false);
  });

  /* ---- apply the current selection everywhere ---- */
  var renderedProduct = null;     // which product's copy/gallery is showing
  var galleryReady = !!gallery;   // gallery was built with the default product
  function applySelection() {
    var variant = catalog.resolve(state.product, state.bundle, state.color);
    var product = catalog.getProduct(state.product);
    var color = catalog.getColor(state.color);
    state.variant = variant;

    syncRadios(el.productTabs, state.product);
    syncRadios(el.bundles, state.bundle);

    /* Product-level content swaps only when the product actually changes. */
    if (product.key !== renderedProduct) {
      renderedProduct = product.key;
      if (el.productTitle) el.productTitle.textContent = product.title;
      if (el.subtitle) el.subtitle.innerHTML = product.subtitleHtml;
      if (el.reviewCount) el.reviewCount.textContent = product.reviews + ' Reviews';
      if (el.checks) {
        el.checks.textContent = '';
        product.checks.forEach(function (text) {
          var li = document.createElement('li');
          li.textContent = text;
          el.checks.appendChild(li);
        });
      }
      if (el.note) { el.note.textContent = product.note; el.note.hidden = !product.note; }

      /* Bundle thumbnails follow the product */
      if (el.bundles) {
        var cards = el.bundles.querySelectorAll('[role="radio"] img');
        catalog.bundles.forEach(function (b, i) { if (cards[i]) cards[i].src = product.bundleThumbs[b.key]; });
      }

      /* Each product has its own gallery; start again from slide 1. */
      if (gallery && galleryReady) gallery.setMedia(product.media);
      if (lightbox && galleryReady) lightbox.setMedia(product.media);
    }

    /* Colour dropdown */
    if (el.colorCurrent) el.colorCurrent.textContent = color.title + (variant.available ? '' : ' — sold out');
    if (el.colorThumb) el.colorThumb.src = color.thumb;
    if (el.colorList) {
      for (var i = 0; i < el.colorList.children.length; i++) {
        var opt = el.colorList.children[i];
        opt.setAttribute('aria-selected', String(opt.dataset.key === state.color));
      }
    }

    /* Price block */
    if (el.price) el.price.textContent = VC.formatMoney(variant.price);
    var discounted = variant.compareAt > variant.price;
    if (el.comparePrice) {
      el.comparePrice.textContent = VC.formatMoney(variant.compareAt);
      el.comparePrice.hidden = !discounted;
    }
    if (el.saveBadge) {
      el.saveBadge.hidden = !discounted;
      el.saveBadge.textContent = 'Save ' + VC.formatMoney(variant.compareAt - variant.price);
    }

    /* Sticky bar mirrors the buy box */
    if (el.stickyName) el.stickyName.textContent = product.title + ' · ' + variant.title;
    if (el.stickyPrice) el.stickyPrice.textContent = VC.formatMoney(variant.price);

    /* Availability */
    setAddEnabled(variant.available);
    if (el.addLabel) el.addLabel.textContent = variant.available ? 'Add to Cart' : 'Sold Out';
    if (el.stickyAdd) el.stickyAdd.textContent = variant.available ? 'Add to Cart' : 'Sold Out';

    setFeedback('', null);

    if (VC.debug) window.console.info('[variant]', variant.id, variant.sku, variant.productTitle, variant.title);
  }

  function setAddEnabled(enabled) {
    if (el.addButton) el.addButton.disabled = !enabled;
    if (el.stickyAdd) el.stickyAdd.disabled = !enabled;
  }

  /* ── 6. Feedback + busy state ─────────────────────────────────────────── */
  function setFeedback(message, tone) {
    if (!el.feedback) return;
    el.feedback.textContent = message;
    if (tone) el.feedback.setAttribute('data-state', tone);
    else el.feedback.removeAttribute('data-state');
  }

  function setBusy(busy) {
    state.busy = busy;
    if (el.addButton) {
      el.addButton.classList.toggle('is-busy', busy);
      el.addButton.disabled = busy || !state.variant.available;
    }
    if (el.stickyAdd) el.stickyAdd.disabled = busy || !state.variant.available;
    if (el.addLabel) {
      el.addLabel.textContent = busy
        ? 'Adding…'
        : (state.variant.available ? 'Add to Cart' : 'Sold Out');
    }
    if (el.addSpinner) el.addSpinner.hidden = !busy;
  }

  /* ── 7. Add to cart ───────────────────────────────────────────────────── */
  function addToCart() {
    if (state.busy || !state.variant.available) return;

    var variant = state.variant;
    var quantity = state.quantity;

    setBusy(true);
    setFeedback('', null);

    VC.Cart.addItem({
      id: variant.id,            // selected variant ID
      quantity: quantity,        // selected quantity
      properties: {              // hidden ("_") line-item properties
        _product_id: String(variant.productId),
        _sku: variant.sku,
        _source: 'landing-page',
        _variation: VC.pageVariation.id
      }
    })
      .then(function (added) {
        /* SUCCESS PATH ONLY — add_to_cart fires here, after the request
           resolved, never from the click handler. */
        VC.Tracking.fireAddToCart(variant, quantity);
        setFeedback('Added to your cart.', 'success');
        /* Resync from the cart endpoint the way a real theme would. */
        return VC.Cart.getCart();
      })
      .then(function (cart) {
        renderDrawer(cart);
        openDrawer();
      })
      .catch(function (error) {
        /* No dataLayer event on failure — that is the point of the guard. */
        setFeedback(error.message || 'Something went wrong. Please try again.', 'error');
        if (VC.debug) window.console.warn('[cart] add failed', error);
      })
      .then(function () {
        setBusy(false);
      });
  }

  if (el.form) {
    el.form.addEventListener('submit', function (event) {
      event.preventDefault();
      addToCart();
    });
  }
  if (el.stickyAdd) el.stickyAdd.addEventListener('click', addToCart);

  /* ── 8. Cart drawer ───────────────────────────────────────────────────── */
  var drawer = document.querySelector('[data-drawer]');
  var drawerItems = document.querySelector('[data-drawer-items]');
  var drawerEmpty = document.querySelector('[data-drawer-empty]');
  var drawerTotal = document.querySelector('[data-drawer-total]');
  var lastFocused = null;

  function renderDrawer(cart) {
    if (!drawerItems) return;
    drawerItems.textContent = '';

    var items = (cart && cart.items) || [];
    if (drawerEmpty) drawerEmpty.hidden = items.length > 0;

    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'drawer__line';

      var img = document.createElement('img');
      img.src = (item.featured_image && item.featured_image.url) || item.image;
      img.alt = '';
      img.width = 64;
      img.height = 64;
      img.loading = 'lazy';

      var info = document.createElement('div');
      var name = document.createElement('p');
      name.className = 'drawer__line-name';
      name.textContent = item.product_title;
      var meta = document.createElement('p');
      meta.className = 'drawer__line-meta';
      meta.textContent = item.variant_title + ' · Qty ' + item.quantity;
      info.appendChild(name);
      info.appendChild(meta);

      var price = document.createElement('p');
      price.className = 'drawer__line-price';
      price.textContent = VC.formatMoney(item.line_price);

      li.appendChild(img);
      li.appendChild(info);
      li.appendChild(price);
      drawerItems.appendChild(li);
    });

    if (drawerTotal) drawerTotal.textContent = VC.formatMoney((cart && cart.total_price) || 0);
  }

  function openDrawer() {
    if (!drawer) return;
    lastFocused = document.activeElement;
    drawer.hidden = false;
    /* Next frame, so the transition has a start state to animate from. */
    window.requestAnimationFrame(function () {
      drawer.classList.add('is-open');
      document.body.classList.add('is-locked');
      var close = drawer.querySelector('.drawer__close');
      if (close) close.focus();
    });
  }

  function closeDrawer() {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    window.setTimeout(function () { drawer.hidden = true; }, 320);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  document.querySelectorAll('[data-drawer-close]').forEach(function (node) {
    node.addEventListener('click', closeDrawer);
  });
  document.addEventListener('keydown', function (event) {
    if (!drawer || drawer.hidden) return;
    if (event.key === 'Escape') { closeDrawer(); return; }
    if (event.key !== 'Tab') return;

    /* Minimal focus trap while the dialog is modal. */
    var focusables = drawer.querySelectorAll(
      'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  });

  /* ── 9. Shop CTAs ─────────────────────────────────────────────────────── */
  document.querySelectorAll('[data-shop]').forEach(function (button) {
    button.addEventListener('click', function () {
      var section = document.getElementById('product');
      if (!section) return;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      /* Move keyboard focus with the scroll, not just the viewport. */
      window.setTimeout(function () {
        var firstOption = el.productTabs && el.productTabs.querySelector('[aria-checked="true"]');
        if (firstOption) firstOption.focus({ preventScroll: true });
      }, 500);
    });
  });

  /* Mobile sticky buy-bar visibility. */
  var productSection = document.getElementById('product');
  var footer = document.querySelector('.site-footer');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      if (el.stickyBar && productSection) {
        var box = productSection.getBoundingClientRect();
        /* Appears once the real buy box has scrolled past, and stays
           available — except over the footer, where it would cover links. */
        var pastBuyBox = box.bottom < window.innerHeight * 0.9;
        var footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
        var show = pastBuyBox && footerTop > window.innerHeight;
        el.stickyBar.hidden = false;
        el.stickyBar.classList.toggle('is-visible', show);
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── 10. Accordion ────────────────────────────────────────────────────── */
  var accordionRoot = document.querySelector('[data-accordion]');
  if (accordionRoot) VC.Accordion.create(accordionRoot, { single: true });

  /* ── 11. Boot ─────────────────────────────────────────────────────────── */
  buildPickers();
  applySelection();
  onScroll();

  /* view_item fires the first time the product section is on screen. */
  VC.Tracking.observeProductSection(function () { return state.variant; });

  if (VC.debug) {
    window.console.info(
      '[VoChill] transport = %s · variation = %s',
      useLiveCart ? 'live fetch' : 'mock',
      VC.pageVariation.id
    );
  }
})(window, document);
