# Search engines: indexing is off

PokéSurvivor is an internal mini-game, so search engine indexing is **disabled on
purpose**. Do not "fix" this unless the owner asks for it.

## How it is turned off

- Every page (the game's `index.html` and every generated page) carries
  `<meta name="robots" content="noindex">`.
- `robots.txt` blocks everything:

  ```
  User-agent: *
  Disallow: /
  ```

- No `sitemap.xml`, no `hreflang` alternates and no `<link rel="canonical">`.
- No Google Search Console or Bing Webmaster setup.

## What the page generator still produces

`npm run build` runs `scripts/export_data.js` and `scripts/make_seo_pages.py`, which
still generate the informative pages in `dist/` for players who follow links from the game:

- English at the root: `guide/`, `pokedex/`, `legendaries/`, `types/`, `moves/`,
  `items/`, `achievements/`, `news/`, `support/`, `contact/`.
- Spanish under `/es/` with the same slugs (`/es/guide/`, `/es/pokedex/`...).
- The old Spanish URLs (`/guia/`, `/legendarios/`...) and the old `/en/` URLs
  answer with a 301 redirect to the new ones.
- `404.html`, `robots.txt` (as above) and the sharing image
  `public/assets/og-image.jpg` (Open Graph / Twitter cards still work when the link is shared).

`scripts/build.js --no-seo` (formerly `--sin-seo`) builds `dist/index.html` without
the social/structured-data tags and the links to these pages.

## Languages

The game defaults to the browser language (Spanish for Spanish browsers, English
otherwise) and can be switched in Settings. English is the source text; Spanish
strings live in `src/js/data/lang-es.js`.

## Trademark notice

"Pokémon" is a registered trademark. The PokéSurvivor name may draw notices from
The Pokémon Company; the legal notice and the free, non-profit nature of the project
help, but do not remove that risk.
