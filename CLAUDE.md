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
| `data-label-days` | Unit label for days (no default). When set, a days unit is shown while at least one day is left, and hours count from 0 to 23. When not set, hours keep counting past 24. |

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
    <p>Sébastien Night, our CEO, is the founder of the Free Entrepreneur Movement. Since 2010, this organization has helped more than 300,000 entrepreneurs in 41 countries grow their business. <strong>After producing and editing thousands of videos himself over 15+ years, Sébastien decided to create an AI agent that would be both incredibly powerful and utterly easy to use: OneTake.</strong></p>
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
    <p>Sébastien Night, notre PDG, est le fondateur du Mouvement des Entrepreneurs Libres, une organisation qui a aidé depuis 2010 plus de 300 000 entrepreneurs dans 41 pays à développer leur activité. <strong>Après avoir lui-même produit et monté des milliers de vidéos pendant plus de 15 ans, Sébastien a décidé de créer un agent IA à la fois incroyablement puissant et d'une simplicité d'utilisation absolue : OneTake.</strong></p>
    <p>Pour contacter Sébastien et son équipe, <a href="https://www.onetake.ai/contact" target="_blank">il suffit de cliquer ici</a>.</p>
    <p class="footer-disclaimer">Ce site ne fait pas partie des sites Facebook, Instagram ou Google, et n'est en aucun cas approuvé par Meta Platforms, Inc. ou Alphabet Inc. Facebook et Instagram sont des marques de Meta Platforms, Inc. Google et YouTube sont des marques de Google LLC.</p>
  </div>
</footer>
```

Pages that use `translations.js` (e.g. `/onboarding/`) read the same text from the `onboarding.footer.*` keys, including `onboarding.footer.disclaimer`, in all 8 languages. Weglot-translated pages use the English version and let Weglot translate it.

## Instagram landing page (`/instagram/`)

Mobile-first free trial page (`launch-monthly-trial`) for visitors coming from Manychat DMs on Instagram. Written in English and translated by Weglot.

- Never write new checkout logic: every CTA outside the form uses `.js-go-to-form`, which sends the visitor to the existing form.
- The videos are OneTake player iframes, which handle autoplay, loop and sound themselves. Never add sound controls or drive the iframes from JS.
- Weglot translates each block element as one sentence and moves inline tags around in the translation. Never put a label (a name, a screen-reader prefix) inline inside a translated sentence; give it its own block element.
- In the feature cards, premium options (gaze correction, background removal) always carry a "Try once free" label, and anything reserved for higher plans carries "Higher plans". The "Editing complete" checklist has no labels.
- Comparison and calculator amounts are always marked up as `.money` elements (or `[data-calc]`), never as bare text: `app.js` shows them in dollars, or in euros (same numbers) on the French, Spanish and Italian versions.
- **Other pages share this page's content and code.** When you edit the copy, sections, prices, FAQ or checkout markup of `/instagram/`, update them the same way (and the other way around):
  - `/masterclass/traffic/check-your-inbox/` (English) and `/masterclass/trafic/confirmation/` (French) sell the same 3-day trial: they repeat this page's sections (same IDs, classes and `VIDEO_SLOTS`) and load `instagram/style.css` and `instagram/app.js` directly. Both leave out everything about translation and dubbing.
  - `/masterclass/traffic/watch/` and `/masterclass/trafic/offre/` reuse its sections (checklist, chat demo, savings calculator, guarantee, reviews, founder, FAQ) for the Scale yearly/quarterly offer. They have no signup form: `instagram/app.js` then skips its form, Paddle and sticky bar setup, which `masterclass/offer.js` handles instead.
  - `instagram/app.js` must keep working without Weglot (it falls back to `<html lang>`) and without the signup form.
- On desktop (768px and up), five sections are wider than the mobile column, through modifier classes in `style.css`: `section--checklist` (each step on one line), `section--story`, `section--reviews` (full-width wall), `section--fit` and `section--faq` (two columns from 960px). Keep these classes on the same sections in every page listed above.
- `instagram/legacy.html` is an archive: never link to it. It still loads the shared scripts (`tools.js`, `checkout-core.js`...), so changes to those also affect it.

## Masterclass funnels (`/masterclass/`)

Two registration funnels for Sébastien's free masterclass, written by hand (Weglot is disabled with `window.__disable_weglot = true` before `tools.js`):

| | English (prerecorded) | French (live, every Thursday at 20:00 Paris time) |
|---|---|---|
| Page 1: registration (indexed) | `/masterclass/traffic/` | `/masterclass/trafic/` |
| Page 2 (`noindex`) | `/masterclass/traffic/check-your-inbox/`: inbox steps, then Passe-Passe video and the `/instagram/` trial offer | `/masterclass/trafic/verifiez-vos-emails/`: inbox steps only |
| Page 3: link in the email (`noindex`) | `/masterclass/traffic/watch/`: masterclass video, then the offer, revealed after 4 min 30 s | `/masterclass/trafic/confirmation/`: countdown to the live + Passe-Passe page with the trial offer |
| Offer after the live (`noindex`) | (on the watch page) | `/masterclass/trafic/offre/`: replay + offer, visible right away |

- **Status:** the French funnel is live. The English funnel is offline (`live: false` in `traffic/config.js`): `masterclass/live-guard.js`, loaded in `<head>` after `config.js`, redirects every page to `offlineRedirectUrl` (`/instagram/`); `?preview=1` bypasses it. Its page 1 carries a `noindex` tag while offline.
- **Config:** every changeable value (emails, video URLs, offer, proof screenshots, session time) lives in `config.js` in each funnel folder. Never hardcode them in the markup. Never show a placeholder in production: an empty video URL hides its player (and a video with `days`, e.g. the French replay on `[0, 1]`, counts as empty outside those weekdays in the session time zone), `[data-mc-show-if="path"]` shows an element only once that config value is set and `[data-mc-hide-if="path"]` does the opposite (e.g. the French offer page headline while the replay is missing). Unconfirmed texts stay out of the pages until confirmed. Each folder's `PLACEHOLDERS.md` lists what is still missing.
- **Shared files:** `masterclass.css` (styles), `masterclass.js` (forms, config bindings, proof grid, join button), `session-date.js` (next French session and time zone helpers). Load order on every page: `config.js`, `session-date.js`, `masterclass.js` (offer pages: `config.js`, `session-date.js`, `offer-deadline.js`, `masterclass.js`, `offer.js`, all in `<head>`).
- **Leads:** forms POST to the Userlist proxy (`edge-scripts/userlist-proxy.ts`) with `Accept: application/json`, `event=CompleteRegistration`, `language`, `masterclass_slug=traffic` and, in French, `attends_masterclass_on` (ISO 8601 UTC of the session). The proxy answers JSON in that mode, so the page can show an inline error; plain HTML forms still get the 302 redirect. Only `Lead`, `CompleteRegistration` and `FormSubmit` events are allowed.
- **Variant `/masterclass/trafic/recherche/`** (`noindex`, canonical to `/masterclass/trafic/`): same funnel and config (`../config.js`), "On recherche 11 coachs ou formateurs en ligne" angle (11 per live session, never counted or enforced). Compare it with page 1 through the UTMs of the ad links; it adds no tracking value of its own. After registration, `masterclass.js` replaces the form with `<template id="mcStep2Template">`: optional questions sent to the proxy with `event=FormSubmit` and saved on the Userlist user. Choice values are English slugs (multiple choices as comma-separated slugs) or numbers: `audience_size` is the top of the range (0, 100, 1000, 10000, 100000, 1000000) and `estimated_volume` reuses the signup form's video frequency field (videos per year: 365, 150, 50, 25, 10, 1, 0); the allowed values live in `QUALIFICATION_CHOICES` in `edge-scripts/userlist-proxy.ts`, so add a new option there as well as in the page. It also fires the Plausible goal `formSubmit`, the same goal as the signup form. Whatever happens, the visitor then goes to page 2.
- **Tracking:** after Userlist accepts a lead, the page fires the FirstPromoter referral (`fpr('referral', { email })`, as on `/instagram/`) and the Plausible goal `CompleteRegistration` (props `language`, `masterclass_slug`) before going to page 2. The edge script also sets the user property `Register_to_a_webinar_on` (UTC time of the registration) on every `CompleteRegistration`.
- **Affiliates and UTMs:** affiliate links use `?ref=` (FirstPromoter). The forms send `ref` as `referred_by`, plus `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_channel`; the edge script saves them on the Userlist user (last touch: a new value replaces the old one, an empty value never erases it) and on the `CompleteRegistration` event. The last link with any of these parameters is remembered for 30 days in the browser (`localStorage`), so a visitor who registers later without them is still attributed.
- **Offer pages** (`masterclass/offer.js`, `masterclass/offer-deadline.js`, settings in `MASTERCLASS_CONFIG.offer`):
  - Two plans, `scale-yearly-offer` (999 a year) and `scale-quarterly-offer` (299 a quarter) from `pricing-data.js`. Mark prices with `data-offer-price="yearly|quarterly"`: `offer.js` adds the Paddle price ID from `pricing-data.js`, then `price-localizer.js` localizes them. Values of bonuses are `.money` amounts ($ in English, same numbers in € in French).
  - CTA blocks are cloned from `<template id="offerCtaTemplate">` into every `[data-offer-cta]`; the selectors stay in sync. Checkout goes through `checkout-core.js`, pre-filled from `?first_name=` / `?email=` or the registration saved in the browser.
  - Deadlines: English, 6 days after `?registered_on=` (the earlier of the URL and stored values) at midnight in the visitor's time zone; French, the Wednesday after the Thursday live (or after `?attends_masterclass_on=`) at midnight Paris time. Dates in the URL can be ISO 8601 or Userlist's email format (`2026-10-08 18:00:00 UTC`); without an offset they are read as UTC. After the deadline the page redirects to `expiredRedirectUrl` (`/oto/too-late/`); `?unlockfor=1` previews without the redirect.
  - English reveal: the sales content (`#offerContent`) is hidden for `revealAfterSeconds` (270) of time on page, unless `?offer=1` or a previous unlock (stored in `localStorage`).
  - Tests: `/masterclass/tests/offer-deadline.test.html`.
- **Session date:** always use `masterclassSession.next()` / `formatFr()` from `session-date.js`, never a date computed elsewhere. The cutoff (default Thursday 21:00) is in the config. Tests: open `/masterclass/tests/session-date.test.html` in a browser; all tests must pass.
- **French page 3 countdown:** `masterclass.mountSessionCountdown()` injects `/oto/countdown/countdown.js` with the session start as `data-deadline` and the live URL as `data-redirect`, so visitors are sent to the live when it starts (or immediately if they open the page during the session).
- **Footer:** the standard footer, plus the creators disclaimer and "OneTake Pte Ltd, Singapore". A newsletter consent line is drafted in `PLACEHOLDERS.md`, to add once confirmed.
- **Accounts scanner (page 1):** `masterclass.js` renders `MASTERCLASS_CONFIG.profiles` into `#mcScan`: two rows of screenshots looping in opposite directions under a scan overlay (still for visitors with reduced motion). Screenshots live in `/masterclass/images/` (288x640 JPEG). That folder's `index.html` redirects to `/masterclass/traffic/`, so the folder is never listed.
- **Email subject on page 2:** `email.subject` keeps the Userlist Liquid tag `{{ user.first_name | capitalize }}`; the page replaces it with the visitor's first name (or drops it when unknown).
- **Copy:** in this funnel only, "our AI" / "notre IA" is allowed. French typography: non-breaking space (`&nbsp;`) before `:`, `;`, `!`, `?` and inside « guillemets ». Highlight key headline words with `<span class="hl">`.
