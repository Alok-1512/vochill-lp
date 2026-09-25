# VoChill landing page — study guide

Purpose: so you can explain, defend and modify every part of this build when
Malav cross-questions you. Read it top to bottom once, then use the
**cross-question bank** (section 12) as a drill.

> Not part of the submission ZIP. It is your prep document.

---

## 0. The 60-second pitch (say this first)

"It's a single HTML page with one stylesheet and seven small vanilla-JS files,
no libraries. The product section is data-driven: a catalogue of 2 products ×
3 bundles × 9 colours = 54 variants, each with its own variant ID, SKU and
price. Picking options resolves one variant, and that one object drives
everything — the price on screen, the request sent to `/cart/add.js`, and the
dataLayer event. The cart request logic is real Shopify AJAX (a genuine
`Request`, JSON body, `Response` parsing); the fake store is a separate file
that just replaces `fetch`. `add_to_cart` fires only inside the success branch
of that request; `view_item` fires once, when the product section first scrolls
into view."

If you can say that and then draw the diagram in section 1, you have covered
70 % of what will be asked.

---

## 1. Big picture

```
 index.html ── loads ──►  product-data.js   (the catalogue: VC.product)
                          mock-cart-api.js  (the fake store: VC.MockCartAPI.transport)
                          cart.js           (REAL request logic: VC.Cart)
                          tracking.js       (dataLayer: VC.Tracking)
                          gallery.js        (carousel + lightbox: VC.Gallery)
                          accordion.js      (FAQ: VC.Accordion)
                          main.js           (glue — runs last)

 user picks product / bundle / colour
        │
        ▼
 main.js  state {product, bundle, color}  ──►  VC.product.resolve(...)  ──►  ONE variant object
        │                                                                       {id, sku, price, title, productId...}
        ├──► price block, title, sticky bar, gallery (what you SEE)
        │
 user clicks Add to Cart
        │
        ▼
 VC.Cart.addItem({id: variant.id, quantity, properties})
        │   builds Request  POST /cart/add.js  (JSON)
        ▼
 VC.Cart.transport(request)  ── (mock)  VC.MockCartAPI.transport  ──► Response (real Response object)
        │                       (live)   window.fetch
        ▼
 parse(response): ok → JSON body,  not ok → throw CartError
        │
   success path only:
        ├──► VC.Tracking.fireAddToCart(variant, qty)   → dataLayer.push
        ├──► VC.Cart.getCart()  (GET /cart.js)          → renders the drawer
   failure path: error text in the page, NO dataLayer event
```

The single idea to remember: **one resolved `variant` object is the source of
truth.** The UI, the request and the tracking all read from it, so they cannot
disagree.

---

## 2. Script loading and structure

At the bottom of `index.html`:

```html
<script src="assets/js/product-data.js" defer></script>
<script src="assets/js/mock-cart-api.js" defer></script>
<script src="assets/js/cart.js" defer></script>
<script src="assets/js/tracking.js" defer></script>
<script src="assets/js/gallery.js" defer></script>
<script src="assets/js/accordion.js" defer></script>
<script src="assets/js/main.js" defer></script>
```

- `defer` = download in parallel, run **in order** after the HTML is parsed. So
  `main.js` can safely assume everything above already defined `window.VC.*`.
- They are **classic scripts, not ES modules**, so the page also works when you
  double-click `index.html` (modules are blocked on `file://` by CORS).
- Every file is wrapped in an IIFE `(function (window, document) { 'use strict'; … })(window, document);`
  so its variables stay private, and it publishes only what others need onto
  one namespace: `window.VC`. That is why the first line of each file is
  `var VC = (window.VC = window.VC || {});` — "use the namespace if it exists,
  otherwise create it".
- Code style is deliberately ES5 (`var`, `function`, no arrows) for wide browser
  support. If asked "why not modern JS?": safest for unknown browsers and no
  build step; would use ES modules + a bundler in a real theme.

In `<head>`:

```html
<script>window.dataLayer = window.dataLayer || [];</script>
```

Runs before everything so nothing can `push` to an undefined array — the same
place the Google Tag Manager snippet would create it.

---

## 3. `product-data.js` — the catalogue

Purpose: one source of truth for IDs and prices (in a real Shopify theme this
would be emitted by Liquid from the product JSON).

| Part | What it does |
|---|---|
| `VIDEO`, `STEMLESS_MEDIA`, `STEMMED_MEDIA` | The gallery slides for each product: `{type:'image'|'video', src, alt}`; the video also has a `poster`. |
| `PRODUCTS` | Two products. Each has `key`, `code` (used in SKUs), `title`, `productId` (Shopify product ID), `handle`, `media`, subtitle HTML, review count, checklist, `note` (empty for both now), `discount` (0.10 or 0.15), and `bundleThumbs`. |
| `BUNDLES` | Single (`code '1'`), Couple Pair (`'2'`, `badge: 'Most Popular'`), Couple Pair + 2 Chill Cradles (`'2C'`, `badge: 'Best Value'`). The optional `badge` becomes the tab hanging under that bundle card. |
| `COLORS` | 9 colours; **Rose has `soldOut: true`**. Each gets `thumb = product-<key>.jpg`. |
| `LIST_PRICE` | List prices in **cents** per product × bundle. |
| `REAL_IDS` | Real Shopify variant IDs for combinations the live store sells. |
| The three nested `forEach` loops | Build the flat `variants` array: one object per product × bundle × colour (2×3×9 = 54). |

The variant object:

```js
{
  id: REAL_IDS[key] || (9100000000000 + mockSeq),   // Shopify variant ID (real or mock)
  key: 'stemless/couple/quartz',
  sku: 'VC-SL-2-QTZ',                                // VC-<product>-<bundle>-<colour>
  productKey, bundleKey, colorKey,
  productTitle, productId, handle,
  title: 'Couple Pair / Quartz',                     // Shopify-style variant title
  price: Math.floor(list * (1 - p.discount) + 1e-6), // sale price, cents
  compareAt: list,                                   // list price, cents
  available: !c.soldOut,
  image: { src, alt }
}
```

Points to be able to explain:

- **Money is in cents (integers)**, exactly like Shopify's AJAX API. Only
  converted to dollars at the edges: `VC.formatMoney(cents)` for display
  (`Intl.NumberFormat`, → `"$40.45"`) and `VC.toAmount(cents)` for the
  dataLayer (→ `40.45`, a number). Integers avoid floating-point money bugs.
- **Sale price** = list × (1 − discount) **rounded down** to the cent
  (`Math.floor`). The `+ 1e-6` guards a float error where e.g. 99.9 × 0.85 lands
  at 84.9149999… and would floor one cent too low. Stemmed couple pair:
  $99.90 → $84.91 (exactly what the supplied stemmed page shows).
- **Real vs mock IDs:** only combinations the live store sells use real
  Shopify variant IDs; the rest are deterministic mock IDs (`91000000000xx`) so
  every one of the 54 combinations is addressable in the mock. They would 404
  on a real store — be upfront about that.
- Helpers: `getProduct/getBundle/getColor(key)`, `resolve(product, bundle, color)`
  (look up by the composite key), `findVariant(id)` (look up by variant ID —
  the mock uses this because a request only carries the ID).

---

## 4. `cart.js` — the real Shopify AJAX layer (know this cold)

This is "the code that would ship". Nothing here knows the store is fake.

### 4.1 Endpoints

```js
var ROOT = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
var ENDPOINTS = { add: ROOT + 'cart/add.js', get: ROOT + 'cart.js' };
```

On a real Shopify storefront, `window.Shopify.routes.root` is `'/'` or a
locale prefix like `'/en-ca/'`. Using it means the request hits the right URL
on international/localised stores. Fallback is `'/'`.

### 4.2 `buildAddRequest(lines)` — the exact request

```js
var body = {
  form_type: 'product',          // hidden input of a Shopify product form
  utf8: '✓',                // ✓ — also a hidden input (legacy Rails-ism)
  items: lines.map(function (line) {
    var id = Number(line.id);
    if (!isFinite(id) || id <= 0) throw new Error('A valid variant id is required…');
    var item = { id: id, quantity: Math.max(1, parseInt(line.quantity, 10) || 1) };
    if (line.properties) item.properties = line.properties;
    if (line.selling_plan) item.selling_plan = line.selling_plan;
    return item;
  })
};
return new Request(ENDPOINTS.add, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
             'X-Requested-With': 'XMLHttpRequest' },
  body: JSON.stringify(body),
  credentials: 'same-origin'
});
```

Line by line:

- **`items[]`** — Shopify's modern `/cart/add.js` accepts either form-encoded
  fields or JSON with an `items` array. JSON lets you add several lines in one
  call.
- **`id`** — the **variant ID** (not the product ID). This is the one thing
  Shopify truly requires to identify what to add. `Number(...)` because the
  API wants a number, not a string.
- **`quantity`** — whole number ≥ 1; `parseInt` + `Math.max(1, …)` sanitises
  it.
- **`properties`** — optional key/value "line item properties". Keys starting
  with `_` are **hidden** from the customer by themes but visible to the
  merchant/order. That's where we pass `_product_id`, `_sku`, `_source`,
  `_variation` (see 7.7).
- **Why the product ID is in `properties` and not a top-level parameter:**
  Shopify derives the product from the variant ID; there is no
  `product_id` parameter on `/cart/add.js`. Sending it as a hidden property
  makes it visible in the cart/order for reporting without breaking the API.
- **`selling_plan`** — subscription plan ID; supported but unused.
- **`form_type` / `utf8`** — what Shopify's own Dawn theme posts from a product
  form. Harmless extras that make the request look like a genuine theme
  request.
- **Headers:** `Content-Type: application/json` (tells Shopify how to parse the
  body), `Accept: application/json` (we want JSON back), `X-Requested-With:
  XMLHttpRequest` (classic marker that this is an AJAX call, which Shopify
  treats as such).
- **`credentials: 'same-origin'`** — send the cart cookie. The cart in Shopify
  is tied to a cookie; without it every add would create a new cart.
- It **returns a `Request` object, it does not send it.** Separating "build"
  from "send" is what makes the transport swappable and the builder testable.

`buildGetCartRequest()` is the same idea for `GET /cart.js`.

### 4.3 Response handling

```js
function parse(response) {
  return response.json()
    .catch(function () { return null; })          // body wasn't JSON (e.g. HTML 500 page)
    .then(function (body) {
      if (response.ok) return body;               // 2xx → give the JSON to the caller
      var description = (body && (body.description || body.message)) ||
                        ('Cart request failed with status ' + response.status);
      throw CartError(description, response.status, body);
    });
}
```

- `fetch` does **not** reject on HTTP 4xx/5xx — it only rejects on network
  failure. So we check `response.ok` ourselves and `throw` for non-2xx, which
  makes the promise reject. That rejection is what stops `add_to_cart` from
  firing.
- Shopify error bodies look like `{ status, message, description }`.
  `description` is the human-readable text we show in the page.
- `CartError` is an `Error` with `.status` and `.body` attached, so the UI (or a
  test) can inspect them.

### 4.4 Public API and the transport seam

```js
VC.Cart = {
  endpoints, buildAddRequest,
  transport: function (request) { return window.fetch(request); },   // default
  addItem: function (line) {
    var request = buildAddRequest([line]);
    return Promise.resolve(VC.Cart.transport(request)).then(parse);
  },
  getCart: function () {
    return Promise.resolve(VC.Cart.transport(buildGetCartRequest())).then(parse);
  }
};
```

- **`transport` is a plain function property** you can replace. In `main.js`
  (section 0) it is set to either `VC.MockCartAPI.transport` (default) or
  `window.fetch` (`?live=1`). That single assignment is the whole difference
  between "this assignment" and "a real store".
- `Promise.resolve(...)` wraps whatever the transport returns so a transport
  that returns a plain value also works.
- With `?debug=1`, `addItem` logs the outgoing JSON (via `request.clone()` — a
  body can be read only once, so we clone it first).

---

## 5. `mock-cart-api.js` — the fake store

Goal: behave like a Shopify storefront closely enough that `cart.js` cannot tell
the difference. It exports one thing: `VC.MockCartAPI.transport(request)` with
the **same signature as `fetch`** (takes a `Request`, returns a
`Promise<Response>`).

| Part | What it does |
|---|---|
| `CONFIG` | `?mockLatency=` (default 550 ms) and `?mockFail=1` (force a failure). |
| `store` | In-memory cart `{ token, items: [] }` — exists only for the page session. |
| `delay(ms)` | Promise that resolves after `ms` — simulates network time. |
| `json(body, status)` | Returns a **real `Response`** with a status and `Content-Type: application/json`. |
| `lineItem(variant, qty, properties)` | Builds a line item with the same fields Shopify returns: `id, variant_id, product_id, key, title, sku, price, original_price, line_price, final_line_price, properties, featured_image, handle, url, vendor, product_title, variant_title …` (money in cents). |
| `cartPayload()` | The `GET /cart.js` shape: `token, item_count, total_price, original_total_price, currency, items, requires_shipping …`. |
| `sameLine()` / `addLines()` | **Merge rule:** same variant **and** identical `properties` → increase quantity; otherwise a new line (that is Shopify's real rule). |
| `cartError(status, message, description)` | Shopify's error envelope `{status, message, description}`. |
| `handleAdd(body)` | Validation + business rules (below). |
| `transport(request)` | Routing (below). |
| `reset()` | Test hook to empty the cart. |

Validation in `handleAdd`, in order:

1. No `items` array / empty → **422** "Required parameter missing or invalid: items".
2. A line with a non-numeric/≤0 `id` → **422** (invalid id); a non-integer or <1 quantity → **422**.
3. Variant not in the catalogue → **404** "Cannot find variant with id …".
4. Variant `available: false` (Rose) → **422** "…is sold out".
5. `?mockFail=1` → **422** "Simulated failure…" (used to prove no tracking fires).
6. Otherwise add/merge lines → **200** `{ items: [...] }`.

Routing in `transport`:

- Waits `CONFIG.latency` ms, then:
- `GET …/cart.js` → 200 with `cartPayload()`.
- `POST …/cart/add.js` → if `Content-Type` isn't JSON → **415**; parse the body
  with `request.clone().json()` (clone so the original stays readable, as it
  must for a retry); invalid JSON → **400**; otherwise `handleAdd`.
- Anything else → **404**.

Why a *real* `Response` matters: `cart.js` calls `response.json()`,
`response.ok`, `response.status` — exactly the real API. Nothing in `cart.js`
needed changing to talk to the mock.

---

## 6. `tracking.js` — dataLayer

### 6.1 Page variation

```js
var VARIATIONS = { a: {id:'A', name:'control'}, b: {id:'B', name:'benefit-led-hero'} };
var requested = String(params.get('variation') || 'A').toLowerCase();
VC.pageVariation = VARIATIONS[requested] || VARIATIONS.a;
```

`?variation=B` shows different hero copy (`VARIATION_COPY` in `main.js`) and
that id is stamped into **every** ecommerce event and the cart line properties,
so a GTM trigger/report can split by variation. Anything unknown falls back to A.

### 6.2 Payload builders

```js
function itemPayload(variant, quantity) {
  return {
    item_id: variant.sku,                       // SKU
    item_product_id: String(variant.productId), // Shopify product ID
    item_variant_id: String(variant.id),        // Shopify variant ID
    item_name: variant.productTitle,
    item_brand: 'VoChill', item_category: 'Wine Chillers',
    item_variant: variant.title,                // "Couple Pair / Quartz"
    price: VC.toAmount(variant.price),          // UNIT price
    quantity: quantity
  };
}
function ecommercePayload(variant, quantity) {
  return { currency: 'USD', value: VC.toAmount(variant.price * quantity), items: [itemPayload(...)] };
}
```

- GA4 ecommerce schema. **`price` is per unit; `value` (event level) is the
  total** (unit × quantity). Mixing these up is a classic tracking bug.
- Both SKU and variant ID are sent because Meta's `content_ids` must match the
  *catalog's* ID and I don't know whether the catalog is keyed on SKU or
  variant ID — see the Meta explanation in section 11.

### 6.3 `pushEcommerce`

```js
window.dataLayer.push({ ecommerce: null });        // reset
window.dataLayer.push({ event, page_variation, page_variation_name, ecommerce: {...} });
```

The dataLayer **merges** objects. Without pushing `ecommerce: null` first, a
key from a previous event (e.g. an extra item field) can leak into the next
one. Google recommends the null reset.

### 6.4 `view_item` — once

```js
var viewItemFired = false;
function fireViewItem(variant) { if (viewItemFired) return; viewItemFired = true; pushEcommerce('view_item', variant, 1); }
```

`observeProductSection` uses `IntersectionObserver` with `threshold: 0.3`
(fire when ≥30 % of `#product` is visible), then **`observer.disconnect()`**
immediately. Two independent guards: the boolean latch and the disconnect. So
scrolling away and back cannot fire it again. If the browser has no
`IntersectionObserver`, it fires on load rather than never.

### 6.5 `add_to_cart`

`fireAddToCart(variant, quantity)` is a one-liner. The important part is **who
calls it**: only `main.js`'s success handler (7.6).

### 6.6 The inspector (`?debug=1`)

A QA aid, not part of the design: it wraps `dataLayer.push` (calls the original
first, so real GTM still receives everything) and mirrors each event with its
JSON into a panel, so events can be verified on a phone/hosted preview. Hidden
unless `?debug=1`.

---

## 7. `main.js` — the glue (section numbers match the comments in the file)

**0. Transport selection.** `useLiveCart = ?live=1`. Sets `VC.Cart.transport`
to `window.fetch` or the mock.

**1. State and element cache.**

```js
var state = { product, bundle, color, variant, quantity: 1, busy: false };
var el = { ...querySelector('[data-...]') };
```

Defaults come from `catalog.defaults` (stemless / single / quartz). `data-*`
attributes are the hooks JS uses, so class names can change without breaking
JS. **Quantity is always 1** because each bundle is its own variant (decided
earlier: "no selector, qty = bundle").

**2. Page variation.** Writes the id/name into the page and, for B, swaps hero
copy through `[data-var-slot]` nodes.

**3. Gallery + lightbox.** Creates the carousel (`VC.Gallery.create`), loads the
current product's media, creates the lightbox and wires the "+ Zoom" button to
`lightbox.open(gallery.index)`. While the lightbox is open the inline carousel
is paused (`setActive(false)`) so only one video plays; on close it resumes
on the slide where the lightbox ended.

**4. Pickers.**

- `optionButton()` builds a `role="radio"` button with thumbnail + label.
- `enableRovingFocus()` — arrow keys move focus **and** select, the standard
  radiogroup behaviour; only the checked item has `tabindex=0`.
- `syncRadios()` updates `aria-checked`/`tabindex`.
- `buildPickers()` creates product tabs, bundle cards and the colour list from
  the catalogue (nothing is hard-coded in HTML). Each bundle card is wrapped in
  a `.bundle-options__item`; when the bundle has a `badge` ("Most Popular" /
  "Best Value") a `<span class="bundle-options__badge">` is added under it and
  linked to the card with `aria-describedby`, so screen readers hear it too.
- **Colour dropdown** is a custom ARIA listbox (button `aria-haspopup="listbox"`,
  `aria-expanded`, `<ul role="listbox">` with `role="option"` items). Keyboard:
  ↑/↓/Home/End move, Enter/Space choose, Esc closes and returns focus, Tab
  closes. Clicking outside closes it. (Native `<select>` can't show swatch
  thumbnails — that's why it's custom.)

**5. `applySelection()` — the heart of the UI.**

1. `variant = catalog.resolve(state.product, state.bundle, state.color)`; store it.
2. Sync radio state.
3. **Only if the product changed** (`product.key !== renderedProduct`) swap
   product-level content: title, subtitle, review count, checklist, note,
   bundle thumbnails, and the gallery/lightbox media (restarting at slide 1).
   Guarding by product avoids resetting the gallery when only the colour changes.
4. Colour label/thumb and selected option.
5. Price block: `price`, `compareAt` (hidden when no discount), "Save $X".
6. Sticky bar name/price.
7. Availability: `setAddEnabled(variant.available)`, button label "Sold Out".
8. Clears any old feedback message.

**6. Feedback and busy state.** `setBusy(true)` disables both Add buttons, shows
the spinner and "Adding…". This is also the **double-click protection**
(together with the `state.busy` check).

**7. `addToCart()` — the flow to memorise.**

```js
function addToCart() {
  if (state.busy || !state.variant.available) return;   // guards
  var variant = state.variant, quantity = state.quantity; // SNAPSHOT at click time
  setBusy(true);
  VC.Cart.addItem({ id: variant.id, quantity: quantity,
      properties: { _product_id: String(variant.productId), _sku: variant.sku,
                    _source: 'landing-page', _variation: VC.pageVariation.id } })
    .then(function (added) {
      VC.Tracking.fireAddToCart(variant, quantity);   // ← ONLY here, after success
      setFeedback('Added to your cart.', 'success');
      return VC.Cart.getCart();                        // resync from GET /cart.js
    })
    .then(function (cart) { renderDrawer(cart); openDrawer(); })
    .catch(function (error) { setFeedback(error.message, 'error'); })   // no tracking
    .then(function () { setBusy(false); });                              // always
}
```

- **Snapshot:** `variant` and `quantity` are copied at click time, so if the
  user changes colour while the request is in flight, the event still describes
  what was actually added.
- **Why tracking is in `.then`:** if the request fails (422 sold out, network
  error), the promise rejects, the `.then` is skipped, and `.catch` runs —
  `add_to_cart` never fires. Firing on click would over-count failed adds.
- The trailing `.then(setBusy(false))` runs after either branch (like
  `finally`, written ES5-style).
- Called from the form `submit` (Enter key or click) and the mobile sticky bar's
  button.

**8. Cart drawer.** `renderDrawer(cart)` builds a list of `.drawer__line` items
from `cart.items` (image from `featured_image.url`, `product_title`,
`variant_title · Qty`, `line_price`) and the subtotal from `total_price` — i.e.
**it renders what the server said**, not what the UI assumed. `openDrawer` /
`closeDrawer` toggle `hidden` and an `is-open` class (for the CSS transition),
lock body scroll, move focus to the close button and back to the previous
element; Esc closes; Tab is trapped inside while open.

**9. Shop CTAs.** Any `[data-shop]` button (hero CTAs) scrolls to `#product` and
moves keyboard focus to the selected product tab.

**Sticky bar** (`el.stickyBar`, hook `data-sticky-bar`). On scroll (throttled with `requestAnimationFrame`), the mobile
buy bar shows once the real buy box has scrolled past, and hides near the
footer so it doesn't cover it. It's display-only on desktop (CSS).

**10. Accordion.** `VC.Accordion.create(root, {single: true})`.

**11. Boot.** `buildPickers(); applySelection(); onScroll();` then start the
`view_item` observer, passing a getter for the current variant.

---

## 8. `gallery.js` — carousel + lightbox (no library)

`create(root, options)` is used twice: the inline carousel and the lightbox.

- **Structure:** a `<ul>` track of slides; showing slide *i* = `transform:
  translate3d(-i*100%,0,0)` (CSS transitions it). Wrapping is modulo:
  `(i % n + n) % n`.
- **`render()`** builds slides and pagination dashes from the media array.
  Images get `loading="lazy"` except the first; a video slide creates a
  `<video muted loop playsinline preload="none" poster>` and stores the real URL
  in `data-src` — **the video file isn't requested until it first becomes
  active.**
- **`update()`** moves the track, marks the active dash (`is-active`,
  `aria-current`), sets `aria-hidden` on off-screen slides, updates a
  visually-hidden live region ("Slide 2 of 6"), then `syncVideos()`.
- **`syncVideos()`** plays the active slide's video only when the carousel is
  `active` (not covered by the lightbox) **and** `onScreen`; pauses all others.
  With `prefers-reduced-motion` it never autoplays and shows native controls.
- **Input:** ←/→ keys (on the root), click the dashes, click left/right halves
  of the image (invisible buttons `data-gallery-prev/next`), and pointer swipe.
- **Hover arrow (desktop mouse only):** a round arrow element follows the
  mouse (`pointermove` on the zone, ignoring non-mouse pointers) and shows a
  left or right arrow depending on the half; hidden on touch by CSS
  `@media (hover:none)`. The bubble has `pointer-events:none` — if it could
  receive the mouse it would steal the hover from the zone, fire `pointerleave`,
  hide itself and re-appear, which is exactly the flicker bug that was fixed.
- **"+ Zoom" button:** only the `+` shows by default; the word "Zoom" fades in
  (CSS `max-width` + `opacity` transition) on `:hover` / `:focus-visible`. On
  touch there is no hover, so only the `+` shows.
- **Swipe (`enableSwipe`)**: `pointerdown` records the start; `pointermove`
  (on `window`) decides **once** whether the gesture is horizontal or vertical
  (`|Δy| > |Δx|` → abandon so the page can still scroll); once locked the
  track follows the finger (`Δx / width * 100 %`). On `pointerup`, a drag
  beyond `min(20 % of width, 60 px)` changes slide; otherwise it snaps back.
  A capture-phase click handler swallows the click that follows a drag so a
  swipe doesn't count as a tap.
- **`IntersectionObserver`** (only when `observeVisibility`): pauses the video
  when the carousel scrolls off screen.
- **`createLightbox(box, media, callbacks)`** wraps a second `create` instance
  (`active:false`, lazy images). `open(i)` shows it (`hidden=false`, locks body
  scroll, jumps to slide *i*, focuses the close button); `close()` reverses it
  and reports the slide it ended on so the inline gallery follows.
  Backdrop click and Esc close; Tab is trapped (wraps first ↔ last button).

---

## 9. `accordion.js` — FAQ (no library)

- Pattern: **WAI-ARIA disclosure**. Each question is a `<button
  aria-expanded aria-controls>` inside a heading; the answer is a panel.
- **Height animation trick:** you can't CSS-transition `height: auto`. So on
  open: un-hide the panel, measure the content height, set `height:0`, force a
  reflow (`void panel.offsetHeight`), then set `height: <measured>px`; the CSS
  transition animates 0 → measured. On `transitionend`, the height is set back
  to `auto` so it can reflow (window resize, font swap) without going stale.
  Closing does the reverse (current px → 0, then `hidden=true`).
- `hidden` on closed panels keeps them out of the tab order and screen readers.
- `single: true` closes the others when one opens.
- Reduced motion: skips the animation.
- A debounced `resize` handler re-releases open panels to `auto`.
- Adds an `is-open` class to the item (used for styling the border; replaced a
  `:has()` selector for browser support).

---

## 10. HTML and CSS

### HTML

Semantic landmarks: one `<main>`, sections with `aria-labelledby`, one `<h1>`
(hero), `<h2>` per section, a real `<table>` with `scope` attributes for the
comparison, skip link to `#product`. Section order (as the page reads):

1. Hero — 2. Claims bar — 3. Sounds Familiar — 4. Product — 5. Customers Speak
(testimonials) — 6. Simple by Design (How It Works) — 7. The Real Difference —
8. Comparison table ("Why Choose Our Wine Chillers") — 9. FAQ — footer image.

The product buy box's pickers are **empty containers filled by JS** from the
catalogue, plus a static fallback price so nothing looks broken before JS runs
(kept equal to the JS result).

### Naming conventions (BEM)

Classes are `block__element--modifier`, kebab-case, and blocks are named after
the section they belong to:

| Section | Block | Notes |
|---|---|---|
| Hero | `.hero` | `.hero__copy`, `.hero__media`, `.hero__cta`, `.hero__proof` |
| Claims bar | `.claims-bar` | `__list`, `__item` |
| Sounds Familiar / The Real Difference | `.split-section` + `.sounds-familiar` or `.real-difference` | shared layout: `__inner`, `__copy`, `__title`, `__body`, `__features`, `__media`; feature rows are `.feature-card`; the overlapping review is `.floating-review` |
| Product | `.product` | `.product-tabs__tab`, `.bundle-options__item/__card/__badge`, `.color-select__*`, `.product-details__*` (title, price, checks, …), `.gallery__*` |
| Customers Speak | `.testimonials` | cards are `.review-card__*` |
| How It Works | `.how-it-works` | steps are `.step-card__*` |
| Comparison table | `.comparison` | `__table`, `__rowhead`, `__col`, `__cell--us/--alt`, `__cta`, `__returns` |
| FAQ | `.faq`, `.accordion__*` | |
| Footer | `.site-footer` | one full-width image |
| Overlays | `.drawer`, `.lightbox`, `.sticky-bar`, `.datalayer-chip/-panel` | |
| Shared | `.container`, `.section-head/-title/-lede`, `.eyebrow`, `.btn`, `.stars` | |

State classes are `is-*` (`is-open`, `is-active`, `is-visible`, `is-locked`).
Anything JavaScript needs to find uses a `data-*` attribute, not a class.
Section ids match the block name (`#how-it-works`, `#comparison`,
`#testimonials`, `#real-difference`, `#faq`, `#product`).

### CSS organisation (one file)

1. `@font-face` — self-hosted woff2: Cormorant (variable, roman + italic),
   Inter (variable), Nunito (variable), Studio Feixen Sans Bold, Georgia Italic.
2. Tokens on `:root`: font names (each token names **only** its font, no
   system fallback — `--font-sans: 'Inter'` etc.), `--container:1360px`,
   `--container-wide:1600px`, `--gutter`, `--pad-k`, radii, motion.
3. Reset/base. 4. Primitives (buttons, stars, eyebrow, section titles).
5. Sections (5.1 Hero … 5.9 Footer, in file order). 6. Overlays (drawer, sticky
   bar, inspector). 7. Responsive (tiers + a phone type-scale block at the end).

### Breakpoints and how the page adapts

| Width | What changes |
|---|---|
| ≥ 1400 px | Full desktop. Contained content caps at 1360 px, the claims bar and footer at 1600 px. |
| 1024–1399 px | Two-column layouts stay; claims-bar spacing tightens; 1024–1100 also shrinks the floating review card. |
| 768–1023 px | Tablet: every two-column section becomes one column, How It Works becomes 2 × 2, testimonials scroll sideways. Section padding × .75. |
| ≤ 767 px | Phone: one type scale (titles 26 / body 14 / small 12 / tiny 10), rotating claims strip, square hero image, section padding × .55. |

### Per-section cheat sheet (what to say if asked "how is X built?")

- **Hero.** 2-column grid. The image column is exactly half the section, edge to
  edge, 1:1, capped at 680 px tall (`object-fit: cover`). The text column is a
  flex column whose children are `min(100%, 610px)` wide, pushed right so there
  is exactly 62 px to the image; its left padding is `max(gutter, (100vw −
  1360px) / 2)` so the text lines up with the 1360 container. Buttons are 414 ×
  52, radius 43.73 px, 10 px apart.
- **Claims bar.** Five `<li>` with a white 1 px divider (a `::before`), 40 px
  each side of every divider. On phones the list becomes a 48 px tall stack of
  absolutely positioned items and one CSS keyframe (`claims-bar-rotate`, 15 s)
  fades each in for 3 s with staggered `animation-delay`s — no JavaScript.
- **Sounds Familiar / The Real Difference.** One shared component
  (`.split-section`): grid `672fr 580fr`, column gap 120 px (from 1400 px),
  copy max 672 px with 30.5 px vertical padding, image `width:100%; max-width:
  580px; height:auto`. Heading and body have a 153 px minimum height. Feature
  cards: 10 px padding (63 px on the right), 17.5 px icon gap, 10 px radius.
  Sounds Familiar adds the `.floating-review` card (absolute, hanging past the
  image's left edge on desktop; a normal block overlapping the image bottom by
  44 px at ≤ 1023 px).
- **Product.** Grid `702fr 549fr`, column gap 110 px. Gallery on the left
  (square corners), buy box on the right with 15 px vertical rhythm. See
  sections 7 and 8 for behaviour.
- **Customers Speak.** Three cards in a grid (30 px gap, 36 px padding, 22 px
  radius, only a 0.8 px top border, 340 px min-height); on ≤ 1023 px the grid
  becomes a horizontal scroll-snap row. Stars use the shared mask component.
- **Simple by Design.** Dark section, 46 px gap between four cards, image
  `width:100%; height:auto`, number badge with mint border, Nunito body.
- **Comparison table.** A real `<table>`; wrapper `max-width:1182px` centred,
  no radius; columns 50 / 25 / 25 % (38 / 31 / 31 on phones so text doesn't
  wrap badly); header font is Studio Feixen Sans.
- **FAQ.** White section, Nunito title, cards with a 1 px `#9BE0DE` border and
  10 px radius, 10 px between them. Behaviour in section 9.
- **Footer.** A single full-width image (`footer.jpg`, max 1600 px) on
  `#FAF9F7`; no text footer.

### Key techniques to be able to explain

- **`.container`**: `max-width: calc(var(--container) + var(--gutter) * 2)` +
  `padding-inline: var(--gutter)` → content is exactly 1360 px on wide screens
  and gets a gutter on small ones. `.container--wide` does the same at 1600 px.
- **Stars:** one element with a star-shaped **CSS mask** (the supplied SVG path);
  a child's width = `rating / 5 * 100 %` clipped to that mask gives fractional
  ratings (4.8 stars) with no images. One size (16.5 px) and colour
  (`--gold: #F6A429`) everywhere.
- **Section padding:** each section sets `--pad-d` (its desktop value: 73.5 /
  73 / 93.45 / 85 / 75 / 0 / 85 px); `padding-block: calc(var(--pad-d) *
  var(--pad-k))` with `--pad-k` = 1 / .75 / .55 at desktop / tablet / phone.
- **Specificity gotcha:** a section-specific two-column rule such as
  `.split-section .split-section__inner` is *more specific* than the shared
  single-column rule inside a media query, so the stacked layout is restated in
  a later media block. Same reason table paddings are restated for ≤ 1023 / ≤ 767.
- **`[hidden]{display:none!important}`** globally, because component `display`
  rules would otherwise override the `hidden` attribute.
- **Fonts.** Only the five real fonts are named anywhere. The Inter file was
  rebuilt from the full Inter 4 variable font (subset to Latin + punctuation +
  arrows) because the first subset had no `→` glyph, so the arrow in "Get the
  Wine Chillers →" silently fell back to the system font. The ✅ emoji is the
  one thing a browser must draw with the device's emoji font.

---

## 11. Tracking theory you must be able to speak to

**Meta `AddToCart` mapping** (GTM tag reads the dataLayer):

| dataLayer | Meta |
|---|---|
| `items[].item_variant_id` or `item_id` | `content_ids` |
| — | `content_type: 'product'` |
| `items[].item_name` | `content_name` |
| `items[].quantity`, `items[].price` | `contents[{id, quantity, item_price}]` |
| `ecommerce.value` | `value` |
| `ecommerce.currency` | `currency` |

- The thing that breaks in production is **`content_ids` not matching the
  catalog feed** → the event isn't attributed to a product (0 % catalog match).
  Shopify's Facebook channel usually keys on variant ID (sometimes with a
  prefix); manual feeds often use SKU. That's why both are in the payload.
- **Verify:** built-in `?debug=1` inspector; GTM Preview; Meta Pixel Helper
  (one pixel, one event); Events Manager → Test Events and Diagnostics (catalog
  match); Network tab (200 from `/cart/add.js` *before* the event); the negative
  test (`?mockFail=1` → zero events); GA4 DebugView.
- **Avoid duplicates:** audit first — Shopify's Facebook & Instagram channel
  already fires `AddToCart`; adding a GTM tag on top doubles it. One owner per
  event. If browser + server (Conversions API) both send it, use a shared
  `event_id`/`eventID` so Meta dedupes on `(event_name, event_id)` within 48 h.
  Trigger on the specific dataLayer event with a firing limit, not a generic
  click. In this build the guard is in the source: one push site, inside the
  success branch; button disabled during the request.

---

## 12. Cross-question bank

**Architecture**

1. *Why separate mock from real logic?* So the shipped code (`cart.js`) never
   contains fake behaviour; going live = replace one function (`transport`).
   The mock returns real `Response` objects so parsing/error paths are the same.
2. *How would you go live?* Delete `mock-cart-api.js`, set `transport` to
   `window.fetch` (that's already what `?live=1` does), and emit real variant
   IDs from Liquid instead of `product-data.js`.
3. *Why not fetch/XHR directly in the click handler?* Untestable, and it mixes
   UI, network and tracking. Layers: UI → `Cart` (protocol) → `transport`.
4. *Why a namespace `window.VC`?* Classic scripts share one global scope; one
   namespace avoids collisions without modules.
5. *Why no modules/frameworks?* Requirement (no libraries) and `file://`
   compatibility.

**Shopify AJAX**

6. *What does `/cart/add.js` need?* At minimum `items[].id` = variant ID and
   `quantity`. Optional: `properties`, `selling_plan`. The product ID is implied
   by the variant.
7. *Why is the product ID in `properties`?* No such API parameter exists; a
   hidden (`_`) property puts it on the line item for reporting without
   breaking anything.
8. *Why check `response.ok`?* `fetch` only rejects on network failure, not HTTP
   errors.
9. *Why `credentials: 'same-origin'`?* The cart lives in a cookie.
10. *Why `GET /cart.js` after adding?* Resync from the source of truth — totals,
    merged quantities, discounts — rather than trusting local assumptions.
11. *Shopify error format?* `{status, message, description}`; 422 for cart
    errors (e.g. sold out), 404 unknown variant.
12. *What if the same variant is added twice?* Shopify merges into one line (if
    properties match). The mock does too.
13. *What does `Shopify.routes.root` do?* Locale/market prefix so the request
    goes to `/en-ca/cart/add.js` on localised stores.

**Tracking**

14. *When does `add_to_cart` fire?* Only inside the success `.then` of the add
    request. Failure = no event (proved with `?mockFail=1`).
15. *When does `view_item` fire?* Once, first time ≥30 % of `#product` is
    visible; latch + `disconnect()`.
16. *Why `ecommerce: null` first?* dataLayer merges; avoids stale keys.
17. *`price` vs `value`?* Unit price vs total (unit × qty).
18. *How do you prevent double firing on double click?* Button disabled while
    busy + `state.busy` guard + one push site.
19. *What's `page_variation` for?* A/B reporting; echoed into every event and
    cart property.
20. *Meta dedupe?* See section 11.
21. *Why send both SKU and variant ID?* `content_ids` must match the catalog
    key, unknown ahead of time.

**JavaScript**

22. *What is a closure here?* Each file's IIFE keeps state private (e.g.
    `viewItemFired`, `store`).
23. *Explain the swipe logic.* Section 8.
24. *Why snapshot `variant` in `addToCart`?* User may change options during the
    ~550 ms request.
25. *How is the FAQ height animated?* Measure → 0 → reflow → target →
    `transitionend` → `auto`.
26. *Accessibility choices?* Radiogroups with roving focus, listbox, disclosure,
    `aria-live` for cart feedback, focus trap/restore in drawer and lightbox,
    reduced-motion, skip link, real table.
27. *Performance choices?* Lazy images, lazy video, preload of two fonts,
    self-hosted fonts, no dependencies.

**CSS / responsive**

28. *How are breakpoints chosen?* 767 / 1023 / 1399 (+ a 1024–1100 tweak); above
    1400 the content caps at 1360/1600.
29. *How is the mobile type consistent?* One block at the end of the stylesheet
    sets titles 26 / body 14 / small 12 / tiny 10.
30. *How does the star rating show 4.8?* Mask + width percentage.
31. *Why is the hero image edge-to-edge?* Design spec: 50 % of the section, no
    padding/radius, max 680 px high; text column aligned to the 1360 container.

**Naming / structure**

32. *What naming convention did you use?* BEM (`block__element--modifier`),
    blocks named after sections, `is-*` for state, `data-*` for JS hooks.
33. *Why one shared `.split-section`?* Sounds Familiar and The Real Difference
    are the same layout with different content; one component, two modifiers
    (`.sounds-familiar`, `.real-difference`).
34. *How did you rename everything safely?* A scripted rename, then a
    before/after check of every element's computed style and position at five
    screen sizes plus pixel-identical full-page screenshots.
35. *Why are the fonts named without fallbacks?* Requirement: render only the
    brand fonts. The cost is that a missing font file would show the browser
    default — acceptable because the fonts are self-hosted.
36. *Why is the footer just an image?* That is the supplied design (the brand
    mark on off-white); a text footer was removed on request.
37. *Why does the comparison table cap at 1182 px?* Design spec; it is centred
    with `margin-inline: auto`.

**Honest limitations (say these before they ask)**

- Only tested in Chrome; not Firefox/Safari/iOS. Hover arrows verified by
  forcing hover state.
- Mock variant IDs (except real ones) would not work on a real store.
- Fonts: Studio Feixen Sans is a trial licence and Georgia a personal-use file;
  need real licences.
- `distraction.png` provided but not used (no section specified).
- Images single-size (no `srcset`/WebP); ~12 MB video needs compressing.
- Time-spent figure is yours to fill in the README.

---

## 13. "Can you change X?" — where to edit

| Change | Where |
|---|---|
| A price or discount | `LIST_PRICE` / `discount` in `product-data.js` |
| Make a colour sold out | `soldOut: true` in `COLORS` |
| Add a product | new entry in `PRODUCTS` + media array + `LIST_PRICE` row + tab appears automatically |
| Add a line property to the request | `properties` object in `addToCart()` (`main.js`) |
| Change the request body | `buildAddRequest` (`cart.js`) |
| Add an error case to the mock | `handleAdd` (`mock-cart-api.js`) |
| Change what's in the dataLayer item | `itemPayload` (`tracking.js`) |
| Fire another event (e.g. `begin_checkout`) | add `fireX` beside `fireAddToCart`, call from its own success site |
| Slower/faster mock | `?mockLatency=1200` or `CONFIG.latency` |
| Section spacing | `--pad-d` on that section; scale via `--pad-k` |
| Phone font sizes | the "Phone type scale" block at the end of `styles.css` |
| Hero image height cap | `.hero__media img { max-height: 680px }` |
| Product columns / gap | `.product__inner` (`702fr 549fr`, `column-gap`) |
| Split-section columns / gap | `.split-section .split-section__inner` (`672fr 580fr`, 120 px) |
| Badge text under a bundle | `badge` on that bundle in `BUNDLES` (`product-data.js`) |
| A brand colour | search the hex in `styles.css` (e.g. `#5D8485` accent, `#3D5F60` dark, `#9BE0DE` mint) |
| Comparison table width | `.comparison__scroller { max-width: 1182px }` |
| Text-box width / gap | `.hero__copy > *` width 610px; `.hero__copy` `padding-right: 62px` |
| Autoplay rules for the video | `syncVideos()` in `gallery.js` |
| Swipe sensitivity | `threshold` in `enableSwipe()` |

---

## 14. Project files, and how it was checked

```
index.html                  the page (semantic HTML, no inline styles except star ratings)
assets/css/styles.css       the only stylesheet
assets/js/*.js              seven plain scripts (see sections 3–9)
assets/fonts/*.woff2        the five self-hosted fonts
assets/img/                 optimised images + the product video
README.md                   what a reviewer reads (behaviour, tracking, QA, open items)
STUDY-GUIDE.md              this document (your prep — not part of the ZIP)
.gitignore                  keeps sources, trial fonts, zips and tooling out of the repo
```

**What was verified (Chrome, headless):**

- All 54 variants: title, price, compare-at, "Save" badge, colour label, sold-out
  state, selected options and sticky bar match the catalogue.
- 18 real add-to-cart round trips: request URL / headers / body, `GET /cart.js`,
  the `dataLayer` item, and the drawer line all agree.
- `view_item` once; no `add_to_cart` on failure; triple-click sends one request;
  variation B is stamped everywhere; the mock returns the right status for each
  bad input (422 / 404 / 400 / 415) and merges identical lines.
- Widths from 320 to 2560 px: no horizontal scroll; no console errors.
- The BEM rename: every element's computed styles and position compared before
  and after at five screen sizes and four UI states (base, options changed and
  FAQ open, cart drawer open, zoom open), and full-page screenshots identical.

**Not verified:** Firefox, Safari / iOS, a real mouse on the gallery arrows
(checked with emulated hover), and a real Shopify store.
