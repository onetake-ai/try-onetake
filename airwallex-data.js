// OneTake AI - Airwallex plans (card payments through Airwallex Hosted Billing Checkout)
// The Airwallex equivalent of pricing-data.js. Pages declare their plans by key:
//   <button data-airwallex-plan="challenge-yearly">...</button>
// Price IDs, sales windows and redirect pages are NOT here: they live in
// edge-scripts/airwallex-checkout.ts, which only accepts the plan keys below.
// Prices are in EUR excl. VAT and are not localized (Paddle's localizer can't convert them).

window.AIRWALLEX_CONFIG = {
    // Public URL of Bunny Edge Script 99045 (edge-scripts/airwallex-checkout.ts), on our own
    // domain: filters block *.bunny.run more often
    endpoint: 'https://directpayments.onetake.ai',

    supportEmail: 'contact@goodvibes.onetake.ai',

    plans: {
        'challenge-yearly': {
            name: 'Le Challenge des Experts à Haute Valeur',
            value: 999,                 // EUR excl. VAT, for conversion tracking
            currency: 'EUR',
            priceLabel: '999\u00a0€ HT / an'
        },
        'challenge-quarterly': {
            name: 'Le Challenge des Experts à Haute Valeur',
            value: 299,
            currency: 'EUR',
            priceLabel: '299\u00a0€ HT / trimestre'
        },
        // Current and former OneTake customers (/4dcm/acces-challenge/): same offer, no deadline
        'challenge-access-yearly': {
            name: 'Le Challenge des Experts à Haute Valeur',
            value: 999,
            currency: 'EUR',
            priceLabel: '999\u00a0€ HT / an'
        },
        // Shown on /4dcm/acces-challenge/ only with ?plan=quarterly
        'challenge-access-quarterly': {
            name: 'Le Challenge des Experts à Haute Valeur',
            value: 299,
            currency: 'EUR',
            priceLabel: '299\u00a0€ HT / trimestre'
        },
        // Customers who cancelled OneTake in the past (/4dcm/comeagain-challenge/): same offer.
        // checkoutIntro replaces the popup intro: the same email reactivates the old account
        'challenge-comeback-yearly': {
            name: 'Le Challenge des Experts à Haute Valeur',
            value: 999,
            currency: 'EUR',
            priceLabel: '999\u00a0€ HT / an',
            checkoutIntro: 'Indique ton prénom et la même adresse email que ton ancien compte OneTake\u00a0: c\'est elle qui te permet de retrouver tes vidéos.'
        },
        // Shown on /4dcm/comeagain-challenge/ only with ?plan=quarterly
        'challenge-comeback-quarterly': {
            name: 'Le Challenge des Experts à Haute Valeur',
            value: 299,
            currency: 'EUR',
            priceLabel: '299\u00a0€ HT / trimestre',
            checkoutIntro: 'Indique ton prénom et la même adresse email que ton ancien compte OneTake\u00a0: c\'est elle qui te permet de retrouver tes vidéos.'
        }
    }
};
