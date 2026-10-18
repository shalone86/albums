# Communication preferences

- Don't use the phrase "sanity check" — say "double check" instead.

# Feature scope

- Keep the sites simple. Before adding complexity to a feature (drag-and-drop, persistence, new views, etc.), flag the simpler version first and let scope be a deliberate choice, not a default. Don't build something just because it's possible.

## Shipping safety checks for my sites

Context: I build and maintain several static websites (gallery, kids video site, sketchbook library, music sites, chaplet app) plus a self-hosted home server running Docker containers. The sites don't collect user data. I move fast with AI-assisted coding, so help me catch problems I might skip.

Before or after any change, check and flag the following:

1. Content isolation: One malformed content file (book entry, chaplet, JSON/YAML/front matter) must not break the build or blank a page. Add or maintain a validation script that checks content files before deploy and skips or reports bad entries.
2. Version control: Confirm changes are committed to git with clear messages and that a rollback is easy. Warn me if I'm about to deploy uncommitted work.
3. Dependencies: Prefer no new dependencies. If one is needed, say so explicitly, pin the version, and periodically suggest auditing existing npm packages and CDN scripts.
4. User data: If a change would introduce forms, logins, comments, analytics, cookies, or any storage of visitor data, stop and point it out before proceeding. That changes the risk profile.
5. Kids site privacy: Flag any third-party script, embed (e.g., YouTube), analytics, or external font that could track children. Suggest privacy-friendly alternatives.
6. Server exposure: For Docker and server work, confirm only intended services are publicly reachable, admin panels are not exposed, and containers are reasonably up to date.
7. Rights: When adding movies, books, or images, remind me to verify public domain status (including renewals and country differences) if it isn't documented.
8. Boring breakage: Remind me about mobile layout checks after theme changes, and about domain/SSL renewals if relevant.
9. Understanding: If you implement something non-trivial, give me a 2–3 sentence explanation of how it works so I can maintain it without you.

Keep warnings brief and specific. Don't block me; flag the risk and let me decide.

# Album covers

Covers are made with `tools/cover/make_cover.py`. Its settings at the top are the series look (rounded card on black, fixed grain/dust/scratch overlay, light leaks, ivory S logo, "human-made" in Caladea). Don't change them for one album; use `--light-leak` and `--hue` instead.

For each new album, I give the title and a mood:

1. Find 5–6 paintings that are public domain or CC0, confirmed by the museum's own per-image flag: The Met (`isPublicDomain: true`), Art Institute of Chicago (`is_public_domain: true`), Cleveland Museum of Art (`share_license_status: CC0`), Rijksmuseum, or National Gallery of Art open data. Never Google Images or Pinterest. No nudity, including sheer or see-through clothing, anywhere in the crop. Pick paintings that still read as a small square thumbnail.
2. Show them as one numbered contact sheet with title, artist, year, museum and license under each, plus the proposed square crop and a thumbnail. Say plainly if a license or crop is uncertain.
3. Once I pick one, run `make_cover.py` and show the cover at full size and as small thumbnails. Iterate until I'm happy.
4. Hand off `cover.jpg` (3000×3000), `cover-800.jpg` and `credits.txt` for the album's folder on the media server (named like `My Album [MAY2026]`).
5. Save the album's `credits.txt` and a `settings.txt` (image link, crop, light leak, hue and the exact command) in `tools/cover/albums/<album>/`, commit and push to `main`.

If you install anything, pin the exact version and tell me.
