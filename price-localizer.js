/**
 * price-localizer.js — Paddle price localization
 *
 * Scans for [data-paddle-price-id] elements and replaces their content with
 * the visitor's local currency equivalent using Paddle.PricePreview().
 *
 * Usage:
 *   1. Include this script AFTER paddle.js and AFTER Paddle.Initialize() has been called.
 *   2. Call window.localizePrices() explicitly after Paddle.Initialize().
 *   3. Mark price elements: <span data-paddle-price-id="pri_xxx">995 €</span>
 *
 * All prices are rounded to the nearest integer and displayed with the
 * unambiguous currency symbol (S$ for SGD, A$ for AUD, $ for USD, € for EUR).
 * Dollar-family currencies are formatted in their native locale so the symbol
 * is correct regardless of the visitor's browser language setting.
 * Elements with data-paddle-price-divisor="N" divide the price by N before
 * rounding (for per-month figures derived from a quarterly or annual total).
 *
 * All elements should also carry the CSS class "paddle-price" so that Weglot
 * can be told to exclude them from translation.
 */

window.localizePrices = function () {
  if (typeof Paddle === 'undefined') return;

  var spans = document.querySelectorAll('[data-paddle-price-id]');
  if (!spans.length) return;

  // Collect unique price IDs
  var priceIdSet = {};
  spans.forEach(function (el) {
    var id = el.getAttribute('data-paddle-price-id');
    if (id) priceIdSet[id] = true;
  });

  var priceIds = Object.keys(priceIdSet);

  // One PricePreview call for all prices on the page
  Paddle.PricePreview({
    items: priceIds.map(function (id) { return { priceId: id, quantity: 1 }; })
  })
  .then(function (result) {
    var lineItems = result.data.details.lineItems;
    var currencyCode = result.data.currencyCode;

    // Build a map of priceId → raw pre-tax subtotal (Paddle returns minor units)
    var priceMap = {};
    lineItems.forEach(function (item) {
      priceMap[item.price.id] = parseFloat(item.totals.subtotal) / 100;
    });

    // Dollar-family currencies need their native locale so 'symbol' is unambiguous:
    // SGD in en-US gives '$', but SGD in en-SG gives 'S$'. Same issue for AUD, CAD, etc.
    var NATIVE_LOCALE = {
      AUD: 'en-AU', CAD: 'en-CA', HKD: 'en-HK',
      MXN: 'es-MX', NZD: 'en-NZ', SGD: 'en-SG', TWD: 'zh-TW'
    };
    var locale = NATIVE_LOCALE[currencyCode] || navigator.language;

    // Update each span — always round, always use the unambiguous currency symbol
    spans.forEach(function (el) {
      var id      = el.getAttribute('data-paddle-price-id');
      var divisor = parseFloat(el.getAttribute('data-paddle-price-divisor')) || 1;
      var raw     = priceMap[id];
      if (raw == null) return;

      var amount = Math.round(raw / divisor);

      try {
        el.textContent = new Intl.NumberFormat(locale, {
          style:           'currency',
          currency:        currencyCode,
          currencyDisplay: 'symbol',
          maximumFractionDigits: 0
        }).format(amount);
      } catch (e) {
        // Intl failed entirely — leave content unchanged
      }
    });
  })
  .catch(function () {
    // PricePreview failed (e.g. unsupported region) — keep original prices
  });
};
