# Pricing Table Component

Self-contained drop-in pricing table for onetake.ai. Two files:

- `pricing-table.js` — injects its own CSS, fetches the JSON, and renders everything. Never edit the CSS variables in isolation; they cascade to both cards and the comparison table.
- `pricing-features.json` — the single source of truth for all plan copy, prices, features, and comparison rows. **This is the only file you should need to edit for most updates.**

## Embedding

```html
<div data-pricing-table></div>
<script src="/pricing-table/pricing-table.js" defer></script>
```

Place both files at `/pricing-table/` from the site root. The script resolves `pricing-features.json` relative to its own URL, so the folder structure must be kept together.

### Configuration via data attributes

| Attribute | Values | Default |
|---|---|---|
| `data-comparison` | `toggle` / `open` / `hidden` | `toggle` |
| `data-billing` | `monthly` / `yearly` | `monthly` |
| `data-cta-base` | URL string | `https://try.onetake.ai/?plan=` |
| `data-features-url` | URL string | `./pricing-features.json` |

## Prices and Paddle IDs

Prices are rendered as:
```html
<strong class="paddle-price" data-paddle-price-id="pri_xxx">€59</strong>
```

`/price-localizer.js` (loaded site-wide) replaces the text content with the visitor's local currency. The fallback values in the JSON (`monthlyFallback`, `yearlyFallback`) are shown until the localizer runs — keep them as euros.

To update a price ID, find the plan in `pricing-features.json` and change `monthlyPriceId` or `yearlyPriceId`. The `presetMonthly` / `presetYearly` values must match the keys in `/pricing-data.js` — they're appended to the CTA URL as `?plan=launch-monthly`.

Current placeholder IDs that need replacing before go-live:
- `pri_launch_monthly_placeholder`
- `pri_launch_yearly_placeholder`
- `pri_grow_monthly_placeholder`
- `pri_grow_yearly_placeholder`
- `pri_scale_monthly_placeholder`
- `pri_scale_yearly_placeholder`

## Editing features and copy

### Card highlights (`plans[n].highlights`)

Each item in `highlights` renders as a bullet on the plan card:

```json
{ "icon": "clock", "label": "120 editing minutes / month", "tip": "...", "soon": true }
```

- `icon` — key from the icon set in `pricing-table.js` (`clock`, `video`, `spark`, `host`, `youtube`, `shorts`, `lock`, `support`, `social`, `thumb`, `podcast`, `import`, `team`, `api`). Adding a new icon requires editing the `ICONS` object in `pricing-table.js`.
- `tip` — tooltip text shown on (i) click. Write for a non-technical coach/course creator; explain the benefit, not the mechanism.
- `soon: true` — adds a "Soon!" pill inline. Remove the key entirely once live.

### Comparison rows (`comparisonGroups[n].rows`)

```json
{
  "label": "Editing minutes per month",
  "tip": "...",
  "values": ["120 min", "240 min", "600 min"],
  "status": "live"
}
```

`values` must have exactly 3 entries, in Launch / Grow / Scale order.

**`status` values:**
- `"live"` — shown normally
- `"soon"` — shown with a "Soon!" pill; include in the table but not yet available
- `"far"` — hidden entirely; keep in the JSON as a reminder but don't ship

**Special value types in `values`:**
- `"yes"` → green tick
- `"no"` → dash
- `"addon"` → amber "Add-on" pill
- Any other string → rendered as plain text
- Object `{ "trial": "Try once on a ≤30 min video", "after": "€0.50/min after" }` → stacked try-once cell for pay-per-use features (translation, dubbing, gaze correction, background removal)

### Adding a new comparison group

Append to `comparisonGroups`. The group title renders as a section header row spanning all columns.

### Adding a new plan

The component is hardcoded for 3 plans. Adding a 4th requires changes to the CSS grid in `pricing-table.js` (`.ot-cards` grid-template-columns) and the mobile comparison layout.

## Trial badge and CTA labels

`trialBadge` on the Launch plan drives the green badge above the card (monthly cycle only). On yearly, it switches to `ctaLabelNoTrial`. Set `trialBadge: null` to suppress the badge.

## "Everything in X, plus" label

`previousPlanName` on a plan renders the includes section header as "Everything in [name], plus". Remove it to show "What's included" instead.

## Featured plan

Set `"featured": true` on exactly one plan. That card gets the dark background and amber CTA. `featuredLabel` sets the badge text ("Most popular").

## Re-rendering programmatically

The component exposes two custom events on the mount element:
- `ot-pricing:rendered` — fired after every render (including billing toggle switches)
- `ot-pricing:cycle-changed` — fired when the user switches billing cycle; `event.detail.cycle` is `"monthly"` or `"yearly"`

To re-mount with different options, replace the div and re-append the script with a cache-busting query string (see the demo toolbar logic in `project/index.html`).
