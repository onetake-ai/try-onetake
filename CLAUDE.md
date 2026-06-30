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

### Per-plan post-purchase redirect

Add `successUrl` to any plan preset in `/pricing-data.js` to send buyers to a custom page instead of the default `/onboarding/`. `app.js` picks this up automatically — no other changes needed.

```js
// Root-relative (domain is prepended automatically)
'cercle-monthly': { ..., successUrl: '/onboarding/cercle/' }

// Absolute URL (used as-is, no domain prepended)
'cercle-application': { ..., successUrl: 'https://onfire.onetake.ai/ehv-application/' }
```

The value can be either a root-relative path (e.g. `/onboarding/ehv/`) or a full absolute URL (e.g. `https://onfire.onetake.ai/ehv-application/`). When root-relative, `app.js` prepends `https://try.onetake.ai`; when absolute, it is used as-is. The standard query params (`email`, `language`, `product`, `plan`) are always appended.

### Live token

`live_bb0b00885e63d509a759b2e2b29` — used for both client-side `PricePreview` calls and checkout.

### Pricing table (`/pricing-table/`)


`pricing-table.js` handles price localization internally — it generates `paddle-price` elements and calls `window.localizePrices()` after rendering. No extra setup needed on pages that embed the pricing table. See `/pricing-table/CLAUDE.md` for the full component docs.

## Embeddable checkout snippet

**Files:** `/assets/checkout/checkout-embed.js`, `/assets/checkout/checkout-embed.css`, `/assets/checkout/checkout-core.js`

A self-contained embeddable checkout form that can be loaded on any page (same domain or external). It shows a 2-step form that ends with a Paddle checkout popup, preserving all tracking and downsell behaviors from the main signup page.

### Architecture

- `checkout-core.js` — shared checkout logic (Paddle init, checkout opening, tracking, downsell) used by both `app.js` and the embed snippet. Exposes `window.oneTakeCheckout`.
- `checkout-embed.js` — the embeddable snippet (UI rendering, form flow, dependency loading). Dynamically loads all required scripts from `try.onetake.ai`.
- `checkout-embed.css` — self-contained styles, all classes prefixed with `otc-` to avoid collisions.

### Usage

```html
<div id="onetake-checkout"></div>
<script src="https://try.onetake.ai/assets/checkout/checkout-embed.js"
        data-plans="launch-monthly-trial,pro-monthly-trial"
        data-container="onetake-checkout"></script>
```

### Data attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-plans` | Yes | — | Comma-separated plan keys from `pricing-data.js` |
| `data-container` | Yes | — | ID of the mount element |
| `data-cta-1` | No | Translated button text | Button text for step 1 |
| `data-cta-2` | No | Same as cta-1 | Button text for step 2 |
| `data-success-url` | No | Plan's `successUrl` or `/onboarding/` | Post-purchase redirect URL |

### Multi-plan radio selector

When `data-plans` contains multiple plan keys, a radio list appears between the name/email fields and the CTA button. Each option shows the plan tier name and payment conditions with localized prices via `Paddle.PricePreview()`. EUR fallback text is shown until the API responds.

When only one plan is provided, no radio list is shown.

### 2-step flow

1. **Step 1:** First name + email + (if multi-plan) plan selector + CTA
2. **Step 2:** Use cases multi-select + usage frequency dropdown + CTA
3. **After step 2 CTA:** Tracking fires, then Paddle checkout overlay opens

### Dependencies

The snippet dynamically loads from `try.onetake.ai`: `pricing-data.js`, `translations.js`, `tracking-params.js`, `cohort.js`, `tools.js` (tracking scripts), `checkout-core.js`, Paddle SDK, and Montserrat font.

### Relationship to app.js

`app.js` (the main signup page controller) also uses `checkout-core.js`. Any page loading `app.js` must load `checkout-core.js` first (see the script order in `index.html`). The embed snippet loads its own dependencies dynamically, so no manual script setup is needed.

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
| `data-show-within` | Hours before deadline to start showing the bar. Bar is hidden until the deadline is within this window (e.g. `"48"` shows it only during the last 2 days). |

The bar inserts itself as the first child of `<body>` and is `position: sticky; top: 0`, so it scrolls with the page and stays pinned at the top. When the deadline is reached the script calls `location.replace(data-redirect)`.

## YouTube lazy embed

**Files:** `/assets/youtube-thumbnails.css` and `/assets/youtube-thumbnails.js`

When a page embeds YouTube testimonial videos, use this lightweight pattern instead of loading iframes on page load. It displays a static thumbnail with a play button; clicking replaces the thumbnail with an autoplay iframe.

### Setup

Include both files on any page that uses YouTube embeds:

```html
<link rel="stylesheet" href="/assets/youtube-thumbnails.css">
<!-- ... -->
<script src="/assets/youtube-thumbnails.js"></script>
```

(Adjust the relative path based on the page's depth in the folder tree.)

### Usage

```html
<div class="youtube-player" data-id="YOUTUBE_VIDEO_ID"></div>
```

The script initializes all `.youtube-player` elements on `DOMContentLoaded`. For elements added dynamically after that (e.g. rendered by JS), call `initThumbs()` manually after inserting them into the DOM — see `bootcamps/mav/vpl1-secret/testimonials.js` for the pattern.

### Playlists

```html
<div class="youtube-player" data-id="VIDEO_ID" data-list="PLAYLIST_ID" data-index="1"></div>
```
