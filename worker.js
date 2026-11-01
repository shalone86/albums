// Real pages for every album and song, built from albums.json, so search
// engines (and people following a link) can find each one on its own:
//   /album/<album>          the album: cover, songs, links to each song
//   /song/<album>/<song>    one song: player, lyrics when known, download
//   /sitemap.xml            the home page plus every album and song page
// Everything else is the static site in this folder (index.html and friends),
// served by Cloudflare before this code runs.

const MEDIA_BASE = 'https://daily.shalonely.com';
const SITE = 'https://albums.shalonely.com';
const ARTIST = 'Shalone Cason';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    try {
      if (url.pathname === '/sitemap.xml') return sitemap(await loadAlbums());
      if (parts[0] === 'album' && parts.length === 2) {
        const album = (await loadAlbums()).find((a) => a.slug === parts[1]);
        if (album) return html(albumPage(album));
      }
      if (parts[0] === 'song' && parts.length === 3) {
        const album = (await loadAlbums()).find((a) => a.slug === parts[1]);
        const song = album && album.songs.find((s) => s.slug === parts[2]);
        if (song) return html(songPage(album, song));
      }
    } catch (err) {
      console.error('Album pages:', err);
      return html(notFoundPage('The albums couldn’t load right now. Please try again in a minute.'), 503);
    }
    // Anything else: the static files, or a friendly not-found page.
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    return html(notFoundPage('That page isn’t here.'), 404);
  }
};

// ---------- Catalog ----------
// The same slugs as the main page uses for its #album- and #track- links.
const slugify = (text) => String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const mediaUrl = (path) => `${MEDIA_BASE}/${String(path).split('/').map(encodeURIComponent).join('/')}`;
const monthLabel = (month) => {
  const m = /^(\d{4})-(\d{2})$/.exec(month || '');
  return m && MONTH_NAMES[+m[2] - 1] ? `${MONTH_NAMES[+m[2] - 1]} ${m[1]}` : '';
};

async function loadAlbums() {
  // Cached at Cloudflare for five minutes, so new uploads show up quickly.
  const res = await fetch(`${MEDIA_BASE}/albums.json`, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`albums.json: HTTP ${res.status}`);
  const catalog = await res.json();
  if (!Array.isArray(catalog)) throw new Error('albums.json is not a list');
  const usedSlugs = new Set();
  const albums = [];
  for (const raw of catalog) {
    // A bad entry is skipped, like on the main page.
    if (!raw || typeof raw.albumName !== 'string' || !raw.albumName.trim()) continue;
    const name = raw.albumName.trim();
    let slug = slugify(name) || 'album';
    while (usedSlugs.has(slug)) slug += '-2';
    usedSlugs.add(slug);
    const usedSongSlugs = new Set();
    const songs = (Array.isArray(raw.tracks) ? raw.tracks : [])
      .filter((t) => t && typeof t.path === 'string' && t.path.trim() && (t.title == null || typeof t.title === 'string'))
      .map((t, i) => {
        const title = (t.title || '').trim() || `Track ${i + 1}`;
        let songSlug = slugify(title) || String(i + 1);
        while (usedSongSlugs.has(songSlug)) songSlug += '-2';
        usedSongSlugs.add(songSlug);
        return { title, slug: songSlug, number: i + 1, url: mediaUrl(t.path), fileName: t.path.split('/').pop(), lyrics: typeof t.lyrics === 'string' ? t.lyrics.trim() : '' };
      });
    if (!songs.length && !raw.zipUrl) continue;
    const pick = (...paths) => { const p = paths.find((x) => typeof x === 'string' && x); return p ? mediaUrl(p) : null; };
    albums.push({
      name, slug, songs,
      month: typeof raw.month === 'string' ? raw.month : '',
      when: monthLabel(raw.month),
      cover: pick(raw.coverMedium, raw.coverArt, raw.coverThumb),
      zip: typeof raw.zipUrl === 'string' && raw.zipUrl ? mediaUrl(raw.zipUrl) : null
    });
  }
  return albums;
}

// ---------- Pages ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON-LD sits inside a <script>, so "<" must not close it early.
const ld = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
const albumPath = (album) => `/album/${album.slug}`;
const songPath = (album, song) => `/song/${album.slug}/${song.slug}`;

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://daily.shalonely.com; media-src https://daily.shalonely.com; frame-ancestors 'none'"
    }
  });
}

function sitemap(albums) {
  const urls = [`${SITE}/`];
  for (const a of albums) {
    urls.push(SITE + albumPath(a));
    for (const s of a.songs) urls.push(SITE + songPath(a, s));
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

function page({ title, description, path, image, jsonLd, body, noindex = false }) {
  const canonical = SITE + path;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(canonical)}">`}
  <meta name="theme-color" content="#0a0a0a">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="${ARTIST}">
  ${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  ${jsonLd ? `<script type="application/ld+json">${ld(jsonLd)}</script>` : ''}
  <style>
    @font-face { font-family: 'Cormorant Garamond'; font-style: normal; font-weight: 300 700; font-display: swap; src: url('/fonts/cormorant-garamond.woff2') format('woff2'); }
    @font-face { font-family: 'Cormorant Garamond'; font-style: italic; font-weight: 300 700; font-display: swap; src: url('/fonts/cormorant-garamond-italic.woff2') format('woff2'); }
    :root { color-scheme: dark; --bg: #0a0a0a; --line: rgba(255,255,255,0.09); --line-strong: rgba(255,255,255,0.22); --text: #e9e6df; --muted: #8d8a83; --white: #f6f3ec;
      --serif: 'Cormorant Garamond', Garamond, 'Times New Roman', serif; --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--serif); font-size: 19px; line-height: 1.5; font-variant-numeric: lining-nums; }
    body::before { content: ""; position: fixed; inset: 0; pointer-events: none; opacity: 0.08;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    a { color: inherit; }
    .wrap { max-width: 1000px; margin: 0 auto; padding: 32px 16px 64px; }
    .home { display: inline-block; font-family: var(--sans); font-size: 0.7rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; margin-bottom: 32px; }
    .home:hover { color: var(--white); }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 48px; align-items: start; }
    .cover { width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; display: block; border-radius: 4px; box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--line); background: #121212; }
    .eyebrow { font-family: var(--sans); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); }
    h1 { font-weight: 500; font-size: clamp(2.2rem, 5vw, 3.4rem); line-height: 1.05; color: var(--white); margin: 10px 0 8px; }
    .sub { font-style: italic; color: var(--muted); }
    .sub a { color: var(--text); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 24px 0; }
    .btn { display: inline-flex; align-items: center; height: 40px; padding: 0 18px; border: 1px solid var(--line-strong); border-radius: 999px; font-family: var(--sans); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; text-decoration: none; color: var(--text); }
    .btn:hover { border-color: var(--white); color: var(--white); }
    .btn-primary { background: var(--white); border-color: var(--white); color: #0a0a0a; }
    ol { list-style: none; border-top: 1px solid var(--line); }
    li { border-bottom: 1px solid var(--line); }
    li a { display: flex; gap: 16px; align-items: baseline; padding: 12px 4px; text-decoration: none; font-size: 1.2rem; }
    li a:hover { color: var(--white); }
    .num { font-family: var(--sans); font-size: 0.72rem; color: var(--muted); width: 1.6em; text-align: right; flex-shrink: 0; }
    audio { width: 100%; margin: 20px 0 4px; }
    h2 { font-weight: 500; font-size: 1.6rem; color: var(--white); margin: 32px 0 10px; }
    .lyrics { white-space: pre-line; color: var(--text); }
    .more { margin-top: 32px; }
    footer { margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--muted); font-style: italic; text-align: center; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; gap: 28px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <a class="home" href="/">← ${ARTIST} · All albums</a>
    ${body}
    <footer>All songs are CC0 (public domain): listen, download, share and reuse them however you like.</footer>
  </div>
</body>
</html>`;
}

function albumPage(album) {
  const count = `${album.songs.length} ${album.songs.length === 1 ? 'song' : 'songs'}`;
  const description = `${album.name}, an album by ${ARTIST}${album.when ? ` (${album.when})` : ''}: ${count}, human-made, free to hear, download and reuse under CC0.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: album.name,
    url: SITE + albumPath(album),
    byArtist: { '@type': 'MusicGroup', name: ARTIST, url: `${SITE}/` },
    ...(album.month ? { datePublished: album.month } : {}),
    ...(album.cover ? { image: album.cover } : {}),
    numTracks: album.songs.length,
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    track: album.songs.map((s) => ({ '@type': 'MusicRecording', name: s.title, url: SITE + songPath(album, s), position: s.number }))
  };
  const body = `
    <div class="grid">
      ${album.cover ? `<img class="cover" src="${esc(album.cover)}" alt="${esc(album.name)} cover" width="1200" height="1200">` : ''}
      <div>
        ${album.when ? `<div class="eyebrow">${esc(album.when)}</div>` : ''}
        <h1>${esc(album.name)}</h1>
        <p class="sub">An album by <a href="/">${ARTIST}</a> · ${count}</p>
        <div class="actions">
          <a class="btn btn-primary" href="/#album-${esc(album.slug)}">Play the album</a>
          ${album.zip ? `<a class="btn" href="${esc(album.zip)}">Download album</a>` : ''}
        </div>
        <ol>
          ${album.songs.map((s) => `<li><a href="${esc(songPath(album, s))}"><span class="num">${s.number}</span><span>${esc(s.title)}</span></a></li>`).join('\n          ')}
        </ol>
      </div>
    </div>`;
  return page({ title: `${album.name} — ${ARTIST}`, description, path: albumPath(album), image: album.cover, jsonLd, body });
}

function songPage(album, song) {
  const description = `“${song.title}” by ${ARTIST}, from the album ${album.name}${album.when ? ` (${album.when})` : ''}. Human-made, free to hear, download and reuse under CC0.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: song.title,
    url: SITE + songPath(album, song),
    byArtist: { '@type': 'MusicGroup', name: ARTIST, url: `${SITE}/` },
    inAlbum: { '@type': 'MusicAlbum', name: album.name, url: SITE + albumPath(album) },
    ...(album.cover ? { image: album.cover } : {}),
    audio: { '@type': 'AudioObject', contentUrl: song.url },
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    ...(song.lyrics ? { recordingOf: { '@type': 'MusicComposition', name: song.title, lyrics: { '@type': 'CreativeWork', text: song.lyrics } } } : {})
  };
  const others = album.songs.filter((s) => s !== song);
  const body = `
    <div class="grid">
      ${album.cover ? `<img class="cover" src="${esc(album.cover)}" alt="${esc(album.name)} cover" width="1200" height="1200">` : ''}
      <div>
        <div class="eyebrow">Track ${song.number} · <a href="${esc(albumPath(album))}">${esc(album.name)}</a></div>
        <h1>${esc(song.title)}</h1>
        <p class="sub">By <a href="/">${ARTIST}</a>${album.when ? ` · ${esc(album.when)}` : ''}</p>
        <audio controls preload="none" src="${esc(song.url)}"></audio>
        <div class="actions">
          <a class="btn btn-primary" href="/#track-${esc(album.slug)}-${esc(song.slug)}">Open in the full player</a>
          <a class="btn" href="${esc(song.url)}" download="${esc(song.fileName)}">Download</a>
        </div>
        ${song.lyrics ? `<h2>Lyrics</h2><p class="lyrics">${esc(song.lyrics)}</p>` : ''}
        ${others.length ? `<div class="more"><h2>More from ${esc(album.name)}</h2><ol>${others.map((s) => `<li><a href="${esc(songPath(album, s))}"><span class="num">${s.number}</span><span>${esc(s.title)}</span></a></li>`).join('')}</ol></div>` : ''}
      </div>
    </div>`;
  return page({ title: `${song.title} — ${ARTIST}`, description, path: songPath(album, song), image: album.cover, jsonLd, body });
}

function notFoundPage(message) {
  return page({ title: `${ARTIST} — Albums`, description: message, path: '/', noindex: true, body: `<h1>${esc(message)}</h1><p class="sub"><a href="/">See all albums</a></p>` });
}
