/**
 * OneTake Pricing Table — drop-in script
 * ------------------------------------------------
 * Usage:
 *   <div data-pricing-table></div>
 *   <script src="/pricing-table/pricing-table.js" defer></script>
 *
 * Options (set as data-* attributes on the mount div):
 *   data-comparison="open"       Show comparison table expanded by default
 *   data-comparison="hidden"     Hide comparison table entirely
 *   data-comparison="toggle"     (default) collapsed, with a toggle button
 *   data-billing="annual"        Show annual cycle by default (default: monthly)
 *   data-cta-base="https://try.onetake.ai/?plan="    Override CTA URL prefix
 *   data-features-url="..."      Override features JSON URL
 *
 * Prices use Paddle-compatible <strong class="paddle-price" data-paddle-price-id="..."> spans
 * so /price-localizer.js can swap in the right currency for each visitor.
 */
(function () {
  'use strict';

  // ---------- Resolve the script's own folder so we can fetch siblings ----------
  var currentScript = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var scriptUrl = new URL(currentScript.src, location.href);
  var scriptDir = scriptUrl.href.replace(/[^/]*$/, '');

  // ---------- Inline styles ----------
  var CSS = `
.ot-pricing {
  --ot-cream: #f6efde;
  --ot-cream-2: #fbf6e8;
  --ot-card: #ffffff;
  --ot-ink: #1c140d;
  --ot-ink-2: #3a2d1e;
  --ot-muted: #6e6354;
  --ot-line: rgba(28, 20, 13, 0.10);
  --ot-line-strong: rgba(28, 20, 13, 0.18);
  --ot-accent: #1c140d;
  --ot-accent-ink: #fbf6e8;
  --ot-amber: #e2a93a;
  --ot-amber-soft: #f4d68a;
  --ot-amber-deep: #b07414;
  --ot-trial: #166c4c;
  --ot-trial-soft: #d8efe2;
  --ot-radius-lg: 22px;
  --ot-radius-md: 14px;
  --ot-radius-sm: 10px;
  --ot-shadow: 0 1px 0 rgba(28,20,13,0.04), 0 12px 28px -18px rgba(28,20,13,0.18);
  --ot-shadow-strong: 0 1px 0 rgba(28,20,13,0.05), 0 24px 50px -22px rgba(28,20,13,0.32);
  --ot-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;

  font-family: var(--ot-font);
  color: var(--ot-ink);
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
}
.ot-pricing *,
.ot-pricing *::before,
.ot-pricing *::after { box-sizing: border-box; }
.ot-pricing button { font-family: inherit; }

/* ============ Billing toggle ============ */
.ot-billing {
  display: flex;
  justify-content: center;
  margin: 0 0 28px;
}
.ot-billing__inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px;
  border-radius: 999px;
  background: var(--ot-card);
  border: 1px solid var(--ot-line-strong);
  box-shadow: var(--ot-shadow);
}
.ot-billing__btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--ot-ink-2);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.01em;
  padding: 9px 18px;
  border-radius: 999px;
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.ot-billing__btn:hover { color: var(--ot-ink); }
.ot-billing__btn[aria-pressed="true"] {
  background: var(--ot-ink);
  color: var(--ot-cream-2);
}
.ot-billing__save {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--ot-amber-soft);
  color: var(--ot-amber-deep);
}
.ot-billing__btn[aria-pressed="true"] .ot-billing__save {
  background: var(--ot-amber);
  color: var(--ot-ink);
}

/* ============ Cards grid ============ */
.ot-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  align-items: stretch;
}
@media (max-width: 960px) {
  .ot-cards { grid-template-columns: 1fr; gap: 16px; }
}

.ot-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--ot-card);
  border: 1px solid var(--ot-line);
  border-radius: var(--ot-radius-lg);
  padding: 28px 26px 26px;
  box-shadow: var(--ot-shadow);
}
.ot-card--featured {
  background: var(--ot-ink);
  color: var(--ot-cream-2);
  border-color: var(--ot-ink);
  box-shadow: var(--ot-shadow-strong);
}
.ot-card--featured .ot-card__name,
.ot-card--featured .ot-card__amount {
  color: var(--ot-cream-2);
}
.ot-card--featured .ot-card__tagline,
.ot-card--featured .ot-card__desc,
.ot-card--featured .ot-card__period,
.ot-card--featured .ot-card__billed,
.ot-card--featured .ot-feature__text {
  color: rgba(251, 246, 232, 0.72);
}
.ot-card--featured .ot-feature__dot {
  background: var(--ot-amber);
  color: var(--ot-ink);
}

.ot-card__badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--ot-amber);
  color: var(--ot-ink);
  box-shadow: 0 4px 12px -4px rgba(176, 116, 20, 0.4);
}
.ot-card__badge--trial {
  background: var(--ot-trial);
  color: #fff;
  box-shadow: 0 4px 12px -4px rgba(22, 108, 76, 0.45);
}

.ot-card__head { margin-bottom: 20px; }
.ot-card__name {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 2px;
}
.ot-card__tagline {
  font-size: 13px;
  font-weight: 500;
  color: var(--ot-muted);
  letter-spacing: 0.01em;
  margin: 0 0 12px;
}
.ot-card__desc {
  font-size: 14px;
  line-height: 1.45;
  color: var(--ot-ink-2);
  margin: 0;
}

.ot-card__price {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 22px 0 4px;
  min-height: 44px;
}
.ot-card__amount {
  font-size: 44px;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1;
}
.ot-card__period {
  font-size: 14px;
  font-weight: 500;
  color: var(--ot-muted);
}
.ot-card__billed {
  font-size: 12px;
  color: var(--ot-muted);
  margin: 0 0 22px;
  min-height: 18px;
}

.ot-card__cta {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  text-align: center;
  font-family: inherit;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.005em;
  padding: 14px 20px;
  border-radius: 999px;
  border: 1px solid var(--ot-ink);
  background: var(--ot-card);
  color: var(--ot-ink);
  cursor: pointer;
  transition: transform .12s ease, background .15s ease, color .15s ease, box-shadow .15s ease;
}
.ot-card__cta:hover {
  background: var(--ot-ink);
  color: var(--ot-cream-2);
  transform: translateY(-1px);
}
.ot-card--featured .ot-card__cta {
  background: var(--ot-amber);
  color: var(--ot-ink);
  border-color: var(--ot-amber);
}
.ot-card--featured .ot-card__cta:hover {
  background: var(--ot-amber-soft);
  border-color: var(--ot-amber-soft);
}
.ot-card__cta-arrow {
  width: 14px; height: 14px;
  display: inline-block;
  transition: transform .15s ease;
}
.ot-card__cta:hover .ot-card__cta-arrow { transform: translateX(3px); }

.ot-card__includes {
  margin: 24px 0 0;
  padding-top: 22px;
  border-top: 1px solid var(--ot-line);
}
.ot-card--featured .ot-card__includes { border-top-color: rgba(251, 246, 232, 0.14); }

.ot-card__includes-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--ot-muted);
  margin: 0 0 14px;
}
.ot-card--featured .ot-card__includes-label { color: rgba(251, 246, 232, 0.55); }

.ot-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.ot-feature {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 11px;
  align-items: start;
}
.ot-feature__main {
  display: inline;
  font-size: 14px;
  line-height: 1.4;
  color: var(--ot-ink-2);
}
.ot-feature__row-trail {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 6px;
  vertical-align: 1px;
}
.ot-feature__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--ot-amber-soft);
  color: var(--ot-amber-deep);
  margin-top: 2px;
  flex-shrink: 0;
}
.ot-feature__dot svg { width: 10px; height: 10px; display: block; }
.ot-feature__text {
  font-size: 14px;
  line-height: 1.4;
  color: var(--ot-ink-2);
}
.ot-feature__text strong { font-weight: 600; color: inherit; }

/* ============ Soon pill + Info tooltip (used in cards + comparison) ============ */
.ot-soon {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(176, 116, 20, 0.12);
  color: var(--ot-amber-deep);
  vertical-align: 1px;
  white-space: nowrap;
}
.ot-card--featured .ot-soon {
  background: rgba(244, 214, 138, 0.22);
  color: var(--ot-amber-soft);
}
.ot-info {
  position: relative;
  display: inline-flex;
}
.ot-info__btn {
  appearance: none;
  border: 0;
  padding: 0;
  margin: 0;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: rgba(28, 20, 13, 0.10);
  color: var(--ot-ink-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font: 700 11px/1 var(--ot-font);
  font-style: italic;
  font-family: "Times New Roman", Georgia, serif;
  transition: background .15s ease, color .15s ease;
}
.ot-info__btn:hover,
.ot-info__btn[aria-expanded="true"] {
  background: var(--ot-ink);
  color: var(--ot-cream-2);
}
.ot-card--featured .ot-info__btn {
  background: rgba(251, 246, 232, 0.14);
  color: rgba(251, 246, 232, 0.85);
}
.ot-card--featured .ot-info__btn:hover,
.ot-card--featured .ot-info__btn[aria-expanded="true"] {
  background: var(--ot-amber);
  color: var(--ot-ink);
}
.ot-tooltip {
  position: absolute;
  z-index: 30;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translate(-50%, 4px);
  width: 240px;
  max-width: min(280px, 80vw);
  background: var(--ot-ink);
  color: var(--ot-cream-2);
  font-size: 12.5px;
  line-height: 1.45;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  text-align: left;
  padding: 11px 13px;
  border-radius: 10px;
  box-shadow: 0 16px 32px -12px rgba(28,20,13,0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity .14s ease, transform .14s ease;
}
.ot-tooltip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--ot-ink);
}
.ot-info[data-open="true"] .ot-tooltip {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}
/* Edge handling: tooltips near right/left edges shift their anchor */
.ot-info[data-align="right"] .ot-tooltip { left: auto; right: -6px; transform: translate(0, 4px); }
.ot-info[data-align="right"][data-open="true"] .ot-tooltip { transform: translate(0, 0); }
.ot-info[data-align="right"] .ot-tooltip::after { left: auto; right: 12px; transform: none; }
.ot-info[data-align="left"] .ot-tooltip { left: -6px; right: auto; transform: translate(0, 4px); }
.ot-info[data-align="left"][data-open="true"] .ot-tooltip { transform: translate(0, 0); }
.ot-info[data-align="left"] .ot-tooltip::after { left: 12px; transform: none; }
/* When the tooltip lives in a tight cell, allow it to flip below */
.ot-info[data-flip="true"] .ot-tooltip { bottom: auto; top: calc(100% + 8px); }
.ot-info[data-flip="true"] .ot-tooltip::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: var(--ot-ink);
}
.ot-feature-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

/* ============ Compare-all toggle + comparison table ============ */
.ot-compare-toggle-wrap {
  display: flex;
  justify-content: center;
  margin: 36px 0 0;
}
.ot-compare-toggle {
  appearance: none;
  border: 1px solid var(--ot-line-strong);
  background: var(--ot-card);
  color: var(--ot-ink);
  font-weight: 600;
  font-size: 14px;
  padding: 11px 22px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--ot-shadow);
  transition: background .15s ease, border-color .15s ease;
}
.ot-compare-toggle:hover {
  background: rgba(28, 20, 13, 0.04);
  border-color: var(--ot-ink);
}
.ot-compare-toggle__chev {
  width: 12px; height: 12px;
  transition: transform .2s ease;
}
.ot-compare-toggle[aria-expanded="true"] .ot-compare-toggle__chev {
  transform: rotate(180deg);
}

.ot-compare {
  margin-top: 30px;
  overflow: hidden;
}
.ot-compare[hidden] { display: none; }

.ot-compare__caption {
  background: var(--ot-card);
  border: 1px solid var(--ot-line);
  border-bottom: 0;
  border-radius: var(--ot-radius-lg) var(--ot-radius-lg) 0 0;
  padding: 24px 20px 0;
}
.ot-compare__title {
  text-align: center;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.015em;
  margin: 0 0 6px;
}
.ot-compare__sub {
  text-align: center;
  color: var(--ot-muted);
  font-size: 14px;
  margin: 0 0 28px;
}

.ot-compare__scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: 0 0 var(--ot-radius-lg) var(--ot-radius-lg);
  border: 1px solid var(--ot-line);
  border-top: 0;
  background: var(--ot-card);
}
.ot-compare__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 720px;
}
.ot-compare__table th,
.ot-compare__table td {
  text-align: left;
  padding: 16px 20px;
  vertical-align: middle;
  font-size: 14px;
  border-bottom: 1px solid var(--ot-line);
}
.ot-compare__table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--ot-cream-2);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 14px 20px;
  border-bottom: 1px solid var(--ot-line-strong);
}
.ot-compare__table thead th.ot-th-plan {
  text-align: center;
  font-size: 15px;
  letter-spacing: -0.005em;
}
.ot-compare__table thead th.ot-th-plan--featured {
  color: var(--ot-amber-deep);
}
.ot-compare__table td.ot-td-value {
  text-align: center;
  font-weight: 500;
  color: var(--ot-ink);
  white-space: nowrap;
}
.ot-compare__table td.ot-td-value--featured {
  background: rgba(226, 169, 58, 0.06);
}
.ot-compare__table th.ot-th-plan--featured {
  background: linear-gradient(180deg, rgba(226,169,58,0.18) 0%, rgba(226,169,58,0.06) 100%);
}
.ot-compare__table td.ot-td-feature {
  color: var(--ot-ink-2);
  font-weight: 500;
}
.ot-compare__group-row td {
  background: rgba(28, 20, 13, 0.025);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--ot-muted);
  padding: 14px 20px;
}
.ot-compare__table tr:last-child td { border-bottom: 0; }

.ot-tick {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(22, 108, 76, 0.12);
  color: var(--ot-trial);
}
.ot-tick svg { width: 12px; height: 12px; }
.ot-dash {
  display: inline-block;
  width: 14px;
  height: 2px;
  background: rgba(28, 20, 13, 0.22);
  border-radius: 2px;
  vertical-align: middle;
}
.ot-trial-cell {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
  font-size: 12.5px;
  line-height: 1.35;
  white-space: normal;
  max-width: 200px;
  margin: 0 auto;
}
.ot-trial-cell__try {
  color: var(--ot-ink-2);
  font-weight: 500;
}
.ot-trial-cell__after {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ot-amber-deep);
}
.ot-addon {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(176, 116, 20, 0.10);
  color: var(--ot-amber-deep);
  white-space: nowrap;
}

/* Mobile: collapse comparison table into stacked cards-with-tabs */
@media (max-width: 720px) {
  .ot-compare__caption {
    border-bottom: 1px solid var(--ot-line);
    border-radius: var(--ot-radius-lg);
    margin-bottom: 20px;
  }
  .ot-compare__scroll {
    border: 0;
    background: transparent;
    overflow: visible;
  }
  .ot-compare__table { min-width: 0; }
  .ot-compare__table,
  .ot-compare__table thead,
  .ot-compare__table tbody,
  .ot-compare__table tr,
  .ot-compare__table th,
  .ot-compare__table td { display: block; width: auto; }

  .ot-compare__table thead { display: none; }
  .ot-compare__table tr.ot-compare__group-row td {
    margin: 18px 0 8px;
    background: transparent;
    padding: 0;
    border: 0;
  }
  .ot-compare__table tbody tr:not(.ot-compare__group-row) {
    background: var(--ot-card);
    border: 1px solid var(--ot-line);
    border-radius: var(--ot-radius-md);
    margin-bottom: 8px;
    padding: 14px 16px;
  }
  .ot-compare__table tbody tr:not(.ot-compare__group-row) td {
    border: 0;
    padding: 4px 0;
  }
  .ot-compare__table td.ot-td-feature {
    font-weight: 600;
    color: var(--ot-ink);
    margin-bottom: 8px;
  }
  .ot-compare__table td.ot-td-value {
    display: grid !important;
    grid-template-columns: 80px 1fr;
    gap: 12px;
    align-items: center;
    text-align: left;
    white-space: normal;
    padding: 6px 0 !important;
    background: transparent !important;
    border-top: 1px dashed var(--ot-line) !important;
  }
  .ot-compare__table td.ot-td-value::before {
    content: attr(data-plan);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ot-muted);
  }
  .ot-compare__table td.ot-td-value--featured::before {
    color: var(--ot-amber-deep);
  }
}

/* Footnote */
.ot-foot {
  margin-top: 22px;
  text-align: center;
  font-size: 12px;
  color: var(--ot-muted);
}

/* Loading + error */
.ot-pricing__loading,
.ot-pricing__error {
  padding: 40px 20px;
  text-align: center;
  color: var(--ot-muted);
  font-size: 14px;
}
.ot-pricing__error { color: #b04714; }
`;

  function injectStyles() {
    if (document.getElementById('ot-pricing-styles')) return;
    var style = document.createElement('style');
    style.id = 'ot-pricing-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ---------- Icons ----------
  var ICONS = {
    check: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev:  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // ---------- Render helpers ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function priceSpan(priceId, fallback) {
    return '<strong data-paddle-price-id="' + esc(priceId) + '" class="paddle-price ot-card__amount">' + esc(fallback) + '</strong>';
  }

  // Tooltip + Soon-pill helpers (used by cards AND comparison rows)
  var TIP_UID = 0;
  function tipHtml(text, opts) {
    if (!text) return '';
    opts = opts || {};
    var align = opts.align || 'center'; // 'left' | 'center' | 'right'
    var alignAttr = align !== 'center' ? (' data-align="' + align + '"') : '';
    var flipAttr = opts.flip ? ' data-flip="true"' : '';
    var id = 'ot-tt-' + (++TIP_UID);
    return ''
      + '<span class="ot-info" data-open="false"' + alignAttr + flipAttr + '>'
      +   '<button type="button" class="ot-info__btn" aria-label="What\u2019s this?" aria-expanded="false" aria-describedby="' + id + '" data-ot-tip>i</button>'
      +   '<span class="ot-tooltip" role="tooltip" id="' + id + '">' + esc(text) + '</span>'
      + '</span>';
  }
  function soonPill() {
    return '<span class="ot-soon">Soon!</span>';
  }

  function renderFeature(item) {
    var trail = '';
    if (item.soon) trail += soonPill();
    if (item.tip)  trail += tipHtml(item.tip, { align: 'left' });
    return ''
      + '<li class="ot-feature">'
      +   '<span class="ot-feature__dot">' + ICONS.check + '</span>'
      +   '<span class="ot-feature__main">'
      +     '<span class="ot-feature__text">' + esc(item.label) + '</span>'
      +     (trail ? '<span class="ot-feature__row-trail">' + trail + '</span>' : '')
      +   '</span>'
      + '</li>';
  }

  function renderCard(plan, idx, cycle, ctaBase) {
    var preset = cycle === 'yearly' ? plan.presetYearly : plan.presetMonthly;
    var priceId = cycle === 'yearly' ? plan.yearlyPriceId : plan.monthlyPriceId;
    var fallback = cycle === 'yearly' ? plan.yearlyFallback : plan.monthlyFallback;
    var period = cycle === 'yearly' ? '/ mo' : '/ month';
    var billed = cycle === 'yearly'
      ? 'Billed annually'
      : 'Billed monthly';

    var ctaLabel = (cycle === 'yearly' && plan.ctaLabelYearly) || plan.ctaLabel;
    if (cycle !== 'monthly' && plan.trialBadge && plan.ctaLabelNoTrial) {
      // For yearly Launch, swap to the no-trial label
      ctaLabel = plan.ctaLabelNoTrial;
    }

    var badgeHtml = '';
    if (plan.trialBadge && cycle === 'monthly') {
      badgeHtml = '<span class="ot-card__badge ot-card__badge--trial">' + esc(plan.trialBadge) + '</span>';
    } else if (plan.featured && plan.featuredLabel) {
      badgeHtml = '<span class="ot-card__badge">' + esc(plan.featuredLabel) + '</span>';
    }

    var featuresHtml = (plan.highlights || []).map(renderFeature).join('');

    var includesLabel = plan.previousPlanName
      ? 'Everything in ' + plan.previousPlanName + ', plus'
      : 'What\u2019s included';

    return ''
      + '<article class="ot-card' + (plan.featured ? ' ot-card--featured' : '') + '" data-plan-id="' + esc(plan.id) + '">'
      +   badgeHtml
      +   '<header class="ot-card__head">'
      +     '<h3 class="ot-card__name">' + esc(plan.name) + '</h3>'
      +     '<p class="ot-card__tagline">' + esc(plan.tagline) + '</p>'
      +     '<p class="ot-card__desc">' + esc(plan.description) + '</p>'
      +   '</header>'
      +   '<div class="ot-card__price">'
      +     priceSpan(priceId, fallback)
      +     '<span class="ot-card__period">' + period + '</span>'
      +   '</div>'
      +   '<p class="ot-card__billed">' + esc(billed) + '</p>'
      +   '<a class="ot-card__cta" href="' + esc(ctaBase + preset) + '" data-plan-preset="' + esc(preset) + '">'
      +     '<span>' + esc(ctaLabel) + '</span>'
      +     '<span class="ot-card__cta-arrow">' + ICONS.arrow + '</span>'
      +   '</a>'
      +   '<div class="ot-card__includes">'
      +     '<p class="ot-card__includes-label">' + esc(includesLabel) + '</p>'
      +     '<ul class="ot-features">' + featuresHtml + '</ul>'
      +   '</div>'
      + '</article>';
  }

  function renderValueCell(value) {
    if (value === 'yes' || value === true) {
      return '<span class="ot-tick">' + ICONS.check + '</span>';
    }
    if (value === 'no' || value === false || value == null || value === '') {
      return '<span class="ot-dash" aria-label="Not included"></span>';
    }
    if (value === 'addon' || value === 'add-on') {
      return '<span class="ot-addon">Add-on</span>';
    }
    if (typeof value === 'object' && value !== null) {
      // Try-once-then-priced cell: { trial: '...', after: '...' }
      if (value.trial || value.after) {
        return ''
          + '<span class="ot-trial-cell">'
          +   (value.trial ? '<span class="ot-trial-cell__try">' + esc(value.trial) + '</span>' : '')
          +   (value.after ? '<span class="ot-trial-cell__after">' + esc(value.after) + '</span>' : '')
          + '</span>';
      }
      return '';
    }
    return esc(value);
  }

  function renderComparison(data) {
    var plans = data.plans;
    var groups = data.comparisonGroups || [];

    var headCells = plans.map(function (p) {
      var cls = 'ot-th-plan' + (p.featured ? ' ot-th-plan--featured' : '');
      return '<th class="' + cls + '">' + esc(p.name) + '</th>';
    }).join('');

    var bodyHtml = groups.map(function (group) {
      // Filter out 'far' status rows; keep 'live' and 'soon'
      var visibleRows = (group.rows || []).filter(function (r) {
        var s = (r.status || 'live').toLowerCase();
        return s !== 'far' && s !== 'far-roadmap' && s !== 'farroadmap';
      });
      if (!visibleRows.length) return '';

      var rowsHtml = visibleRows.map(function (row) {
        var isSoon = (row.status || '').toLowerCase() === 'soon';
        var cells = row.values.map(function (v, i) {
          var p = plans[i];
          var cls = 'ot-td-value' + (p && p.featured ? ' ot-td-value--featured' : '');
          return '<td class="' + cls + '" data-plan="' + esc(p ? p.name : '') + '">' + renderValueCell(v) + '</td>';
        }).join('');
        var labelInner = ''
          + '<span class="ot-feature-label">'
          +   '<span>' + esc(row.label) + '</span>'
          +   (isSoon ? soonPill() : '')
          +   (row.tip ? tipHtml(row.tip, { align: 'left' }) : '')
          + '</span>';
        return '<tr><td class="ot-td-feature">' + labelInner + '</td>' + cells + '</tr>';
      }).join('');
      return ''
        + '<tr class="ot-compare__group-row"><td colspan="' + (plans.length + 1) + '">' + esc(group.title) + '</td></tr>'
        + rowsHtml;
    }).join('');

    return ''
      + '<section class="ot-compare" id="ot-compare">'
      +   '<div class="ot-compare__caption">'
      +     '<h2 class="ot-compare__title">Compare every feature</h2>'
      +     '<p class="ot-compare__sub">A full breakdown of what\u2019s included in each plan.</p>'
      +   '</div>'
      +   '<div class="ot-compare__scroll">'
      +     '<table class="ot-compare__table">'
      +       '<thead><tr><th>Feature</th>' + headCells + '</tr></thead>'
      +       '<tbody>' + bodyHtml + '</tbody>'
      +     '</table>'
      +   '</div>'
      + '</section>';
  }

  // ---------- Main render ----------
  function render(mount, data, opts) {
    var cycle = opts.billing === 'yearly' ? 'yearly' : 'monthly';
    var compareMode = opts.comparison || 'toggle'; // 'toggle' | 'open' | 'hidden'
    var ctaBase = opts.ctaBase || 'https://try.onetake.ai/?plan=';

    function build() {
      var billingHtml = ''
        + '<div class="ot-billing" role="group" aria-label="Billing cycle">'
        +   '<div class="ot-billing__inner">'
        +     '<button class="ot-billing__btn" type="button" data-cycle="monthly" aria-pressed="' + (cycle === 'monthly') + '">Monthly</button>'
        +     '<button class="ot-billing__btn" type="button" data-cycle="yearly" aria-pressed="' + (cycle === 'yearly') + '">'
        +       'Annual <span class="ot-billing__save">Save ~17%</span>'
        +     '</button>'
        +   '</div>'
        + '</div>';

      var cardsHtml = '<div class="ot-cards">'
        + data.plans.map(function (p, i) { return renderCard(p, i, cycle, ctaBase); }).join('')
        + '</div>';

      var compareHtml = '';
      if (compareMode !== 'hidden') {
        var compareSection = renderComparison(data);
        if (compareMode === 'open') {
          compareHtml = compareSection;
        } else {
          compareHtml = ''
            + '<div class="ot-compare-toggle-wrap">'
            +   '<button class="ot-compare-toggle" type="button" aria-expanded="false" aria-controls="ot-compare">'
            +     '<span class="ot-compare-toggle__label">Compare all features</span>'
            +     '<span class="ot-compare-toggle__chev">' + ICONS.chev + '</span>'
            +   '</button>'
            + '</div>'
            + compareSection.replace('<section class="ot-compare"', '<section class="ot-compare" hidden');
        }
      }

      mount.innerHTML = billingHtml + cardsHtml + compareHtml;

      // Wire billing toggle
      mount.querySelectorAll('.ot-billing__btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var next = btn.getAttribute('data-cycle');
          if (next === cycle) return;
          cycle = next;
          build();
          // Re-trigger price localizer if present
          if (window.PriceLocalizer && typeof window.PriceLocalizer.refresh === 'function') {
            window.PriceLocalizer.refresh(mount);
          } else if (typeof window.localizePrices === 'function') {
            try { window.localizePrices(mount); } catch (e) {}
          }
          // Custom event hook
          mount.dispatchEvent(new CustomEvent('ot-pricing:cycle-changed', { detail: { cycle: cycle } }));
        });
      });

      // Wire compare toggle
      var toggle = mount.querySelector('.ot-compare-toggle');
      var compareEl = mount.querySelector('.ot-compare');
      if (toggle && compareEl) {
        toggle.addEventListener('click', function () {
          var expanded = toggle.getAttribute('aria-expanded') === 'true';
          var next = !expanded;
          toggle.setAttribute('aria-expanded', String(next));
          if (next) {
            compareEl.hidden = false;
            toggle.querySelector('.ot-compare-toggle__label').textContent = 'Hide comparison';
          } else {
            compareEl.hidden = true;
            toggle.querySelector('.ot-compare-toggle__label').textContent = 'Compare all features';
          }
        });
      }

      // Wire tooltips (event delegation; works across re-renders)
      wireTooltips(mount);

      // Tell the price-localizer that new prices need processing
      mount.dispatchEvent(new CustomEvent('ot-pricing:rendered', { detail: { cycle: cycle } }));
      // Standard event many localizers listen for
      document.dispatchEvent(new CustomEvent('paddle-prices-updated', { detail: { container: mount } }));
    }

    build();
  }

  // ---------- Tooltip behavior ----------
  var GLOBAL_TT_BOUND = false;
  function closeAllTooltips(root) {
    var scope = root || document;
    scope.querySelectorAll('.ot-info[data-open="true"]').forEach(function (info) {
      info.setAttribute('data-open', 'false');
      var btn = info.querySelector('.ot-info__btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }
  function positionTooltip(info) {
    var btn = info.querySelector('.ot-info__btn');
    if (!btn) return;
    var rect = btn.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    // Horizontal alignment based on button position in viewport
    if (rect.left < 160) {
      info.setAttribute('data-align', 'left');
    } else if (vw - rect.right < 160) {
      info.setAttribute('data-align', 'right');
    } else {
      info.removeAttribute('data-align');
    }
    // Vertical: flip below if tooltip would clip off the top
    if (rect.top < 140) {
      info.setAttribute('data-flip', 'true');
    } else {
      info.removeAttribute('data-flip');
    }
  }
  function wireTooltips(mount) {
    // Delegated click on info buttons inside this mount
    mount.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-ot-tip]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var info = btn.closest('.ot-info');
      if (!info) return;
      var open = info.getAttribute('data-open') === 'true';
      // close any others in this mount
      closeAllTooltips(mount);
      if (!open) {
        positionTooltip(info);
        info.setAttribute('data-open', 'true');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    // Document-level dismissers: bind once globally
    if (!GLOBAL_TT_BOUND) {
      GLOBAL_TT_BOUND = true;
      document.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('.ot-info')) return;
        closeAllTooltips();
      }, true);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') closeAllTooltips();
      });
      window.addEventListener('resize', function () { closeAllTooltips(); });
      window.addEventListener('scroll', function () { closeAllTooltips(); }, true);
    }
  }

  // ---------- Bootstrap ----------
  function init() {
    injectStyles();
    var mounts = document.querySelectorAll('[data-pricing-table]');
    if (!mounts.length) return;

    mounts.forEach(function (mount) {
      mount.classList.add('ot-pricing');
      mount.innerHTML = '<div class="ot-pricing__loading">Loading plans\u2026</div>';

      var opts = {
        billing: mount.getAttribute('data-billing') || 'monthly',
        comparison: mount.getAttribute('data-comparison') || 'toggle',
        ctaBase: mount.getAttribute('data-cta-base') || 'https://try.onetake.ai/?plan=',
        featuresUrl: mount.getAttribute('data-features-url') || (scriptDir + 'pricing-features.json')
      };

      fetch(opts.featuresUrl, { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (data) { render(mount, data, opts); })
        .catch(function (err) {
          mount.innerHTML = '<div class="ot-pricing__error">Could not load pricing (' + esc(err.message) + ').</div>';
          // eslint-disable-next-line no-console
          console.error('[OneTake pricing-table]', err);
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
