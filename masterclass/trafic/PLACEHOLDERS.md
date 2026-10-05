# Placeholders: "Les 7 secrets des experts et coachs à 100 millions de followers" (French)

Every value below is still empty or temporary. Until it is filled in, the page shows a Cold Turkey box with a dashed outline and a `[PLACEHOLDER: ...]` or `[CONFIG: ...]` label. In the code, look for `data-placeholder` and `TODO(placeholder)`.

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
| `offre/index.html`, Nicole Burke card | `[PLACEHOLDER: Photo of Nicole Burke (@gardenaryco), 16:9]`: replace the `.ph` box with an `<img>`. |
| `offre/index.html`, Toboggan Evergreen card | `[PLACEHOLDER: Evergreen Waterslide masterclass visual, 16:9]`: replace the `.ph` box with an `<img>`. |

Link to send attendees after the live (check the exact Liquid syntax for custom properties in Userlist):
`https://try.onetake.ai/masterclass/trafic/offre/?first_name={{ user.first_name | capitalize }}&email={{ user.email | url_encode }}&attends_masterclass_on={{ user.properties.attends_masterclass_on | url_encode }}`

- With `attends_masterclass_on`, the offer ends the Wednesday after that session. Without it, it follows the weekly cycle: open from Thursday 20:00 to Wednesday 23:59:59 (Paris time); on Thursday before 20:00 the page redirects to `/oto/too-late/`.
- `?unlockfor=1` previews the page outside the offer window, without the redirect.

## To confirm (drafts already on the page, marked `TODO(confirm)` in the code)

Same five FAQ answers as the English watch page (access to the bonuses, refund request, renewal, taxes, VAT number), plus the newsletter consent sentence in the footer of every page:
« En m'inscrivant, j'accepte aussi de recevoir les emails de OneTake AI : conseils vidéo, nouveautés et offres spéciales. Je peux me désinscrire à tout moment en un clic. »

## Social share image (all pages)

| File | What's needed |
|---|---|
| `masterclass/trafic/og-masterclass-trafic-fr.jpg` | 1200x630 Open Graph image. The `og:image` tag already points to it on every page. |

## Userlist (configured outside this repo)

- Campaign triggered by the `CompleteRegistration` event, with `language` = `fr`. The user property `attends_masterclass_on` holds the session start (ISO 8601, UTC, e.g. `2026-10-08T18:00:00.000Z` for Thursday 8 October at 20:00 Paris time). It sends the email with the link to page 3.
- Every registration also sets the user property `Register_to_a_webinar_on` (UTC time of the registration, set by the edge script).
