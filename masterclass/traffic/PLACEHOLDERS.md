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

## Page 2: check your inbox + Passe-Passe (`/masterclass/traffic/check-your-inbox/`)

| Config key | What's needed |
|---|---|
| `email.subject` | Exact subject line of the Userlist confirmation email. |
| `email.sender` | Set: `OneTake AI - Sebastien <contact@mail.onetake.ai>`. |
| `salesVideo.embedUrl` | OneTake player URL of the Passe-Passe sales video (16:9), e.g. `https://my.onetake.ai/xxxx/yyyy/`. |
| `VIDEO_SLOTS` in `instagram/app.js` | The trial offer under the video repeats `/instagram/`: its feature videos are filled there. |

## Page 3: watch + offer (`/masterclass/traffic/watch/`)

| Config key / file | What's needed |
|---|---|
| `masterclassVideo.embedUrl` | OneTake player URL of the prerecorded masterclass (about 75 minutes, 16:9). |
| `offer.*` | Set: Scale offer price IDs (999 a year, 299 a quarter), reveal after 270 s, redirect to `/oto/too-late/`. |
| `watch/index.html`, Nicole Burke card | `[PLACEHOLDER: Photo of Nicole Burke (@gardenaryco), 16:9]`: replace the `.ph` box with an `<img>`. |
| `watch/index.html`, Evergreen Waterslide card | `[PLACEHOLDER: Evergreen Waterslide masterclass visual, 16:9]`: replace the `.ph` box with an `<img>`. |

Link to use in the Userlist email (check the exact Liquid syntax for custom properties in Userlist):
`https://try.onetake.ai/masterclass/traffic/watch/?first_name={{ user.first_name | capitalize }}&email={{ user.email | url_encode }}&registered_on={{ user.properties.Register_to_a_webinar_on | url_encode }}`

- `registered_on` sets the deadline: 6 days after that date, at midnight in the visitor's time zone. Without it, the first visit counts as the registration.
- `?offer=1` shows the offer right away (no 4 min 30 s wait). `?unlockfor=1` previews the page after its deadline, without the redirect.

## To confirm (drafts already on the page, marked `TODO(confirm)` in the code)

| Where | Draft to confirm |
|---|---|
| Watch page FAQ, "When do I get access?" | Courses and bonuses are "waiting for you in your OneTake account". How are they delivered: account, email, or both? |
| Watch page FAQ, "How does the guarantee work?" | "Write to our team from your OneTake account." How is the refund requested? |
| Watch page FAQ, "What happens after the first year?" | "Renews at the same special price unless you cancel." Renewal terms and price on renewal? |
| Watch page FAQ, "Is tax included?" | "Shown before tax; Paddle adds VAT or sales tax at checkout." |
| Watch page FAQ, "Can I get an invoice?" | "You can add your company's VAT number at checkout." |
| Footer of every page | Newsletter consent: "By signing up, I also agree to receive emails from OneTake AI with video tips, news and special offers. I can unsubscribe at any time in one click." |

## Social share image (all pages)

| File | What's needed |
|---|---|
| `masterclass/traffic/og-masterclass-traffic-en.jpg` | 1200x630 Open Graph image. The `og:image` tag already points to it on every page. |

## Userlist (configured outside this repo)

- Campaign triggered by the `CompleteRegistration` event, with the user property `masterclass_slug` = `traffic` and `language` = `en`. It sends the email with the link to page 3.
- Every registration also sets the user property `Register_to_a_webinar_on` (UTC time of the registration, set by the edge script).
