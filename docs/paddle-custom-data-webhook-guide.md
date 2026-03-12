# Paddle Custom Data — Webhook Integration Guide

## Overview

The marketing/signup page (`try.onetake.ai`) passes user attribution and form data to Paddle as `custom_data` when opening the checkout. This data is available in Paddle webhook events for forwarding to UserList, MixPanel, ProfitWell, or any other analytics/CRM tool.

## Which Webhook Event to Use

**Listen to `transaction.created`**, not `transaction.completed`.

`custom_data` is attached at checkout initialization (`Paddle.Checkout.open()`), so Paddle includes it from the very first webhook event. Using `transaction.created` means you capture **abandoned cart users** too — not just those who complete payment. This is critical for attribution in UserList.

| Paddle Event | Has `custom_data`? | When it fires |
|---|---|---|
| `transaction.created` | Yes | Checkout opened (use this one) |
| `transaction.updated` | Yes | Checkout updated |
| `transaction.completed` | Yes | Payment successful |
| `subscription.created` | Yes | Subscription started |

## Fields in `custom_data`

All fields are **optional**. Only forward a field to UserList/MixPanel/ProfitWell if it exists in `custom_data`. If a key is missing, **do not send it** — no nulls, no empty strings, no defaults.

### Plan & Form Data

| Field | Type | Description |
|---|---|---|
| `plan` | string | Plan key, e.g. `pro-yearly-trial` |
| `has_trial` | string | `"true"` or `"false"` |
| `estimated_volume` | string | User's estimated monthly video volume |
| `use_cases` | string | Comma-separated list of selected use cases |

### Plan Pricing Metadata

| Field | Type | Description |
|---|---|---|
| `first_expected_payment` | string | First payment amount after trial (if applicable) |
| `free_to_paid_conversion_rate` | string | Expected trial-to-paid conversion rate (%) |
| `expected_value` | string | Calculated: conversion_rate × first_payment |
| `trial_days` | string | Number of trial days |

### UTM / Attribution Parameters

| Field | Type | Description |
|---|---|---|
| `utm_source` | string | Traffic source (e.g. `facebook`, `google`) |
| `utm_medium` | string | Marketing medium (e.g. `cpc`, `email`) |
| `utm_campaign` | string | Campaign name |
| `utm_id` | string | Campaign ID |
| `utm_content` | string | Ad/content variant |
| `utm_term` | string | Search keyword |

### Ad Platform Parameters

These are **currently disabled** on the marketing page (`INCLUDE_AD_PARAMS=false` in `tracking-params.js`) but will be enabled later. Your backend should handle them if present.

| Field | Type | Description |
|---|---|---|
| `ad_id` | string | Ad creative ID |
| `adset_id` | string | Ad set / ad group ID |
| `placement` | string | Ad placement (e.g. `feed`, `story`) |
| `site_source_name` | string | Publisher/site where ad was shown |

### Rewardful (Referral)

| Field | Type | Description |
|---|---|---|
| `rewardful_referral` | string | Rewardful referral ID (if user came via affiliate link) |

## Example `custom_data` Payload

A fully-populated example (most fields are optional and may be absent):

```json
{
  "plan": "pro-yearly-trial",
  "has_trial": "true",
  "estimated_volume": "50-100",
  "use_cases": "translating,dubbing",
  "first_expected_payment": "228",
  "free_to_paid_conversion_rate": "35",
  "expected_value": "79.8",
  "trial_days": "14",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "summer-launch",
  "utm_id": "camp_123",
  "rewardful_referral": "ref_abc123"
}
```

## Integration Rules

1. **Parse `custom_data` from the `transaction.created` webhook** — this is where you get it earliest
2. **Only forward fields that exist** — if a key is not in `custom_data`, do not send a null/empty value to UserList/MixPanel/ProfitWell
3. **All values are strings** — Paddle custom data only supports string values. Parse numbers if needed on your end
4. **Ad params will be enabled later** — build support for `ad_id`, `adset_id`, `placement`, `site_source_name` now so they work when the marketing page flag is flipped

## Source Files (for reference)

- `app.js` — `buildCheckoutCustomData()` (line ~896) builds the custom_data object
- `tracking-params.js` — captures UTM/ad params from URL and merges them into custom_data
