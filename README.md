# VoChill Landing Page — Front-End Assignment

A standalone landing page built with **hand-written HTML, CSS and vanilla
JavaScript**. No frameworks, no CDNs, no jQuery/React/Tailwind/Bootstrap, and
no slider, lightbox or accordion plugins — the gallery, the zoom lightbox and
the accordion are all written from scratch.

```
index.html
assets/
  css/styles.css          single stylesheet: tokens → sections → responsive
  js/product-data.js      catalogue: 2 products × 3 bundles × 9 colours = 54 variants
  js/mock-cart-api.js     THE MOCK — a fake storefront, fetch-shaped
  js/cart.js              THE REQUEST LOGIC — builds POST /cart/add.js
  js/tracking.js          dataLayer: view_item, add_to_cart, page variation
  js/gallery.js           product carousel + zoom lightbox
  js/accordion.js         FAQ accordion
  js/main.js              wiring: pickers, price, drawer, sticky bar
  fonts/                  self-hosted woff2 (Cormorant, Inter, Georgia Italic, Studio Feixen Sans)
  img/                    optimised JPEG/PNG assets + the product video
```

## Running it

Open `index.html` directly — it works from `file://`, because the scripts are
classic scripts rather than ES modules. (Some browsers restrict font loading
from `file://`; if the type looks wrong, serve it instead.)

```bash
python3 -m http.server 8777    # then open http://localhost:8777
```

### Debug parameter

Add `?debug=1` to the URL to open the **dataLayer inspector** — a panel that
mirrors every `dataLayer` push (with its full payload), so `view_item` and
`add_to_cart` can be verified on desktop or a phone without opening devtools.
It also logs the outgoing cart request to the console.

---

## Sections built

Eight sections plus the claims strip, against a required minimum of five (Hero, Product and Comparison Table are the mandatory ones):

1. **Hero** *(mandatory)* — split layout: copy on the left (caption, serif headline with italic accent, body, two CTAs, star rating and trust line), full-bleed 1:1 image on the right (max 680 px tall). A claims strip sits directly under it; on phones it rotates one claim at a time.
2. **Sounds Familiar** — problem-and-relief copy, two feature cards, photo with an overlapping review card.
3. **Product** *(mandatory)* — two products (Stemless / Stemmed), three bundles and nine colours; live price / compare-at / savings; simulated AJAX add-to-cart; cart drawer; mobile sticky buy bar.
4. **Customers Speak** — rating summary and review cards (swipeable row on tablet/phone).
5. **Simple by Design** — four-step explainer (dark section).
6. **The Real Difference** — copy, feature cards and photo.
7. **Why Choose VoChill — comparison table** *(mandatory)* — a real `<table>` (VoChill vs. alternatives).
8. **FAQ accordion** — hand-written WAI-ARIA disclosure accordion.

Closed by a full-width brand-mark footer image.

### Product section

- **Pickers.** Product tabs and bundle options are roving-focus radiogroups; the colour picker is a custom accessible listbox. Every change resolves one of the 54 variants, which drives the title, subtitle, review count, checklist, price block, sticky bar, the cart request's variant ID and the dataLayer payload.
- **Gallery (`gallery.js`).** Per product: images plus a lazy-loaded video slide. Pointer swipe (with a horizontal lock so vertical scroll still works), flat pagination dashes, `ArrowLeft`/`ArrowRight`, and on desktop hover-halves with a cursor-following arrow. The video loads on first view, plays muted on a loop only while active and on screen, and shows native controls under `prefers-reduced-motion`.
- **Zoom lightbox.** The "+ Zoom" button opens a full-size view on the same slide. It has a focus trap, `Esc` to close, arrows and dots, and stays in sync with the carousel.
- **Accordion (`accordion.js`).** Single-open disclosure pattern; buttons carry `aria-expanded`/`aria-controls`, panels animate height and release to `auto`.

### Responsive behaviour

Desktop matches the supplied Figma frames (typography, spacing, colours). Below that, the layout is my adaptation, scaled in proportion:

| Width | Layout |
|---|---|
| 1400 px and up | Full desktop. Contained sections cap at 1360 px, full-width sections at 1600 px. |
| 1024–1399 px | Two-column layouts; strip spacing tightens. |
| 768–1023 px | Single column; steps become 2 × 2; reviews scroll horizontally. |
| up to 767 px | Phone: one type scale (titles 26 / body 14 / small 12 / tiny 10), rotating claims strip, squarer hero image, vertical section padding scaled to 55 % of desktop. |

Vertical section padding is set per section (`--pad-d`) and scaled by one
variable (`--pad-k`: 1 desktop, .75 tablet, .55 phone).

---

## Simulated AJAX add-to-cart

The brief asked to keep the mock separate from the request logic. That split is
the main architectural decision here:

**`cart.js` is the code that would ship.** It builds a genuine `Request`
against the Shopify AJAX Cart API and never learns the store is fake:

```js
new Request(ROOT + 'cart/add.js', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  body: JSON.stringify({
    form_type: 'product', utf8: '✓',        // what a Shopify product form posts
    items: [{
      id: 46959037743348,                   // VARIANT id (required)
      quantity: 1,                          // whole number >= 1 (required)
      properties: {                         // hidden ("_") line-item properties
        _product_id: '8952152785140',       // product id (Shopify derives it from the variant)
        _sku: 'VC-SL-2-QTZ', _source: 'landing-page', _variation: 'A'
      }
    }]
  }),
  credentials: 'same-origin'   // the cart cookie has to ride along
});
```

`id` is the **selected variant ID** (product × bundle × colour, resolved from
the pickers) and `quantity` is the **selected quantity** — always `1`, because
each bundle (Single / Couple Pair / Couple Pair + 2 Chill Cradles) is its own
variant. `ROOT` comes from `Shopify.routes.root` when
present, so locale-prefixed storefronts (`/en-ca/`) resolve correctly.

**`mock-cart-api.js` is the fake storefront.** It exposes exactly one thing,
with `fetch`'s signature:

```js
transport(request: Request) -> Promise<Response>
```

It returns a real `Response` with a real status code and a Shopify-shaped JSON
body, so response parsing, error handling and retry logic are identical either
way. It models: the full Shopify line-item payload (`id`, `variant_id`, `product_id`,
`key`, `sku`, `price`, `line_price`, `properties`, `featured_image`, …), the
cart payload (`token`, `item_count`, `total_price`, `currency`, `items`, …),
lines merging when variant **and** properties match, and Shopify's error codes:
`422` (missing/invalid items, id or quantity; sold out), `404` (unknown
variant), `400` (invalid JSON), `415` (not `application/json`).

**The seam is one line** (`main.js`):

```js
VC.Cart.transport = useLiveCart
  ? function (request) { return window.fetch(request); }
  : VC.MockCartAPI.transport;
```

Going live means deleting `mock-cart-api.js` and that ternary. Nothing else
changes.

Error handling follows Shopify's real contract: non-2xx responses carry
`description` / `message`, which surface in the inline `aria-live` region. The
`Rose` variant is deliberately `available: false` so the sold-out path is
demonstrable from the UI.

---

## dataLayer events

`window.dataLayer` is initialised in `<head>`, above every other script, so
nothing can push into an undefined array — the same slot the GTM container
snippet would occupy.

### `view_item`

Fires **once per page load**, the first time the product section is genuinely
on screen — `IntersectionObserver` at `threshold: 0.3`. Two guards: a boolean
that can only flip once, and `observer.disconnect()` immediately after firing,
so scrolling away and back cannot re-fire it (verified). Browsers without
`IntersectionObserver` fall back to firing on load rather than never firing.

### `add_to_cart`

Fires **only from the `.then()` of a resolved cart request** — never from the
click handler. If the request rejects, the catch block shows an error and
pushes nothing.

### Payload

GA4 ecommerce schema, preceded by an `ecommerce: null` reset (without it,
keys from the previous event leak into the next one, because the dataLayer
merges objects):

```js
dataLayer.push({ ecommerce: null });
dataLayer.push({
  event: 'add_to_cart',
  page_variation: 'A',                  // displayed page variation
  page_variation_name: 'control',
  ecommerce: {
    currency: 'USD',                    // currency
    value: 80.95,                       // total value (unit × qty)
    items: [{
      item_id: 'VC-SL-2-QTZ',           // SKU
      item_product_id: '8952152785140', // Shopify product ID
      item_variant_id: '46959037743348',// Shopify variant ID
      item_name: 'Stemless Wine Chiller Pair',  // product name
      item_brand: 'VoChill',
      item_category: 'Wine Chillers',
      item_variant: 'Couple Pair / Quartz',
      price: 80.95,                     // unit price
      quantity: 1                       // quantity
    }]
  }
});
```

Both the SKU and the Shopify variant ID are included deliberately — see the
Meta mapping below for why that matters.

---

## Tracking explanation

### Mapping `add_to_cart` → Meta `AddToCart`

The GA4 payload already carries everything Meta needs; a GTM Meta tag reads it
straight off the dataLayer:

| GA4 / dataLayer | Meta Pixel parameter | Note |
|---|---|---|
| `ecommerce.items[].item_id` *or* `item_variant_id` | `content_ids: []` | **Must match the product catalog's `id` field** |
| — | `content_type: 'product'` | `'product_group'` only if the catalog is keyed on parent products |
| `ecommerce.items[].item_name` | `content_name` | |
| `ecommerce.items[].quantity` | `contents[].quantity` | |
| `ecommerce.items[].price` | `contents[].item_price` | unit price, excluding tax and shipping |
| `ecommerce.value` | `value` | line total — must equal `item_price × quantity` |
| `ecommerce.currency` | `currency` | ISO-4217 |

```js
fbq('track', 'AddToCart', {
  content_type: 'product',
  content_ids: ['46959037743348'],
  contents:    [{ id: '46959037743348', quantity: 1, item_price: 80.95 }],
  value: 80.95,
  currency: 'USD'
}, { eventID: 'atc-8f2c1e94-...' });   // see deduplication below
```

**The one thing that actually breaks in production** is `content_ids`. Meta
only credits the event to a catalog product if the ID matches the catalog feed
exactly. A Shopify catalog synced through the Facebook & Instagram sales
channel is normally keyed on the **variant ID** (sometimes prefixed, e.g.
`shopify_US_<product>_<variant>`), whereas a hand-built or third-party feed is
usually keyed on **SKU**. I would confirm the actual key by opening one product
in Commerce Manager before wiring the tag — which is why the payload carries
both `item_id` (SKU) and `item_variant_id`, so the GTM variable can point at
whichever the catalog uses without touching page code.

`value` should be the line total for the item(s) added, exclusive of shipping,
and consistent with what `Purchase` will later report, or ROAS drifts.

### Verifying it fires correctly

Add `?debug=1` to the URL: the built-in inspector renders every `dataLayer`
push with its full payload, on desktop or a real phone, so `view_item` and
`add_to_cart` can be checked without devtools.

### Preventing duplicates if Meta tracking already exists

**First, audit rather than add.** Shopify's Facebook & Instagram sales channel
injects its own pixel and fires `AddToCart` automatically. Adding a GTM tag on
top gives two events for one action. Pixel Helper will show either two pixel
IDs or two events on one ID.

Then, in order of preference:

1. **One owner per event.** If the sales-channel pixel already fires `AddToCart` correctly, don't fire a second one — use GTM for GA4 only. If GTM should own it, turn off the channel's automatic event tracking (or remove the hard-coded pixel from `theme.liquid`) so there is a single source.
2. **`eventID` deduplication** for the case where browser *and* server must both fire — a Pixel event and a Conversions API event for the same action. Generate one ID per user action, send it as `eventID` on `fbq()` and as `event_id` in the CAPI payload. Meta dedupes on `(event_name, event_id)` within a 48-hour window. This is deduplication *across transports*, not a licence to fire twice in the browser.
3. **Guard at the trigger.** In GTM, trigger on the `add_to_cart` dataLayer event with a firing limit, rather than on a generic click selector that can also match a quick-add button elsewhere on the page.
4. **Guard at the source** — which is what this build does. `add_to_cart` is pushed from exactly one place, inside the success branch of one request; `view_item` is protected by a latch plus `observer.disconnect()`. Rapid double-clicks cannot double-fire because the button is disabled for the duration of the request.

---

## Self-QA

`view_item` and the other tracking events were checked through the `?debug=1`
URL parameter, which shows every `dataLayer` push in the on-page inspector.

Checked across all breakpoints (phone, tablet, desktop and wide screens):

- **Responsiveness of all sections** — hero, claims bar, Sounds Familiar, product, customers speak, how it works, the real difference, comparison table, FAQ and footer.
- **Product add-to-cart behaviour** — variant, price and request stay in sync, cart drawer, sold-out state.
- **Accordion behaviour** — FAQ open and close, one open at a time.
- **Product gallery behaviour** — swipe, arrows, pagination dashes, video slide and the zoom lightbox.

---

## Time spent

I spent around 2 days on this assignment.
