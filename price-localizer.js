/**
 * price-localizer.js — Paddle price localization
 *
 * Scans for [data-paddle-price-id] elements and replaces their content with
 * the visitor's local currency equivalent using Paddle.PricePreview().
 *
 * Usage:
 *   1. Include this script AFTER paddle.js and AFTER Paddle.Initialize() has been called.
 *   2. Call window.localizePrices() explicitly after Paddle.Initialize().
 *   3. Mark price elements: <span data-paddle-price-id="pri_xxx">$99</span>
 *
 * The element's text content is replaced with the formatted localized price
 * (pre-tax / subtotal, e.g. "$99" for USD visitors, "€85" for EUR visitors).
 * Elements with data-paddle-price-divisor="N" divide the price by N (for
 * per-month calculations derived from a quarterly total) and round DOWN.
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

    // Build a map of priceId → pre-tax subtotal (formatted + raw)
    var priceMap = {};
    lineItems.forEach(function (item) {
      priceMap[item.price.id] = {
        formatted: item.formattedTotals.subtotal,
        raw:       parseFloat(item.totals.subtotal) / 100   // Paddle returns minor units
      };
    });

    // Update each span
    spans.forEach(function (el) {
      var id      = el.getAttribute('data-paddle-price-id');
      var divisor = parseFloat(el.getAttribute('data-paddle-price-divisor')) || 1;
      var entry   = priceMap[id];
      if (!entry) return;

      if (divisor !== 1) {
        // Divide and round DOWN, then reformat with Intl
        var divided = Math.floor(entry.raw / divisor);
        try {
          el.textContent = new Intl.NumberFormat(navigator.language, {
            style:    'currency',
            currency: currencyCode,
            maximumFractionDigits: 0
          }).format(divided);
        } catch (e) {
          // Intl failed — leave content unchanged
        }
      } else {
        el.textContent = entry.formatted;
      }
    });
  })
  .catch(function () {
    // PricePreview failed (e.g. unsupported region) — keep original prices
  });
};
