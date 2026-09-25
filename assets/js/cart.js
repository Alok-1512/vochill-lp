/* ==========================================================================
   cart.js  —  THE REQUEST. This is the code that would ship.

   A plain fetch() POST to Shopify's AJAX Cart API. It has no idea the store
   is fake: the mock (mock-cart-api.js) intercepts fetch() from the outside.

   Reference: https://shopify.dev/docs/api/ajax/reference/cart
   ========================================================================== */
(function (window) {
  'use strict';

  var VC = (window.VC = window.VC || {});

  /**
   * POST /cart/add.js with the selected variant ID and quantity.
   * Resolves with Shopify's response, rejects with an Error whose message is
   * Shopify's own `description`.
   */
  async function addItem(line) {
    var response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          id: line.id,                 // the VARIANT id
          quantity: line.quantity,
          properties: line.properties  // optional line-item properties
        }]
      })
    });

    if (!response.ok) {
      var error = await response.json();
      throw new Error(error.description);
    }
    return response.json();
  }

  /** GET /cart.js — the current cart, used to fill the drawer. */
  async function getCart() {
    var response = await fetch('/cart.js');
    return response.json();
  }

  VC.Cart = { addItem: addItem, getCart: getCart };
})(window);
