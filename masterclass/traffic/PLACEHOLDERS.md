# Placeholders: "The 100M-Follower Masterclass" (English)

Every value below is still empty or temporary. Until it is filled in, the page shows a Cold Turkey box with a dashed outline and a `[PLACEHOLDER: ...]` or `[CONFIG: ...]` label. In the code, look for `data-placeholder` and `TODO(placeholder)`.

All values live in one file: `masterclass/traffic/config.js` (`window.MASTERCLASS_CONFIG`). The pages only need a change for the OG image.

## Page 1: registration (`/masterclass/traffic/`)

| Config key | What's needed |
|---|---|
| `profiles[].image` | One Instagram profile screenshot per creator, follower count visible: Alex Hormozi, Leila Hormozi, Gary Vaynerchuk, Steven Bartlett, Olivier Roland, Erico Rocha, Nicole Burke (@gardenaryco), Fabien Olicard. Portrait crop (3:4). Add or remove entries freely; the grid takes any number. |
| `profiles[].alt` | Already written; adjust if a screenshot shows something else. |
| `reels[].image` | At least 6 Reel screenshots, 9:16, view count visible. Add more entries for more Reels. |
| `reels[].creator`, `reels[].views` | Caption under each Reel: creator name and view count, e.g. `creator: 'Alex Hormozi', views: '12M'` (shown as "Alex Hormozi 12M views"). |
| `reels[].alt` | Alt text for each Reel screenshot, e.g. "Reel by Alex Hormozi with 12 million views". |
| `hostPhoto` | Currently the photo used on `/instagram/` (sebastiennight.com). Replace it if you want a different one (square or 4:5). |

## Page 2: check your inbox (`/masterclass/traffic/check-your-inbox/`)

| Config key | What's needed |
|---|---|
| `email.subject` | Exact subject line of the Userlist confirmation email. |
| `email.sender` | Sender name and address, e.g. `Sébastien Night <hello@onetake.ai>`. |
| `salesVideo.embedUrl` | OneTake player URL of the sales video (16:9), e.g. `https://my.onetake.ai/xxxx/yyyy/`. |
| `salesVideo.offerLabel` | Button under the video. Default: "Start my 3-day free trial". |
| `salesVideo.offerUrl` | Button link. Default: `https://yes.onetake.ai`. |

## Page 3: watch (`/masterclass/traffic/watch/`)

| Config key | What's needed |
|---|---|
| `masterclassVideo.embedUrl` | OneTake player URL of the masterclass (16:9). |
| `offerHeadline` | Headline of the offer block under the video. |
| `offerText` | Short text of the offer block. |
| `offerButtonLabel` | Button text of the offer block. |
| `offerUrl` | Button link. Default: `https://yes.onetake.ai`. |
| `offerRevealSeconds` | `0` (default) shows the offer block right away. Any other number hides it for that many seconds of time on page. |
| `offerCountdownEnabled`, `offerDeadline`, `offerCountdownLabel` | Disabled by default. Set `offerCountdownEnabled: true` and an ISO 8601 UTC `offerDeadline` (e.g. `'2026-11-30T22:00:00Z'`) to show a countdown in the offer block; the block disappears after the deadline. |

The headline reads `?first_name=` from the URL. In the Userlist email, link to:
`https://try.onetake.ai/masterclass/traffic/watch/?first_name={{ user.first_name | capitalize }}`

## Social share image (all pages)

| File | What's needed |
|---|---|
| `masterclass/traffic/og-masterclass-traffic-en.jpg` | 1200x630 Open Graph image. The `og:image` tag already points to it in the three pages. |

## Userlist (configured outside this repo)

- Campaign triggered by the `CompleteRegistration` event, with the user property `masterclass_slug` = `traffic` and `language` = `en`. It sends the email with the link to page 3.
