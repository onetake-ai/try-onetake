// OneTake AI - Airwallex plans (card payments through Airwallex Hosted Billing Checkout)
// The Airwallex equivalent of pricing-data.js. Pages declare their plans by key:
//   <button data-airwallex-plan="challenge-yearly">...</button>
//   <a href="#" data-airwallex-wire="challenge-yearly">...</a>
// Price IDs, sales windows and redirect pages are NOT here: they live in
// edge-scripts/airwallex-checkout.ts, which only accepts the plan keys below.
// Prices are in EUR excl. VAT and are not localized (Paddle's localizer can't convert them).

window.AIRWALLEX_CONFIG = {
    // Public URL of Bunny Edge Script 99045 (edge-scripts/airwallex-checkout.ts), on our own
    // domain: filters block *.bunny.run more often
    endpoint: 'https://directpayments.onetake.ai',

    supportEmail: 'contact@goodvibes.onetake.ai',

    // Shown after the wire transfer form (plans with a `wire` entry)
    bank: {
        holder:  'OneTake Pte Ltd',
        iban:    'BE23 9051 2536 1591',
        bic:     'TRWIBEB1XXX',
        address: 'Wise, Rue du Trône 100, 3rd floor, 1050 Brussels, Belgique'
    },

    plans: {
        'challenge-yearly': {
            name: 'Le Challenge des Experts à Haute Valeur',
            value: 999,                 // EUR excl. VAT, for conversion tracking
            currency: 'EUR',
            priceLabel: '999\u00a0€ HT / an',
            wire: { amountLabel: '999\u00a0€\u00a0HT', referencePrefix: 'CHALLENGE' }
        },
        'challenge-quarterly': {
            name: 'Le Challenge des Experts à Haute Valeur',
            value: 299,
            currency: 'EUR',
            priceLabel: '299\u00a0€ HT / trimestre'
        }
    }
};
