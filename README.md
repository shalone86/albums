# Shalone Cason · Albums

The album site for albums.shalonely.com: a single static page (`index.html`) hosted on Cloudflare Pages.

## How it works

The page reads `albums.json` from the Beats media server (https://daily.shalonely.com) and lists every album, newest first. Clicking an album opens its songs; the player at the bottom plays from there on through the rest of the page.

`albums.json` is written by `generate_catalog.py` on the home server, in the same run as the Daily Beats catalog. Any folder inside the Beats folder whose name has a month tag, like `Sunday Drive [MAY2026]`, becomes an album:

- The tag sets the album's month and is removed from the name shown.
- Songs play in album order: a number at the start of the file name ("01 Song"), then the MP3's track number.
- `cover.jpg` is the cover; `cover-800.jpg`, if present, is used for the bigger cover when an album is open.
- A `.zip` in the folder becomes the "↓ Album" download.
- Daily Beats skips these folders, so album songs never show up there.

## Setup notes

- The media server must allow `https://albums.shalonely.com` to read `albums.json` (CORS). Songs and covers load either way.
- No build step and no dependencies: deploy the repo as-is.
