# OneTake AI Signup Checkout

A multi-language signup and checkout page for OneTake AI SaaS subscriptions, integrated with Paddle payments and multiple analytics platforms.

## Overview

This is a Progressive Web App (PWA) that handles the complete signup flow:
1. User fills out a form with their information and use cases
2. Form validates and tracks user data across multiple platforms
3. Paddle checkout opens with the selected plan
4. User completes payment and is redirected to onboarding

The page supports 8 languages, multiple subscription tiers and billing frequencies, and includes comprehensive tracking for analytics, conversions, and affiliate attribution.

## Architecture

### Files
- **index.html** - Main signup page with two-column layout (left: benefits/FAQ, right: form)
- **app.js** - Core application logic (form handling, validation, tracking, Paddle integration)
- **special-offer.js** - Special offer content management (benefits, FAQ, Johnson box)
- **special-offer.css** - Styling for the two-column layout and special elements
- **translations.js** - All translations and plan presets configuration

### State Management
The app uses a global state object (`window.oneTakeState`) exposed via IIFE pattern to share data between files:
- Form data (email, firstName, useCases, estimatedVolume)
- Current language
- Selected plan configuration (tier, recurrence, trial, product ID)

### Language System
- Auto-detection from browser settings with manual override
- Translation keys in `translations.js` merged from base + special offer
- Dynamic content updates on language change
- Supports: EN, FR, ES, PT-BR, IT, DE, JA, RU

### Mobile Responsive
- Desktop: Two-column layout (benefits left, form right)
- Mobile (<900px): Single column, form first, then benefits below
- Uses CSS flexbox `order` property to reflow content

## Key Features

### Progressive Field Reveal
Fields "Use Cases" and "Usage Frequency" are hidden until user starts typing in email field. Improves conversion by reducing cognitive load.

### Custom Dropdown Component
Multi-select use cases implemented with custom dropdown (not native `<select multiple>`) for better UX. Uses checkboxes with visual chips.

### ICP Filtering
If user selects "personal" or "music" use cases, tracking events (Plausible, AnyTrack, CrazyEgg, UserList) are skipped. These users are not the target customer profile.

### Plan Presets System
URL parameter `?plan=<preset-key>` auto-configures the checkout:
- Sets the plan tier, recurrence, trial period, and Paddle product ID
- Updates headline and button text (trial vs non-trial)
- Shows/hides special offer content based on trial status

### Comprehensive Tracking
- **Plausible** - Privacy-friendly analytics
- **AnyTrack** - Multi-platform event tracking
- **CrazyEgg** - Conversion tracking with revenue attribution
- **UserList** - Customer data platform (via BunnyCDN proxy)
- **Rewardful** - Affiliate tracking (passed to Paddle in `customData`)

## URL Parameters

### `plan` (optional)
Plan preset key. Auto-configures tier, recurrence, trial, and product ID.

Example: `?plan=pro-yearly-trial`

### `product` (optional)
Direct Paddle product ID. Bypasses plan presets.

Example: `?product=pri_01kbcn6ee3g00jak58r3ykrk81`

### `via` (optional, Rewardful)
Affiliate referral parameter. Captured by Rewardful for commission tracking.

Example: `?via=affiliate-123`

### Combined
`?plan=premium-studio-quarterly&via=affiliate-123`

## Third-Party Integrations

### Paddle Checkout
- Handles all payment processing
- Receives: product ID, customer email, locale, custom data (Rewardful)
- Success URL redirects to onboarding with query params

### BunnyCDN Edge Script
Used as proxy for UserList API to keep credentials secure. Environment variables stored in BunnyCDN, not in frontend code.

### Rewardful Affiliate Tracking
- Script loads before Paddle to capture referral
- Referral token passed to Paddle in `customData.rewardful.referral`
- Paddle sends transaction data to Rewardful via webhook
- Commissions attributed automatically

### Email Validation
Bouncer API validates business emails in real-time to prevent fake signups.

## How to Add a Plan

1. **Get Paddle Product ID** from Paddle dashboard
2. **Add to `planPresets` object** in `translations.js`:
   ```javascript
   'your-plan-key': {
       tier: 'Plan Name',           // Display name
       recurrence: 'monthly',       // monthly, yearly, quarterly
       trial: '7 days',             // '7 days' or null
       product: 'pri_01abc123...'  // Paddle product ID
   }
   ```
3. **Use in URL**: `?plan=your-plan-key`

### Plan Preset Structure
- **tier**: Displayed in plan info widget (e.g., "Pro", "Premium Studio")
- **recurrence**: Billing frequency - determines "Monthly" / "Yearly" / "Quarterly" label
- **trial**: Trial period string or `null` for no trial. Affects headline/button text
- **product**: Paddle product ID (starts with `pri_`)

### Trial vs Non-Trial Behavior
Plans with `trial: '7 days'`:
- Headline: "Let's create your **free trial** account!"
- Button: "Create free trial account"
- Special offer content visible (Johnson box, benefits list, FAQ)

Plans with `trial: null`:
- Headline: "Let's create your account!"
- Button: "Create account"
- Special offer content hidden (except sub-headline on special-offer page)

## Development Notes

### Brand Colors
Defined in CSS custom properties:
- Golden Grass (#E3AE28) - Primary brand color
- Bleached Cedar (#241826) - Text/headings
- Alabaster (#F8F7F7) - Background
- Cabaret (#D33E5D) - Dark accent
- Cold Turkey (#D1B0B3) - Light accent

### Font
Montserrat (loaded from bunny.net CDN) in weights: 300, 400, 500, 600, 700

### Form Validation
- Real-time validation with error messages
- Required fields: firstName, email, useCases (min 1), usageFrequency
- Business email validation via Bouncer API
- Progressive validation (errors shown after first interaction)

### Console Logging
Comprehensive console logs for debugging:
- Language changes
- Plan detection
- Form submission
- Tracking events (Plausible, AnyTrack, CrazyEgg, UserList)
- Paddle checkout configuration
- Rewardful referral detection

Use browser console to troubleshoot issues in development.

---

**Questions?** Review the code - it's well-structured and commented. The key logic is in `app.js` with configuration in `translations.js`.
