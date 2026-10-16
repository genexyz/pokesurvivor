# Setting up pokesurvivor.com

> **Note (2026-10-16):** the game moved to **survivor.preciostcg.com** (Coolify, see
> [PUBLISHING.md](PUBLISHING.md)). Everything below is historical.

> **Note (2026-10-16):** historical. The game is no longer published on GitHub Pages but
> with Docker on Coolify ([PUBLISHING.md](PUBLISHING.md)), and `tools/activar_dominio.sh` was
> removed. For a domain, an `A` record to the server's IP and adding it in Coolify is enough.
> Search engine indexing is now turned off on purpose (see [SEO.md](SEO.md)), and the page
> URLs mentioned below have changed.

The domain is bought on **Cloudflare** and does not point anywhere yet.
Everything on the code side is ready: only the steps marked **YOU**
(the ones that need your account) and the final step, which I do when you tell me, are left.

Status as of 2026-10-10:

- [x] Domain bought on Cloudflare (Cloudflare DNS servers active).
- [x] `pokesurvivor.com` and `www.pokesurvivor.com` added to Firebase → authorized
      domains (Google sign-in will work from day one).
- [x] Pages in Spanish and English, sitemap, robots, 404 and sharing image,
      generated and tested (Lighthouse: SEO 100, accessibility 100).
- [x] Final-step script rehearsed: `tools/activar_dominio.sh`.
- [x] Step 1 · DNS on Cloudflare (**YOU**)
- [x] Step 2 · Verify the domain on GitHub (**YOU**, recommended)
- [x] Step 3 · Final step (**ME**): done on 2026-10-10, with HTTPS
- [ ] Step 4 · Google Search Console and Bing (**YOU**)

---

## Step 1 · DNS on Cloudflare (YOU, 5 minutes)

1. Go to <https://dash.cloudflare.com> → pick **pokesurvivor.com** →
   left menu **DNS → Records**.
2. Click **Add record** and create these 9 records. On all of them, the
   **Proxy status** toggle must be set to **DNS only** (**grey** cloud, not orange).

   | Type  | Name  | IPv4 / IPv6 / Target  |
   | ----- | ----- | --------------------- |
   | A     | `@`   | `185.199.108.153`     |
   | A     | `@`   | `185.199.109.153`     |
   | A     | `@`   | `185.199.110.153`     |
   | A     | `@`   | `185.199.111.153`     |
   | AAAA  | `@`   | `2606:50c0:8000::153` |
   | AAAA  | `@`   | `2606:50c0:8001::153` |
   | AAAA  | `@`   | `2606:50c0:8002::153` |
   | AAAA  | `@`   | `2606:50c0:8003::153` |
   | CNAME | `www` | `jpter78.github.io`   |

   These are the GitHub Pages addresses, which is where the game is hosted.

> **Why the grey cloud:** with the orange cloud, Cloudflare sits in the middle and
> GitHub cannot create the HTTPS certificate (the padlock). Also, with Cloudflare's
> "Flexible" SSL mode the site gets stuck in a redirect loop. With grey everything
> works first time; later on the orange one can be turned on with SSL
> **Full (strict)** if it is ever worth it, but it is not needed.

Optional and free in the same dashboard:

- **DNSSEC** (DNS menu → Settings → Enable DNSSEC): protects the domain against
  spoofing.
- **Email Routing**: a `contacto@pokesurvivor.com` address forwarded to your Gmail,
  if you want an email with the game's name.

When it is done, tell me **"DNS is ready"** and I will check that it resolves from outside
(it usually takes 5 minutes to 1 hour).

## Step 2 · Verify the domain on GitHub (YOU, recommended, 3 minutes)

Protects the domain: it stops any other GitHub account from using pokesurvivor.com.

1. Go to <https://github.com/settings/pages> (with the JPTER78 account).
2. **Add a domain** → type `pokesurvivor.com` → **Add domain**.
3. GitHub shows you a **TXT** record: a name like
   `_github-pages-challenge-JPTER78` and a long value.
4. In Cloudflare → DNS → Records → **Add record**: Type **TXT**, Name the one GitHub
   gave you (without `.pokesurvivor.com` at the end), Content the long value.
5. Go back to GitHub and click **Verify**. If it fails, wait a few minutes and try again.

## Step 3 · Final step (ME)

Once DNS works, I do all of it:

1. `bash tools/activar_dominio.sh`: builds the game with SEO, regenerates the
   pages, creates the `CNAME` file and prepares the commit (checks that no private
   data slips in).
2. I push it to GitHub and set the `pokesurvivor.com` domain in GitHub Pages.
3. I wait for GitHub to create the certificate and turn on **Enforce HTTPS**.
4. I check in a real browser: the site, `www.` → without `www`, the old github.io
   address → the new one, English at `/en/`, signing in with an account and with Google,
   the leaderboard and co-op.
5. I set `https://pokesurvivor.com` as the GitHub repository's website.

**Watch out for guest saves:** they are stored in the browser and tied to the
address. Anyone playing as a guest on `jpter78.github.io` will not see that save on
`pokesurvivor.com` (registered accounts will, because they are in the cloud). If anyone
asks: they should create an account before the switch.

## Step 4 · Google Search Console and Bing (YOU, after step 3)

1. <https://search.google.com/search-console> → **Add property** →
   **Domain** → `pokesurvivor.com`.
2. Since the domain is on Cloudflare, Google offers to **verify with Cloudflare**
   automatically: accept and you are done (if not, it gives you a TXT to add as in
   step 2).
3. **Sitemaps** menu → type `sitemap.xml` → **Submit**.
4. **URL Inspection** menu → `https://pokesurvivor.com/` → **Request
   indexing**. Repeat with `https://pokesurvivor.com/en/`,
   `https://pokesurvivor.com/guia/` and `https://pokesurvivor.com/pokedex/`.
5. Bing (and with it DuckDuckGo and Ecosia): <https://www.bing.com/webmasters> →
   **Import from Google Search Console**.

Google takes from a few days to a couple of weeks to start showing the site.

## Afterwards

- Change the link in the YouTube trailer description, on Ko-fi and wherever you
  shared it.
- What helped ranking most from there on (links from YouTube, itch.io, Reddit,
  Discord...) used to be in [SEO.md](SEO.md); that strategy no longer applies.
