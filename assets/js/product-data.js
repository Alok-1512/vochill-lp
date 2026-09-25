/* ==========================================================================
   product-data.js
   The catalogue the product section renders from.

   In a real Shopify theme this would be emitted by Liquid from the two
   products' JSON. Everything downstream — gallery, buy box, cart request,
   dataLayer payloads — reads from here, so there is one source of truth for
   IDs and prices.

   Shape: 2 products (Stemless / Stemmed) × 3 bundles (Single / Couple Pair /
   Couple Pair + 2 Chill Cradles) × 9 colours = 54 variants, each with its own
   variant ID and SKU. Real Shopify variant IDs are used where the live store
   has that exact combination; the rest are deterministic mock IDs.

   Pricing: compare-at = the list price; sale = 10% off Stemless, 15% off
   Stemmed (the stemmed product page's own discount).

   Money is held in CENTS, the unit the Shopify AJAX API uses, and only
   converted at the edges (display strings, dataLayer values).
   ========================================================================== */
(function (window) {
  'use strict';

  var VC = (window.VC = window.VC || {});

  /* ---- per-product galleries -------------------------------------------- */
  var VIDEO = { type: 'video',
    src: 'assets/img/601ee5002678464e87a630eb0372e20b.HD-1080p-4.8Mbps-26479229.mp4',
    poster: 'assets/img/gallery-video-poster.jpg',
    alt: 'A glass of rosé chilling in a VoChill chiller beside a pool at dusk' };

  var STEMLESS_MEDIA = [
    { type: 'image', src: 'assets/img/gallery-product.jpg',
      alt: 'A pair of white VoChill chillers holding stemless glasses of white wine' },
    { type: 'image', src: 'assets/img/gallery-stemless-pool.jpg',
      alt: 'Two hands lifting glasses of rosé from VoChill chillers on a poolside table' },
    { type: 'image', src: 'assets/img/gallery-stemless-lift.jpg',
      alt: 'A woman lifting a stemless glass of white wine out of a VoChill chiller' },
    { type: 'image', src: 'assets/img/gallery-stemless-friends.jpg',
      alt: 'Two friends laughing at a table, glasses resting in VoChill chillers' },
    { type: 'image', src: 'assets/img/gallery-dining.jpg',
      alt: 'Two women laughing at an outdoor lunch table, a glass of rosé resting in a VoChill chiller' },
    { type: 'image', src: 'assets/img/gallery-pour.jpg',
      alt: 'A hand setting a stemless glass of white wine into a VoChill chiller on a sunlit shelf' },
    VIDEO
  ];

  var STEMMED_MEDIA = [
    { type: 'image', src: 'assets/img/gallery-stemmed-product.jpg',
      alt: 'A pair of VoChill stemmed chillers holding glasses of rosé' },
    { type: 'image', src: 'assets/img/gallery-stemmed-pool.jpg',
      alt: 'A stemmed glass of rosé in a VoChill chiller beside a pool' },
    { type: 'image', src: 'assets/img/gallery-stemmed-lounge.jpg',
      alt: 'A hand reaching for a stemmed glass of rosé in a VoChill chiller on a woven tray' },
    { type: 'image', src: 'assets/img/gallery-stemmed-dinner.jpg',
      alt: 'A stemmed glass of white wine in a VoChill chiller on a dinner table' }
  ];

  /* ---- option axes ------------------------------------------------------ */
  var PRODUCTS = [
    { key: 'stemless', code: 'SL', title: 'Stemless Wine Chiller Pair',
      tab: 'Stemless Wine Chiller Pair', thumb: 'assets/img/thumb-pair.jpg',
      productId: 8952152785140, handle: 'stemless-wine-chiller',
      media: STEMLESS_MEDIA,
      subtitleHtml: 'Keep Your Wine Perfectly Chilled Right in Your Glass,<br>No more warm wine halfway through a glass. Game changer.',
      reviews: 238,
      checks: [
        'Keeps wine cold for up to 2 hours indoors, 1.5 hours outdoors',
        'Works with any standard stemless wine glasses',
        'Patented Chill Cradle™ nothing ever enters your glass',
        'Strong magnetic connection holds the cradle securely in place',
        'Made in the USA · Designed and assembled in Austin, TX'
      ],
      note: '',
      discount: 0.10,
      bundleThumbs: { single: 'assets/img/thumb-single.jpg', couple: 'assets/img/thumb-pair.jpg',
                      cradles: 'assets/img/thumb-pair-cradles.jpg' } },
    { key: 'stemmed', code: 'ST', title: 'Stemmed Wine Chiller Pair',
      tab: 'Stemmed Wine Chiller Pair', thumb: 'assets/img/thumb-stemmed.jpg',
      productId: 8952154816756, handle: 'stemmed-wine-chiller',
      media: STEMMED_MEDIA,
      subtitleHtml: 'Perfectly Chilled Wine—From First Sip to Last<br>No ice. No dilution. No warm wine.',
      reviews: 247,
      checks: [
        'Designed to work with most standard stemmed wine glasses',
        'Perfect for patios, dinners, and unwinding at home',
        'Keeps your wine perfectly chilled for up to 90 minutes'
      ],
      note: '',
      discount: 0.15,
      bundleThumbs: { single: 'assets/img/thumb-stemmed-single.jpg', couple: 'assets/img/thumb-stemmed.jpg',
                      cradles: 'assets/img/thumb-stemmed.jpg' } }
  ];

  var BUNDLES = [
    { key: 'single',  code: '1',  label: 'Single',      thumb: 'assets/img/thumb-single.jpg' },
    { key: 'couple',  code: '2',  label: 'Couple Pair', badge: 'Most Popular', thumb: 'assets/img/thumb-pair.jpg' },
    { key: 'cradles', code: '2C', label: 'Couple Pair + 2 Chill Cradles', badge: 'Best Value',
      labelHtml: 'Couple Pair +<br>2 Chill Cradles', thumb: 'assets/img/thumb-pair-cradles.jpg' }
  ];

  var COLORS = [
    { key: 'quartz',  code: 'QTZ', title: 'Quartz'  },
    { key: 'onyx',    code: 'ONX', title: 'Onyx'    },
    { key: 'stone',   code: 'STN', title: 'Stone'   },
    { key: 'blush',   code: 'BSH', title: 'Blush'   },
    { key: 'sand',    code: 'SND', title: 'Sand'    },
    { key: 'glacier', code: 'GLC', title: 'Glacier' },
    { key: 'rose',    code: 'ROS', title: 'Rose', soldOut: true },
    { key: 'cyan',    code: 'CYN', title: 'Cyan'    },
    { key: 'noir',    code: 'NOR', title: 'NOIR'    }
  ];
  COLORS.forEach(function (c) { c.thumb = 'assets/img/product-' + c.key + '.jpg'; });

  /* List prices in cents. Stemless figures are the live store's list prices;
     Stemmed Couple Pair ($99.90) is from the stemmed product page; Stemmed
     Single / + Cradles follow the same step-up (flagged in the README).
     Sale price = list × (1 − product discount), rounded DOWN to the cent —
     that's what gives the stemmed page's exact $84.91 from $99.90. */
  var LIST_PRICE = {
    stemless: { single: 4495, couple: 8995, cradles: 14995 },
    stemmed:  { single: 4995, couple: 9990, cradles: 15995 }
  };

  /* Real Shopify variant IDs for combinations the live store sells. */
  var REAL_IDS = {
    'stemless/single/quartz':  46185280438516,
    'stemless/single/noir':    46189873135860,
    'stemless/couple/quartz':  46959037743348,
    'stemless/cradles/quartz': 42814999429364,
    'stemless/cradles/sand':   42814999527668,
    'stemless/cradles/glacier':44257765654772,
    'stemless/cradles/stone':  42814999494900,
    'stemless/cradles/blush':  42814999462132,
    'stemless/cradles/cyan':   45990501777652,
    'stemless/cradles/rose':   45990501122292,
    'stemless/cradles/onyx':   45974400434420,
    'stemmed/single/quartz':   46185292464372,
    'stemmed/single/noir':     46189980025076
  };

  /* ---- build the flat variant list -------------------------------------- */
  var variants = [];
  var mockSeq = 0;

  PRODUCTS.forEach(function (p) {
    BUNDLES.forEach(function (b) {
      COLORS.forEach(function (c) {
        var key = p.key + '/' + b.key + '/' + c.key;
        var list = LIST_PRICE[p.key][b.key];
        mockSeq += 1;
        variants.push({
          id: REAL_IDS[key] || (9100000000000 + mockSeq),
          key: key,
          sku: 'VC-' + p.code + '-' + b.code + '-' + c.code,
          productKey: p.key, bundleKey: b.key, colorKey: c.key,
          productTitle: p.title,
          productId: p.productId,
          handle: p.handle,
          title: b.label + ' / ' + c.title,        // Shopify-style variant title
          price: Math.floor(list * (1 - p.discount) + 1e-6),   // epsilon guards float error
          compareAt: list,
          available: !c.soldOut,
          image: { src: c.thumb, alt: p.title + ' in ' + c.title }
        });
      });
    });
  });

  VC.product = {
    brand: 'VoChill',
    category: 'Wine Chillers',
    currency: 'USD',
    products: PRODUCTS,
    bundles: BUNDLES,
    colors: COLORS,
    variants: variants,
    defaults: { product: 'stemless', bundle: 'single', color: 'quartz' }
  };

  /* ---- helpers ---------------------------------------------------------- */

  function byKey(list, key) {
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    return null;
  }
  VC.product.getProduct = function (key) { return byKey(PRODUCTS, key); };
  VC.product.getBundle  = function (key) { return byKey(BUNDLES, key); };
  VC.product.getColor   = function (key) { return byKey(COLORS, key); };

  /** The variant for a product/bundle/colour selection. */
  VC.product.resolve = function (productKey, bundleKey, colorKey) {
    var key = productKey + '/' + bundleKey + '/' + colorKey;
    for (var i = 0; i < variants.length; i++) if (variants[i].key === key) return variants[i];
    return null;
  };

  VC.product.findVariant = function (id) {
    for (var i = 0; i < variants.length; i++) {
      if (String(variants[i].id) === String(id)) return variants[i];
    }
    return null;
  };

  var formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: VC.product.currency
  });

  /** 6090 -> "$60.90" */
  VC.formatMoney = function (cents) {
    return formatter.format(cents / 100);
  };

  /** 6090 -> 60.9  (dataLayer wants a number, not a string) */
  VC.toAmount = function (cents) {
    return Math.round(cents) / 100;
  };
})(window);
