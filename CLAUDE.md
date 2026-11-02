# try-onetake — codebase notes

## Price localization

**Rule: every product price shown to a visitor must be localized.** Never display a bare hardcoded price string. Use the `data-paddle-price-id` attribute so `price-localizer.js` can replace it with the visitor's local currency at runtime.

**Exception:** plans sold through Airwallex (see "Airwallex checkout" below) are shown in EUR excl. VAT as plain text (`999 € HT / an`), because the Paddle localizer can't convert them.

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

## Airwallex checkout

**Files:** `/airwallex-data.js`, `/assets/airwallex/airwallex-checkout.js`, `/assets/airwallex/airwallex-checkout.css`, `/edge-scripts/airwallex-checkout.ts`

Card payments through Airwallex Hosted Billing Checkout (subscriptions), used instead of Paddle on `/4dcm/le-challenge/` and `/4dcm/acces-challenge/`. Never send a raw price ID or URL from the browser: pages only use plan keys.

- **Plans:** declared twice by the same key. `/airwallex-data.js` holds what the page shows and tracks (label, value, wire transfer reference prefix, bank details, edge script URL). `PLANS` in `edge-scripts/airwallex-checkout.ts` holds the allowlist: Airwallex price ID, optional `bonusPriceIds` (0 € prices with the same billing cycle, listed under the plan on the checkout page as included bonuses without changing the total), sales window (`opensAt`, `closesAt`, ISO 8601 UTC, both optional) and the success and back pages. To sell a new plan, add it to both.
- **Markup:** `<button data-airwallex-plan="challenge-yearly">` opens a popup asking first name, email and the optional WhatsApp number (see "Phone field"), then redirects to a checkout created on the spot (it expires after 1 hour, never create one in advance). `<button data-airwallex-wire="challenge-yearly">` opens the wire transfer form (only plans with a `wire` entry), then shows the bank details and the reference (`PREFIX LASTNAME Firstname`) with copy buttons. Load `airwallex-data.js`, then `airwallex-checkout.js`, plus the CSS.
- **Success page:** call `oneTakeAirwallex.confirmPurchase()`. It asks the edge script whether the checkout started in this browser is `COMPLETED`, then fires `Purchase` once. OneTake accounts are not created automatically: the success page says credentials arrive by email within the same business day, and the team creates them from the Userlist `Purchase` event.
- **Events:** `AddToCart` when the email is entered (AnyTrack, Plausible, Userlist), `InitiateCheckout` when the wire form is sent (AnyTrack, Plausible, Userlist with the user property `pledged_wire_payment_on`), `Purchase` on the success page (AnyTrack, Plausible with revenue, Userlist). No `InitiateCheckout` for card payments: the hosted checkout gives no signal back. No affiliate (FirstPromoter) tracking.
- **Edge script** (Bunny script 99045 at `https://directpayments.onetake.ai`, our own domain because filters block `*.bunny.run` more often; deployed by `.github/workflows/deploy-airwallex-checkout.yml`): endpoints `/checkout`, `/wire`, `/purchase`; CORS limited to `https://try.onetake.ai`; refuses checkouts outside the plan's window with `NOT_OPEN_YET` or `OFFER_CLOSED` (the page then redirects to `/oto/too-late/`). Every refused request is logged (`Refused POST /checkout: CODE (status)` with origin, plan and email) in the Bunny logs. The popups show the error code after the error message, e.g. `(code : NOT_OPEN_YET)`; `NETWORK` means the request never got an answer the browser could read (offline, blocked by a filter, or refused by CORS), so nothing is logged and Userlist gets no `AddToCart`. Secrets, set in the Bunny dashboard: `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY` (scoped key: Billing customers and Billing checkouts, write), `AIRWALLEX_LEGAL_ENTITY_ID`, `AIRWALLEX_LINKED_PAYMENT_ACCOUNT_ID`, `AIRWALLEX_LOGIN_AS` (optional, only for a key linked to several accounts), `USERLIST_PUSH_KEY`.
- **Attribution:** `?ref=` and `utm_*` (last visit with any, kept 30 days) and the AnyTrack click ID go to Userlist and to the metadata of the Airwallex customer and checkout. The metadata is attached by update calls after creation, never at creation, and is retried without the attribution if Airwallex refuses it: metadata must never block a sale.

## Calendar page (`/tools/calendar/`)

**Files:** `/tools/calendar/index.html`, `app.js`, `link.js`, `style.css`, `create/` (link generator), `/edge-scripts/calendar-proxy.ts`

Public schedule of any shared Proton calendar, for clients and stakeholders: preview of the dates (next event banner, upcoming list, month grid), time zone picker (the visitor's own by default, saved in `localStorage`), one-click subscribe buttons (Google, Apple `webcal://`, Outlook.com, Microsoft 365) with manual steps for each app plus Proton, and per event a Join button (lights up 15 minutes before the start) and "add only this date" (Google link or `.ics` download). English, translated by Weglot; `noindex`.

- **Link:** `https://try.onetake.ai/tools/calendar/?id=<calendar ID>&key=<CacheKey>&pass=<PassphraseKey>`, all encoded (`==` becomes `%3D%3D`, so email and chat apps don't cut the link). `PassphraseKey` only exists in Proton "Full view" links and decrypts the event details: without it ("Limited view"), Proton only gives busy times, and the generator warns about it. Never log it. The team makes it with the generator `/tools/calendar/create/` (internal, `noindex`, no Weglot or tracking): paste a Proton share link, get the page link, checked through the relay (calendar name and number of events). The page also accepts a Proton share link with `https://calendar.proton.me` replaced by `https://try.onetake.ai/tools/calendar/?`. Parsing and building links live in `link.js`, shared by both pages. No calendar ID is ever stored in the repo (it is public).
- **Relay:** Proton sends no CORS header, so the preview reads the `.ics` through Bunny Edge Script 100436 (`edge-scripts/calendar-proxy.ts`, at `https://calendar.fluffybunny.onetake.ai`, `PROXY_URL` in `link.js`). It only fetches Proton shared calendar links, answers CORS for `https://try.onetake.ai` only, and caches 5 minutes. Deployed by `.github/workflows/deploy-calendar-proxy.yml`. Subscribe buttons point at Proton directly, never at the relay.
- **Proton steps** follow Proton's support article "subscribe to external calendar": "+" next to "My calendars", then "Add calendar from URL" (fallback: Settings, All settings, Calendars, Other calendars). Proton refreshes subscribed calendars every 4 to 16 hours, Google up to 24 hours: the page tells visitors to check it for last-minute changes.
- **Parsing:** `ical.js` 2.2.1 (ES module from jsDelivr) expands recurring events, exceptions and cancellations, from 120 days back to 400 days ahead. ical.js drops the time zone of expanded occurrences, so times are converted with `Intl` from each event's own `TZID` (`icalToMs()` in `app.js`).
- **Descriptions:** often HTML (written in Google Calendar or pasted from it). `parseDescription()` in `app.js` reads them with `DOMParser` (inert: nothing runs or loads) and rebuilds only line breaks, bold, italic, underline, lists and `http(s)`/`mailto` links; everything else is dropped. Google redirect links (`https://www.google.com/url?q=<link>&sa=D...`) are replaced by the real link everywhere: description, location, Join button, `.ics` file and Google link (`unwrapLink()`). Never insert a description into the page without going through it.
- **Weglot:** UI text and messages (`#messages`) are translated; calendar content (titles, descriptions, dates) carries `data-wg-notranslate`. Dates are formatted with `Intl` in the Weglot language.
- **Plausible events:** `CalendarSubscribe` (prop `app`), `CalendarJoin`, `CalendarAddEvent` (prop `app`), `CalendarCopyLink` (prop `link`: `calendar` or `page`).

## Info bubbles

**Files:** `/assets/info-bubbles/info-bubbles.js`, `/assets/info-bubbles/info-bubbles.css`

Accessible tooltips without dependencies: open on hover and keyboard focus, tap toggles, Escape and outside tap close, one open at a time, kept inside the viewport. `oneTakeInfoBubbles.renderGroups(container, families, items)` renders groups of chips from data (see `/4dcm/challenge-skills.js`); `oneTakeInfoBubbles.bind(root)` binds triggers written in HTML (`<button data-info-bubble="ID" aria-describedby="ID">` + an element `#ID` with the text).

## Phone field (WhatsApp number)

**Files:** `/assets/phone-field/phone-field.js`, `/assets/phone-field/phone-field.css`, library in `/assets/vendor/intl-tel-input/`

Every form that captures a buyer or a lead asks for an optional "WhatsApp number (or mobile number)", with a country picker. The value always leaves the page in E.164 format (`+33612345678`) and ends up in the Userlist user property `telephone`.

- **Library:** intl-tel-input, self-hosted (never load it from a CDN). Version, source and file hashes are in `/assets/vendor/intl-tel-input/README.md`, with the upgrade steps. Country names come from the browser in the page language; the picker's own strings for our 8 languages are in `UI_TRANSLATIONS` in `phone-field.js`.
- **Markup:** load `phone-field.js` (it adds both stylesheets itself), then put an `<input type="tel" name="telephone" autocomplete="tel">` with its own label after the email field. Keep the 50 px under the email field for useBouncer: the phone label may sit in that space (see `.signup__phone-label` in `/instagram/style.css`), the input never does.
- **API:** `oneTakePhoneField.attach(input, { lang })` turns the input into the picker (initial country from the browser locale, else the page language); `read(input)` returns `{ value, valid }` (empty is valid, `value` is E.164 or `''`); `setValue(input, number)` prefills; `fromUrl()` reads `?telephone=` (an unencoded `+` is read correctly, a Liquid tag is ignored).
- **Optional, never blocking:** an invalid number shows an error until it is fixed or erased. If the library cannot load, the field stays a plain input and only a well-formed international number is kept.
- **Where it goes:** Paddle flows put it in `customData.telephone` (`checkout-core.js`), and the Paddle webhook sync writes it to Userlist. Airwallex (`/checkout`, `/wire`, then `Purchase` from the checkout metadata) and the masterclass forms (`userlist-proxy.ts`) set the Userlist property directly. Both edge scripts drop a malformed number silently and never erase a stored one.

## Le Challenge des Experts à Haute Valeur (`/4dcm/le-challenge/`)

French-only sales page (Weglot disabled), styled like `/bootcamps/ehv/le-cercle/` (its `style.css` is a copy plus the page's components). Card payments through Airwallex, wire transfer for the annual plan, success page `/4dcm/le-challenge/merci/`.

- **Dates (Europe/Paris):** annual plan only, until Fri Oct 30, 23:59:59; from Sat Oct 31, 00:00, annual and quarterly (wire transfer stays annual only); closed after Mon Nov 2, 23:59:59 (the countdown bar redirects to `/oto/too-late/`). The same dates live in three places, keep them in sync: `CONFIG` in `app.js`, `data-deadline` in `index.html`, `PLANS` in `edge-scripts/airwallex-checkout.ts`.
- **Preview:** `?preview_state=launch` or `?preview_state=quarterly` changes the display only (the edge script still follows the real dates); `?unlockfor=1` disables the countdown redirect.
- **Skills:** the 31 skills of section 6 live in `/4dcm/challenge-skills.js`, shared with `/4dcm/acces-challenge/`. `app.js` only handles the offer dates.

## Accès Challenge for OneTake customers (`/4dcm/acces-challenge/`)

Version of the Challenge page for current and former OneTake customers, sent by link (`noindex`). Copy rewritten for two cases: customers whose videos don't sell enough, and customers who never made their videos because they didn't know what to present or sell. Keeps the 2026 dates (Welcome Ceremony on Nov 3, then its replay; Challenge from Dec 1 to Dec 20) but has no countdown and never closes.

- **Plans:** annual by default, Airwallex plan key `challenge-access-yearly` (same price and bonuses as `challenge-yearly`, wire transfer allowed, no `closesAt`). `?plan=quarterly` also shows the quarterly plan `challenge-access-quarterly` (same price and bonuses as `challenge-quarterly`, card only, no window), through `data-offer-state="quarterly"` on `<html>` set by the inline script in `<head>`; it is remembered in `sessionStorage` for the browser session, so the checkout's back link (no parameter) keeps it. Both plans redirect to `/4dcm/acces-challenge/merci/`.
- **Customers:** active subscribers get the remaining days of their subscription added, prorated; former customers get OneTake reactivated at the Scale level. The team does both by hand from the Userlist `Purchase` event.
- **Shared files:** `/4dcm/le-challenge/style.css` and `/4dcm/challenge-skills.js`. It does not load `le-challenge/app.js` (offer dates).

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

1. **Step 1:** First name + email + optional WhatsApp number (see "Phone field") + (if multi-plan) plan selector + CTA
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

## Email fields and useBouncer

`tools.js` loads useBouncer, which checks every email field on the page and shows its validation message (about 44 px tall) right under the field. Every email field must leave at least 50 px of free space below it, so the message never covers the next field or the submit button: give the field a bottom margin of 50 px, or put a short text label in that space (as on `/instagram/`: the "Now tap here:" label above the button). Also give the input the `bouncer` class, like the other forms. Examples: `.awx-field--email` in `/assets/airwallex/airwallex-checkout.css`, `.mc-field--email` in `/masterclass/masterclass.css`, `.signup__cta-label` in `/instagram/style.css`.

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

- The signup form is prefilled from `?first_name=`, `?email=` and `?telephone=` (`prefillFromUrl()` in `app.js`); a value still holding an unrendered Liquid tag is ignored. The optional WhatsApp field (see "Phone field") has its error message in `#messages`.
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
- **Prefill:** every registration form (`form.mc-form`) is prefilled from `?first_name=` and `?email=` (and `?telephone=`); a value still holding an unrendered Liquid tag is ignored.
- **WhatsApp number:** every registration form has the optional phone field (see "Phone field"), sent to the proxy as `telephone`; its error message is `messages.telephone` in each `config.js`. It is saved with the lead in the browser, so the offer pages and the trial form of page 3 reuse it.
- **Leads:** forms POST to the Userlist proxy (`edge-scripts/userlist-proxy.ts`) with `Accept: application/json`, `event=CompleteRegistration`, `language`, `masterclass_slug=traffic` and, in French, `attends_masterclass_on` (ISO 8601 UTC of the session). The proxy answers JSON in that mode, so the page can show an inline error; plain HTML forms still get the 302 redirect. Only `Lead`, `CompleteRegistration` and `FormSubmit` events are allowed.
- **Variant `/masterclass/trafic/recherche/`** (`noindex`, canonical to `/masterclass/trafic/`): same funnel and config (`../config.js`), "On recherche 11 coachs ou formateurs en ligne" angle (11 per live session, never counted or enforced). Compare it with page 1 through the UTMs of the ad links; it adds no tracking value of its own. After registration, `masterclass.js` replaces the form with `<template id="mcStep2Template">`: optional questions sent to the proxy with `event=FormSubmit` and saved on the Userlist user. Choice values are English slugs (multiple choices as comma-separated slugs) or numbers: `audience_size` is the top of the range (0, 100, 1000, 10000, 100000, 1000000) and `estimated_volume` reuses the signup form's video frequency field (videos per year: 365, 150, 50, 25, 10, 1, 0); the allowed values live in `QUALIFICATION_CHOICES` in `edge-scripts/userlist-proxy.ts`, so add a new option there as well as in the page. It also fires the Plausible goal `formSubmit`, the same goal as the signup form. Whatever happens, the visitor then goes to page 2.
- **Layout variants `/masterclass/trafic/1/` and `/masterclass/trafic/2/`** (`noindex`, canonical to `/masterclass/trafic/`): same funnel, config (`../config.js`), copy and forms as page 1, laid out like the former Systeme.io pages. `/1/` copies `yes.onetake.ai/webinaire-fr`: every CTA (`[data-mv-open]`) opens the registration popup, and the reviews are the Revue wall from `/instagram/`. `/2/` copies `yes.onetake.ai/webinaire-direct-fr-fb`: the form is on the page (`#inscription`) and the bottom CTA scrolls to it (`[data-mv-scroll]`). Both show the same form in a popup on exit intent (desktop only, once per browser session). Shared files: `masterclass/variants.css` (classes `mv-`, `mv1-`, `mv2-`) and `masterclass/variants.js`, loaded after `masterclass.js`. When you change page 1's copy (bullets, bonus, host bio, footer), update these two pages too. Compare them through the UTMs of the ad links.
- **Tracking:** after Userlist accepts a lead, the page fires the FirstPromoter referral (`fpr('referral', { email })`, as on `/instagram/`) and the Plausible goal `CompleteRegistration` (props `language`, `masterclass_slug`) before going to page 2. The edge script also sets the user property `Register_to_a_webinar_on` (UTC time of the registration) on every `CompleteRegistration`.
- **Affiliates and UTMs:** affiliate links use `?ref=` (FirstPromoter). The forms send `ref` as `referred_by`, plus `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_channel`; the edge script saves them on the Userlist user (last touch: a new value replaces the old one, an empty value never erases it) and on the `CompleteRegistration` event. The last link with any of these parameters is remembered for 30 days in the browser (`localStorage`), so a visitor who registers later without them is still attributed.
- **Offer pages** (`masterclass/offer.js`, `masterclass/offer-deadline.js`, settings in `MASTERCLASS_CONFIG.offer`):
  - Two plans, `scale-yearly-offer` (999 a year) and `scale-quarterly-offer` (299 a quarter) from `pricing-data.js`. Mark prices with `data-offer-price="yearly|quarterly"`: `offer.js` adds the Paddle price ID from `pricing-data.js`, then `price-localizer.js` localizes them. Values of bonuses are `.money` amounts ($ in English, same numbers in € in French).
  - CTA blocks are cloned from `<template id="offerCtaTemplate">` into every `[data-offer-cta]`; the selectors stay in sync. Every checkout button first opens the buyer popup (first name, email, optional WhatsApp number), always shown and prefilled from `?first_name=` / `?email=` / `?telephone=` or the lead saved in the browser; its copy lives in `offer.form` in each `config.js`. The popup saves the lead and fires the FirstPromoter referral, then checkout goes through `checkout-core.js`, so the abandoned checkout carries the buyer's details.
  - `/oto/` is the only other page that opens Paddle without a form, on purpose: it is a one-click upsell right after a purchase, with the email from `?email=`.
  - Deadlines: English, 6 days after `?registered_on=` (the earlier of the URL and stored values) at midnight in the visitor's time zone; French, the Wednesday after the Thursday live (or after `?attends_masterclass_on=`) at midnight Paris time. Dates in the URL can be ISO 8601 or Userlist's email format (`2026-10-08 18:00:00 UTC`); without an offset they are read as UTC. After the deadline the page redirects to `expiredRedirectUrl` (`/oto/too-late/`); `?unlockfor=1` previews without the redirect.
  - English reveal: the sales content (`#offerContent`) is hidden for `revealAfterSeconds` (270) of time on page, unless `?offer=1` or a previous unlock (stored in `localStorage`).
  - Tests: `/masterclass/tests/offer-deadline.test.html`.
- **Session date:** always use `masterclassSession.next()` / `formatFr()` from `session-date.js`, never a date computed elsewhere. The cutoff (default Thursday 21:00) is in the config. Tests: open `/masterclass/tests/session-date.test.html` in a browser; all tests must pass.
- **French page 3 countdown:** `masterclass.mountSessionCountdown()` injects `/oto/countdown/countdown.js` with the session start as `data-deadline` and the live URL as `data-redirect`, so visitors are sent to the live when it starts (or immediately if they open the page during the session).
- **Footer:** the standard footer, plus the creators disclaimer and "OneTake Pte Ltd, Singapore". A newsletter consent line is drafted in `PLACEHOLDERS.md`, to add once confirmed.
- **Accounts scanner (page 1):** `masterclass.js` renders `MASTERCLASS_CONFIG.profiles` into `#mcScan`: two rows of screenshots looping in opposite directions under a scan overlay (still for visitors with reduced motion). Screenshots live in `/masterclass/images/` (288x640 JPEG). That folder's `index.html` redirects to `/masterclass/traffic/`, so the folder is never listed.
- **Email subject on page 2:** `email.subject` keeps the Userlist Liquid tag `{{ user.first_name | capitalize }}`; the page replaces it with the visitor's first name (or drops it when unknown).
- **Copy:** in this funnel only, "our AI" / "notre IA" is allowed. French typography: non-breaking space (`&nbsp;`) before `:`, `;`, `!`, `?` and inside « guillemets ». Highlight key headline words with `<span class="hl">`.
