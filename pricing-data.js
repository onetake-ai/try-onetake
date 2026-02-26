// OneTake AI Express Signup - Pricing Data
//
// planPresets shape:
//   - tier: Plan name (Occasional, Pro, Premium Studio)
//   - recurrence: Billing interval (monthly, yearly, quarterly)
//   - trial: Trial duration or null
//   - product: Paddle price ID
//   - firstExpectedPayment: Price in EUR of the first payment after trial (or first payment if no trial)
//   - freeToPaidConversionRate: Assumed conversion rate from trial to paid (per-plan, adjustable over time)

const planPresets = {
    'occasional-monthly-trial': {
        tier: 'Occasional',
        recurrence: 'monthly',
        trial: 7,
        product: 'pri_01kbcmen6n7ymcdk5y59vhv33h',
        firstExpectedPayment: 20,
        freeToPaidConversionRate: 0.30
    },
    'occasional-yearly-trial': {
        tier: 'Occasional',
        recurrence: 'yearly',
        trial: 7,
        product: 'pri_01kbcmycesa10x0ze6rnednsv1',
        firstExpectedPayment: 120,
        freeToPaidConversionRate: 0.30
    },
    'pro-monthly-trial': {
        tier: 'Pro',
        recurrence: 'monthly',
        trial: 7,
        product: 'pri_01kbcn3krbb00njdh57tsfcy48',
        firstExpectedPayment: 39,
        freeToPaidConversionRate: 0.30
    },
    'pro-yearly-trial': {
        tier: 'Pro',
        recurrence: 'yearly',
        trial: 7,
        product: 'pri_01kbcn6ee3g00jak58r3ykrk81',
        firstExpectedPayment: 390,
        freeToPaidConversionRate: 0.30
    },
    'premium-studio-monthly-trial': {
        tier: 'Premium Studio',
        recurrence: 'monthly',
        trial: 7,
        product: 'pri_01kbcna0bwaeasxvq312t101b1',
        firstExpectedPayment: 49,
        freeToPaidConversionRate: 0.30
    },
    'premium-studio-yearly-trial': {
        tier: 'Premium Studio',
        recurrence: 'yearly',
        trial: 7,
        product: 'pri_01kbcnd7tk4g6m024hsw1nt353',
        firstExpectedPayment: 490,
        freeToPaidConversionRate: 0.30
    },
    'occasional-monthly': {
        tier: 'Occasional',
        recurrence: 'monthly',
        trial: null,
        product: 'pri_01jykj00k3vnvzmhcx5f27b0kr',
        firstExpectedPayment: 20,
        freeToPaidConversionRate: 0.30
    },
    'occasional-yearly': {
        tier: 'Occasional',
        recurrence: 'yearly',
        trial: null,
        product: 'pri_01jykk31tkqr6ahv4g61p0xzpg',
        firstExpectedPayment: 120,
        freeToPaidConversionRate: 0.30
    },
    'pro-monthly': {
        tier: 'Pro',
        recurrence: 'monthly',
        trial: null,
        product: 'pri_01k4ga290j905geym9wkjsny4e',
        firstExpectedPayment: 39,
        freeToPaidConversionRate: 0.30
    },
    'pro-yearly': {
        tier: 'Pro',
        recurrence: 'yearly',
        trial: null,
        product: 'pri_01k4ga5h0smtd0y8t88w9ehg86',
        firstExpectedPayment: 390,
        freeToPaidConversionRate: 0.30
    },
    'premium-studio-monthly': {
        tier: 'Premium Studio',
        recurrence: 'monthly',
        trial: null,
        product: 'pri_01k88mvyyd66kc74begx6np0fb',
        firstExpectedPayment: 49,
        freeToPaidConversionRate: 0.30
    },
    'premium-studio-yearly': {
        tier: 'Premium Studio',
        recurrence: 'yearly',
        trial: null,
        product: 'pri_01k88n15fjtgx4w7nkcvdjky2z',
        firstExpectedPayment: 490,
        freeToPaidConversionRate: 0.30
    },
    'premium-studio-quarterly': {
        tier: 'Premium Studio',
        recurrence: 'quarterly',
        trial: null,
        product: 'pri_01kc9j79kamm8mj9jy1gnqmexh',
        firstExpectedPayment: 149,
        freeToPaidConversionRate: 0.30
    },
    'occasional-monthly-trial-29': {
        tier: 'Occasional',
        recurrence: 'monthly',
        trial: 7,
        product: 'pri_01kc9hh0jw4x7cczqcya6a9bk3',
        firstExpectedPayment: 29,
        freeToPaidConversionRate: 0.30
    },
    'occasional-yearly-trial-19': {
        tier: 'Occasional',
        recurrence: 'yearly',
        trial: 7,
        product: 'pri_01kc9hndv6ss6k0cn7q6vpe1fs',
        firstExpectedPayment: 228,
        freeToPaidConversionRate: 0.30
    },
    'pro-monthly-trial-59': {
        tier: 'Pro',
        recurrence: 'monthly',
        trial: 7,
        product: 'pri_01kc9htkgngnmyaw14pe0y5m3v',
        firstExpectedPayment: 59,
        freeToPaidConversionRate: 0.30
    },
    'pro-yearly-trial-39': {
        tier: 'Pro',
        recurrence: 'yearly',
        trial: 7,
        product: 'pri_01kc9hzt8kcc2tazx6p267ngjy',
        firstExpectedPayment: 468,
        freeToPaidConversionRate: 0.30
    },
    'premium-studio-monthly-trial-149': {
        tier: 'Premium Studio',
        recurrence: 'monthly',
        trial: 7,
        product: 'pri_01kc9j3s2pak4atr4mqrwztx6t',
        firstExpectedPayment: 149,
        freeToPaidConversionRate: 0.30
    },
    'premium-studio-yearly-trial-99': {
        tier: 'Premium Studio',
        recurrence: 'yearly',
        trial: 7,
        product: 'pri_01kc9j7ectb2h3qe4x55q9whj3',
        firstExpectedPayment: 1188,
        freeToPaidConversionRate: 0.30
    }
};

const sandboxPlanPresets = {
    'occasional-monthly-trial': {
        tier: 'Occasional',
        recurrence: 'monthly',
        trial: 7,
        product: 'pri_01k9x3z4gwqftdn048nda1xsvc',
        firstExpectedPayment: 20,
        freeToPaidConversionRate: 0.30
    },
    'occasional-yearly-trial': {
        tier: 'Occasional',
        recurrence: 'yearly',
        trial: 7,
        product: 'pri_01k9x41k6dgwzcshb1pax69nr0',
        firstExpectedPayment: 120,
        freeToPaidConversionRate: 0.30
    }
};
