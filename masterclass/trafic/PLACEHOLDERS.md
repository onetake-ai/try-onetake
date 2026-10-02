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
| `profiles[].image` | One Instagram profile screenshot per creator, follower count visible: Alex Hormozi, Leila Hormozi, Gary Vaynerchuk, Steven Bartlett, Olivier Roland, Erico Rocha, Nicole Burke (@gardenaryco), Fabien Olicard. Portrait crop (3:4). Same files as the English page are fine. Add or remove entries freely. |
| `profiles[].alt` | Already written in French; adjust if a screenshot shows something else. |
| `reels[].image` | At least 6 Reel screenshots, 9:16, view count visible. |
| `reels[].creator`, `reels[].views` | Caption under each Reel, e.g. `creator: 'Alex Hormozi', views: '12 M'` (shown as "Alex Hormozi 12 M vues"). |
| `reels[].alt` | Alt text in French, e.g. « Reel d'Alex Hormozi avec 12 millions de vues ». |
| `hostPhoto` | Currently the photo used on `/instagram/` (sebastiennight.com). Replace it if you want a different one (square or 4:5). |

## Page 2: vérifiez vos emails (`/masterclass/trafic/verifiez-vos-emails/`)

| Config key | What's needed |
|---|---|
| `email.subject` | Exact subject line of the Userlist confirmation email. |
| `email.sender` | Sender name and address, e.g. `Sébastien Night <hello@onetake.ai>`. |

## Page 3: confirmation + Passe-Passe (`/masterclass/trafic/confirmation/`)

| Config key / file | What's needed |
|---|---|
| `passePasseVideo.embedUrl` | OneTake player URL of the Passe-Passe video (16:9). Script to write with the `write-liquidating-offer` skill, "secret weapon" angle. |
| `VIDEO_SLOTS` in `instagram/app.js` | The feature videos of the trial offer are shared with `/instagram/`: filling them there fills them here too. |

The headline reads `?first_name=` and the checkout form is pre-filled from `?first_name=` and `?email=`. In the Userlist email, link to:
`https://try.onetake.ai/masterclass/trafic/confirmation/?first_name={{ user.first_name | capitalize }}&email={{ user.email | url_encode }}`

## Social share image (all pages)

| File | What's needed |
|---|---|
| `masterclass/trafic/og-masterclass-trafic-fr.jpg` | 1200x630 Open Graph image. The `og:image` tag already points to it in the three pages. |

## Userlist (configured outside this repo)

- Campaign triggered by the `CompleteRegistration` event, with `language` = `fr`. The user property `attends_masterclass_on` holds the session start (ISO 8601, UTC, e.g. `2026-10-08T18:00:00.000Z` for Thursday 8 October at 20:00 Paris time). It sends the email with the link to page 3.
