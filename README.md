# Shalone Cason · Albums

The album site for albums.shalonely.com: a single static page (`index.html`) hosted on Cloudflare Pages.

## How it works

The page reads `albums.json` from the Beats media server (https://daily.shalonely.com) and shows every album, newest first, with a timeline of covers at the top. Tapping a song plays it and then carries on through the page. The player has a queue (+ on any song), a sleep timer, download and share for the playing song, and on phones it opens into a full-screen player. Song links look like `#track-<album>-<song>`.

`albums.json` is written by `generate_catalog.py` on the home server, in the same run as the Daily Beats catalog. Any folder inside the Beats folder whose name has a month tag, like `Sunday Drive [MAY2026]`, becomes an album:

- The tag sets the album's month and is removed from the name shown.
- Songs play in album order: a number at the start of the file name ("01 Song"), then the MP3's track number.
- `cover.jpg` is the cover. The catalog script makes a 1200px copy in `_covers/` for the site, and a 320px one in `_thumbs/` for the player.
- A `.zip` in the folder becomes the "↓ Album" download.
- Daily Beats skips these folders, so album songs never show up there.

## Files

- `index.html`: the whole page (styles and script inline).
- `fonts/`: Cormorant Garamond (SIL Open Font License, see `fonts/OFL.txt`), served from the site itself.
- `logo.png`, `favicon*`, `icon-*.png`, `apple-touch-icon.png`: made from `tools/cover/logo-white.png`.
- `dust.svg`: the dust and scratch layer of the film texture (the grain itself is drawn in code).
- `site.webmanifest` and `sw.js`: make the site installable. The service worker caches only the site's own files; bump `VERSION` in `sw.js` when you change them.
- `wrangler.jsonc` and `.assetsignore`: deploy the folder as a Cloudflare Worker with static assets, leaving `tools/`, this README and CLAUDE.md off the public site.

## Setup notes

- The media server must allow `https://albums.shalonely.com` to read `albums.json` (CORS). Songs and covers load either way.
- No build step and no dependencies: deploy the repo as-is.
