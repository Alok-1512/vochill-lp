/* ==========================================================================
   mock-cart-api.js  —  THE MOCK. Nothing here ships to a real store.

   It replaces window.fetch, answers /cart/add.js and /cart.js with
   Shopify-shaped responses, and lets every other request through untouched.
   cart.js never knows. To go live: delete this file's <script> tag
   (or open the page with ?live=1).

   QA switches:
     ?mockFail=1        make the add fail with a 422
     ?mockLatency=1200  change the fake network delay (ms)
   ========================================================================== */
(function (window) {
  'use strict';

  var VC = (window.VC = window.VC || {});
  var params = new URLSearchParams(window.location.search);

  if (params.get('live') === '1') return;   // real fetch, no mock

  var realFetch = window.fetch.bind(window);
  var latency = Number(params.get('mockLatency')) || 550;
  var cartItems = [];                        // the fake store's cart

  function reply(body, status) {
    return new Response(JSON.stringify(body), { status: status || 200 });
  }

  function fail(status, description) {
    return reply({ status: status, message: 'Cart Error', description: description }, status);
  }

  function cartPayload() {
    var total = 0, count = 0;
    cartItems.forEach(function (item) { total += item.line_price; count += item.quantity; });
    return { items: cartItems, total_price: total, item_count: count, currency: VC.product.currency };
  }

  function addToMockCart(line) {
    var variant = VC.product.findVariant(line.id);
    var existing = cartItems.find(function (item) { return item.variant_id === variant.id; });

    if (existing) {                          // same variant merges into one line
      existing.quantity += line.quantity;
      existing.line_price = existing.price * existing.quantity;
      return existing;
    }

    var item = {
      id: variant.id,
      variant_id: variant.id,
      product_id: variant.productId,
      quantity: line.quantity,
      properties: line.properties || {},
      title: variant.productTitle + ' - ' + variant.title,
      product_title: variant.productTitle,
      variant_title: variant.title,
      sku: variant.sku,
      price: variant.price,                  // cents, as Shopify sends
      line_price: variant.price * line.quantity,
      featured_image: { url: variant.image.src }
    };
    cartItems.push(item);
    return item;
  }

  function handleAdd(options) {
    var line = JSON.parse(options.body).items[0];
    var variant = VC.product.findVariant(line.id);

    if (!variant)              return fail(404, 'Cannot find variant with id ' + line.id);
    if (!(line.quantity >= 1)) return fail(422, 'Quantity must be a whole number of 1 or more.');
    if (!variant.available)    return fail(422, 'This variant is sold out.');
    if (params.get('mockFail') === '1') {
      return fail(422, 'Simulated failure (?mockFail=1): this item could not be added to the cart.');
    }

    return reply({ items: [addToMockCart(line)] });
  }

  window.fetch = function (url, options) {
    options = options || {};
    var path = String(url);

    var isAdd = path.indexOf('/cart/add.js') !== -1;
    var isCart = /\/cart\.js$/.test(path);
    if (!isAdd && !isCart) return realFetch(url, options);   // not ours

    return new Promise(function (resolve) { setTimeout(resolve, latency); }).then(function () {
      return isAdd ? handleAdd(options) : reply(cartPayload());
    });
  };
})(window);
