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
| `data-plans` | No* | `launch-monthly-trial` | Comma-separated plan keys from `pricing-data.js`. Required in standard mode; defaults to `launch-monthly-trial` in minimalist and lightbox modes. |
| `data-container` | No* | — | ID of the mount element. Required unless using `data-trigger` in lightbox mode. |
| `data-minimalist` | No | — | Presence enables minimalist mode: email + CTA inline, no name/use-case/frequency fields, opens Paddle checkout directly |
| `data-lightbox` | No | — | Presence enables lightbox mode: renders only a CTA button; click opens a full-viewport overlay with headline, benefits, email, and submit |
| `data-lightbox-headline` | No | Translated `special.headline` | Override the eyebrow marketing headline in the lightbox |
| `data-lightbox-subheadline` | No | Translated trial-aware headline | Override the main action headline in the lightbox |
| `data-trigger` | No | — | CSS selector for existing element(s) to use as lightbox triggers (e.g. `.cta-button` or `#my-button`). Binds to all matching elements. When set, no trigger button is rendered and `data-container` is not required. Lightbox mode only. |
| `data-cta-1` | No | Translated button text | Button text for step 1 (or the only CTA in minimalist/lightbox trigger) |
| `data-cta-2` | No | Same as cta-1 | Button text for step 2 (ignored in minimalist and lightbox modes) |
| `data-success-url` | No | Plan's `successUrl` or `/onboarding/` | Post-purchase redirect URL |

### Minimalist mode

A compact inline layout (email field + CTA button side by side) that opens the Paddle checkout directly; no first name, use case, or frequency fields. Add `data-minimalist` to the script tag:

```html
<div id="onetake-checkout"></div>
<script src="https://try.onetake.ai/assets/checkout/checkout-embed.js"
        data-minimalist
        data-container="onetake-checkout"></script>
```

When `data-plans` is omitted in minimalist mode, it defaults to `launch-monthly-trial`. Multiple plans still produce a radio selector above the email row.

### Lightbox mode

A button-only layout for tight spaces. Only a CTA button is rendered in the container; clicking it opens a full-viewport overlay lightbox with a marketing eyebrow headline, a trial-aware action headline, benefit bullets, an email field, and a submit CTA that opens the Paddle checkout. Add `data-lightbox` to the script tag:

```html
<div id="onetake-cta"></div>
<script src="https://try.onetake.ai/assets/checkout/checkout-embed.js"
        data-lightbox
        data-container="onetake-cta"></script>
```

Both headlines are customizable via data attributes:

```html
<div id="onetake-cta"></div>
<script src="https://try.onetake.ai/assets/checkout/checkout-embed.js"
        data-lightbox
        data-plans="pro-monthly-trial"
        data-cta-1="Start editing now"
        data-lightbox-headline="Your videos, professionally edited"
        data-lightbox-subheadline="Try OneTake free for 7 days"
        data-container="onetake-cta"></script>
```

To attach the lightbox to existing buttons (e.g. on a Webflow page), use `data-trigger` with a CSS selector instead of `data-container`. The selector matches all elements with that class, so every CTA on the page opens the lightbox:

```html
<script src="https://try.onetake.ai/assets/checkout/checkout-embed.js"
        data-lightbox
        data-trigger=".cta-button"></script>
```

When `data-trigger` is set, no trigger button is rendered and `data-container` is not required. The `click` event on every matched element opens the lightbox (with `preventDefault` so `<a>` tags don't navigate). Works with any CSS selector: `.class`, `#id`, `[data-attr]`, etc.

When `data-plans` is omitted, it defaults to `launch-monthly-trial`. Multiple plans produce a radio selector inside the lightbox. The lightbox overlay is appended to `document.body` (not inside the container) so it covers the full viewport regardless of host page CSS. The downsell flow works inside the lightbox card after the Paddle checkout closes without purchase.

### Prices and VAT

All prices displayed in the embed (plan radio labels, downsell modal) are shown **exclusive of VAT**. The localized price comes from Paddle's `PricePreview` subtotal. A localized "excl. VAT" label is appended automatically (e.g. "HT" in French, "zzgl. MwSt." in German).

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

## Standard footer

Every landing page ends with this footer. Copy the version matching the page language. Copy rules apply: OneTake is "an AI agent" (never a tool, software or platform), no em dashes, no separator lines. The Meta/Google disclaimer is required on every page, since traffic comes from Instagram, Facebook, Google and YouTube ads and links.

### English

```html
<footer>
  <div class="footer-inner">
    <p>By signing up, I agree to the <a href="https://www.onetake.ai/terms-of-service" target="_blank">Terms of Service &amp; Refund Policy</a> and the <a href="https://www.onetake.ai/privacy-policy" target="_blank">Privacy Policy</a>.</p>
    <p>Do you have an audience of entrepreneurs? You can <a href="https://onetake.firstpromoter.com/signup/40830" target="_blank">become an affiliate of OneTake AI and earn recurring commissions</a>.</p>
    <p><strong>What is OneTake?</strong></p>
    <p><strong>OneTake AI turns raw videos into professional presentations.</strong> To help experts, trainers, coaches and authors create and publish their video content, we've created <a href="https://www.onetake.ai" target="_blank">OneTake, the first AI video editing agent</a>.</p>
    <p>Useful links: <a href="https://www.onetake.ai/blog" target="_blank">OneTake's Blog</a> · <a href="https://welove.onetake.ai/" target="_blank">Wall of Love (reviews)</a> · <a href="https://docs.onetake.ai/en/" target="_blank">FAQ &amp; Docs</a></p>
    <p><strong>Who came up with the idea?</strong></p>
    <p>Sébastien Night, our CEO, is the founder of the Free Entrepreneurs Movement. Since 2010, this organization has supported over 20,000 entrepreneur clients and 300,000 supporters in 41 countries. <strong>After producing and editing thousands of videos himself over 15+ years, Sébastien decided to create an AI agent that would be both incredibly powerful and utterly easy to use: OneTake.</strong></p>
    <p>To contact Sébastien and his team, <a href="https://www.onetake.ai/contact" target="_blank">simply click here</a>.</p>
    <p class="footer-disclaimer">This site is not part of the Facebook, Instagram or Google websites, and is not endorsed by Meta Platforms, Inc. or Alphabet Inc. in any way. Facebook and Instagram are trademarks of Meta Platforms, Inc. Google and YouTube are trademarks of Google LLC.</p>
  </div>
</footer>
```

### French

```html
<footer>
  <div class="footer-inner">
    <p>En m'inscrivant, j'accepte les <a href="https://www.onetake.ai/terms-of-service" target="_blank">Conditions d'utilisation et la Politique de remboursement</a> ainsi que la <a href="https://www.onetake.ai/privacy-policy" target="_blank">Politique de confidentialité</a>.</p>
    <p><strong>Qu'est-ce que OneTake ?</strong></p>
    <p><strong>OneTake AI transforme des vidéos brutes en présentations professionnelles.</strong> Pour aider les experts, les formateurs, les coachs et les auteurs à créer et à publier leur contenu vidéo, nous avons développé <a href="https://www.onetake.ai" target="_blank">OneTake, le premier agent IA de montage vidéo</a>.</p>
    <p><strong>Qui a eu cette idée ?</strong></p>
    <p>Sébastien Night, notre PDG, est le fondateur du Mouvement des Entrepreneurs Libres, une organisation qui accompagne depuis 2010 plus de 20 000 entrepreneurs et compte 300 000 sympathisants dans 41 pays. <strong>Après avoir lui-même produit et monté des milliers de vidéos pendant plus de 15 ans, Sébastien a décidé de créer un agent IA à la fois incroyablement puissant et d'une simplicité d'utilisation absolue : OneTake.</strong></p>
    <p>Pour contacter Sébastien et son équipe, <a href="https://www.onetake.ai/contact" target="_blank">il suffit de cliquer ici</a>.</p>
    <p class="footer-disclaimer">Ce site ne fait pas partie des sites Facebook, Instagram ou Google, et n'est en aucun cas approuvé par Meta Platforms, Inc. ou Alphabet Inc. Facebook et Instagram sont des marques de Meta Platforms, Inc. Google et YouTube sont des marques de Google LLC.</p>
  </div>
</footer>
```

Pages that use `translations.js` (e.g. `/onboarding/`) read the same text from the `onboarding.footer.*` keys, including `onboarding.footer.disclaimer`, in all 8 languages. Weglot-translated pages use the English version and let Weglot translate it.

## Instagram landing page (`/instagram/`)

Mobile-first free trial page for visitors coming from Manychat DMs on Instagram. Plan: `launch-monthly-trial` (3 days, then the localized Launch monthly price).

- `instagram/app.js` is a thin controller over `checkout-core.js` (not `app.js`). The form only asks for first name and email; `useCases` and `estimatedVolume` are sent empty.
- The page is written in English and translated by Weglot. All copy lives in the HTML, including the strings the JS shows (see `#messages`, a hidden block Weglot translates). The Paddle checkout opens in the current Weglot language (`Weglot.getCurrentLang()`, falling back to `<html lang>`).
- Closing Paddle without paying replaces the form with the "one step away" panel (`#oneStep`); its button reopens checkout with the same data. No downsell on this page.
- Media assets not produced yet (OG image, hero video H1 and its poster preload, feature clips F1 to F6, conversational edit clip E1) are hidden: each is wrapped in an HTML comment starting with `<!-- PLACEHOLDER (hidden until the asset is ready`. Commented-out media are never downloaded, and the page layout works without them. To publish an asset: put the file in `instagram/media/`, update its path (the hero uses `hero-before-after.mp4` / `.webm` and a poster, to switch from the `.svg` placeholder to the WebP; feature and E1 clips go in each video's `data-src`, lazy-loaded; OG replaces `og-placeholder.png` with the 1200×630 image), then delete the comment wrapper. Find all remaining ones with `grep -n "PLACEHOLDER (hidden" instagram/index.html`.

