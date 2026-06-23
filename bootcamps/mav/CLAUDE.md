# MAV Bootcamp — Developer Notes

## Visual identity

All landing pages in this launch (VPL1, VPL2, VPL3, and the sales video page) share the same visual style: **tropical, airy, relaxed — Sunday morning by the water.**

**Use `../vpl-styles.css` on every MAV page.** Do not create separate stylesheets per page; add only page-specific overrides inline or in a small `<style>` block if truly necessary.

Key design tokens (defined in `vpl-styles.css`):
- `--ocean` (#0B9DA8) — primary accent, used for interactive elements
- `--sand-muted` (#A8894A) — secondary accent, used for eyebrow text
- `--font-heading` — DM Serif Display (loaded via Bunny Fonts)
- `--font-body` — DM Sans (loaded via Bunny Fonts)
- Blurred tropical beach background (`uploads/pasted-1781458563204-0.png`) via `body::before`

## File structure

```
bootcamps/mav/
  vpl-styles.css          Shared page styles — use on all MAV pages
  uploads/
    pasted-1781458563204-0.png  Beach background image (referenced by vpl-styles.css)
  vpl1-secret/
    index.html
    app.js
    testimonials.js
  vpl2-*/                 (future)
  vpl3-*/                 (future)
  sales-video/            (future)
```

## YouTube embeds

All MAV pages that embed YouTube testimonials must use the shared lazy-embed assets at `/assets/youtube-thumbnails.css` and `/assets/youtube-thumbnails.js`. See the root `CLAUDE.md` for full usage docs.

## Episode navigation

Episode nav is baked into each page. As new episodes go live, update the `episode-pill--locked` items on all existing pages to add real links.

## Hyvor Talk

- Website ID: `10804`
- Page ID: `bootcamps/mav` (shared across all episodes — comments appear everywhere)
- Uses `loading="manual"` lazy-loaded via IntersectionObserver

## Access control

All VPL pages share a redirect script at `bootcamps/mav/countdown.js`. After **June 25, 2026 12:00 CET**, visitors without `?optin=1` are sent to `https://try.onetake.ai/bootcamps/mav/le-cercle/`. Each page loads it as the first `<script>` in `<head>` for immediate execution.
