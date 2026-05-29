# try-onetake — codebase notes

## Price localization

**Rule: every product price shown to a visitor must be localized.** Never display a bare hardcoded price string. Use the `data-paddle-price-id` attribute so `price-localizer.js` can replace it with the visitor's local currency at runtime.

### How it works

1. Load `paddle.js` from the CDN, then `price-localizer.js` (relative path from the page to the repo root).
2. Call `Paddle.Initialize({ token: 'live_bb0b00885e63d509a759b2e2b29' })` — do this in `DOMContentLoaded`.
3. Call `window.localizePrices()` right after initialization.
4. Mark every price element:

```html
<span class="paddle-price" data-paddle-price-id="pri_xxx">995 €</span>
```

- The fallback text (shown until the API responds) should be the EUR amount in European format: `995 €`, `4 995 €`.
- Localized prices are always rounded to the nearest integer and shown with the compact currency symbol (`S$` not `SGD`, `$` not `USD`).
- Always include the CSS class `paddle-price` — Weglot is configured to skip these elements.
- For a price that is a subdivision of another (e.g. quarterly total displayed as per-month), add `data-paddle-price-divisor="3"`. The localizer divides and floors.

### Price IDs

All Paddle price IDs live in `/pricing-data.js`. Each plan entry has a `product` field. Example:

```js
'cercle-monthly':   { product: 'pri_01ks52ts0n6vqgkb1xvqn569hw', price: 995,  ... }
'cercle-semester':  { product: 'pri_01ks5316ncrk8gzk6g2h6ty6ss', price: 4995, ... }
```

### Live token

`live_bb0b00885e63d509a759b2e2b29` — used for both client-side `PricePreview` calls and checkout.

### Pricing table (`/pricing-table/`)


`pricing-table.js` handles price localization internally — it generates `paddle-price` elements and calls `window.localizePrices()` after rendering. No extra setup needed on pages that embed the pricing table. See `/pricing-table/CLAUDE.md` for the full component docs.

## Countdown bar

**File:** `/oto/countdown/countdown.js`

A self-contained sticky countdown bar that injects its own CSS and DOM. Add a single `<script>` tag in `<head>` — no `async` or `defer`.

```html
<script
  src="/oto/countdown/countdown.js"
  data-deadline="2026-05-29T22:00:00Z"
  data-redirect="/oto/too-late/"
  data-label="Offer closes in"
  data-label-hours="hours"
  data-label-min="min"
  data-label-sec="sec"
></script>
```

**Required attributes:**

| Attribute | Description |
|-----------|-------------|
| `data-deadline` | ISO 8601 UTC string for when the countdown ends |
| `data-redirect` | URL (absolute or root-relative) to redirect to on expiry |

**Optional attributes** (all have English defaults):

| Attribute | Default |
|-----------|---------|
| `data-label` | `"Offer closes in"` |
| `data-label-hours` | `"hours"` |
| `data-label-min` | `"min"` |
| `data-label-sec` | `"sec"` |

The bar inserts itself as the first child of `<body>` and is `position: sticky; top: 0`, so it scrolls with the page and stays pinned at the top. When the deadline is reached the script calls `location.replace(data-redirect)`.
