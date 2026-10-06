# Placeholders: "Les 7 secrets des experts et coachs à 100 millions de followers" (French)

## Status: live (MVP)

The French funnel is live. Anything not ready is hidden, never shown as a placeholder:
- An empty video URL hides its section and its lead-in line. Fill in the URL in `config.js` and the section appears by itself.
- While `replayVideo.embedUrl` is empty, the offer page shows the headline « Merci d'avoir participé à la masterclass ! Voici votre offre spéciale » instead of « Voici le replay de la masterclass ».
- Unconfirmed texts, the bonus images and the social share images were removed from the pages (see below). In the code, look for `TODO(placeholder)`.

All values live in one file: `masterclass/trafic/config.js` (`window.MASTERCLASS_CONFIG`). The pages only need a change for the OG image.

## Session (already set, change if needed)

| Config key | Value |
|---|---|
| `session.weekday`, `session.time`, `session.timeZone` | Thursday (`4`), `'20:00'`, `'Europe/Paris'` |
| `session.cutoff` | `'21:00'`: from Thursday 21:00 Paris time, new leads register for the following Thursday |
| `liveUrl` | `https://nuro.video/fr-live` |
| `joinButtonMinutesBefore` | `15`: page 3 shows the "Rejoindre le direct" button 15 minutes before the start |
| `countdown.*` | Labels of the countdown bar on page 3 |

## Page 1: registration (`/masterclass/trafic/`)

| Config key | What's needed |
|---|---|
| `profiles` | Set: the 8 account screenshots in `/masterclass/images/` (288x640), scrolling under the scan overlay. Add a screenshot there and an entry in `profiles` to show more accounts. |
| `hostPhoto` | Currently the photo used on `/instagram/` (sebastiennight.com). Replace it if you want a different one (square or 4:5). |

## Page 2: vérifiez vos emails (`/masterclass/trafic/verifiez-vos-emails/`)

| Config key | What's needed |
|---|---|
| `email.subject` | Set: `{{ user.first_name | capitalize }}, confirme ta place (Masterclass 100M de followers)`. The page shows the visitor's first name in place of the tag. |
| `email.sender` | Set: `OneTake AI - Sebastien <contact@mail.onetake.ai>`. |

## Page 3: confirmation + Passe-Passe (`/masterclass/trafic/confirmation/`)

| Config key / file | What's needed |
|---|---|
| `passePasseVideo.embedUrl` | OneTake player URL of the Passe-Passe video (16:9). Script to write with the `write-liquidating-offer` skill, "secret weapon" angle. |
| `VIDEO_SLOTS` in `instagram/app.js` | The feature videos of the trial offer are shared with `/instagram/`: filling them there fills them here too. |

The headline reads `?first_name=` and the checkout form is pre-filled from `?first_name=` and `?email=`. In the Userlist email, link to:
`https://try.onetake.ai/masterclass/trafic/confirmation/?first_name={{ user.first_name | capitalize }}&email={{ user.email | url_encode }}`

## Offer page: replay + offer (`/masterclass/trafic/offre/`)

| Config key / file | What's needed |
|---|---|
| `replayVideo.embedUrl` | OneTake player URL of the live replay (16:9). |
| `offer.*` | Set: Scale offer price IDs (999 € par an, 299 € par trimestre), deadline the Wednesday after the live at midnight Paris time, redirect to `/oto/too-late/`. |
| `offre/index.html`, Nicole Burke card | Photo of Nicole Burke (16:9). The card shows without an image for now: add `<div class="of-item__media"><img ...></div>` at the `TODO(placeholder)` comment and the `has-media` class on its `<li>`. |
| `offre/index.html`, Toboggan Evergreen card | Visual of the masterclass (16:9), same as above. |

Link to send attendees after the live (check the exact Liquid syntax for custom properties in Userlist):
`https://try.onetake.ai/masterclass/trafic/offre/?first_name={{ user.first_name | capitalize }}&email={{ user.email | url_encode }}&attends_masterclass_on={{ user.properties.attends_masterclass_on | url_encode }}`

- With `attends_masterclass_on`, the offer ends the Wednesday after that session. Without it, it follows the weekly cycle: open from Thursday 20:00 to Wednesday 23:59:59 (Paris time); on Thursday before 20:00 the page redirects to `/oto/too-late/`.
- `?unlockfor=1` previews the page outside the offer window, without the redirect.

## To confirm (removed from the pages until confirmed)

The same five FAQ answers as on the English watch page (drafts listed in `masterclass/traffic/PLACEHOLDERS.md`: access to the bonuses, refund request, renewal, taxes, VAT number), to translate and add back to the offer page's FAQ once confirmed, plus the newsletter consent sentence for the footer of every page:
« En m'inscrivant, j'accepte aussi de recevoir les emails de OneTake AI : conseils vidéo, nouveautés et offres spéciales. Je peux me désinscrire à tout moment en un clic. »

## Social share image (all pages)

| File | What's needed |
|---|---|
| `masterclass/trafic/og-masterclass-trafic-fr.jpg` | 1200x630 Open Graph image. Then add `<meta property="og:image" content="https://try.onetake.ai/masterclass/trafic/og-masterclass-trafic-fr.jpg">` to each page (and set `twitter:card` back to `summary_large_image` on page 1). |

## Userlist (configured outside this repo)

- Campaign triggered by the `CompleteRegistration` event, with `language` = `fr`. The user property `attends_masterclass_on` holds the session start (ISO 8601, UTC, e.g. `2026-10-08T18:00:00.000Z` for Thursday 8 October at 20:00 Paris time). It sends the email with the link to page 3.
- Every registration also sets the user property `Register_to_a_webinar_on` (UTC time of the registration, set by the edge script).
