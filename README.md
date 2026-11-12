# zindabaagh-website

**zindabaagh.com**: free tools and guides for studying, working and living in Germany.

A static site built by one small script (`build.mjs`, no dependencies) and served by
unprivileged nginx in Docker. No cookies, no trackers, no third-party fonts or scripts.

## Structure

| Path | Purpose |
|---|---|
| `content/site.json` | Menu, footer, tool list, pathways, services, sources, and the yearly figures (salary thresholds, tax and insurance rates) |
| `content/pages/` | One file per page: settings (JSON between `---` lines), then the page body |
| `content/pages/tools/` | Tool pages. `"tool": "<slug>"` links the page to its entry in `site.json` |
| `content/pages/guides/` | Guides (blog posts). `"guide": true` plus a `"date"`; the URL is `/guides/<file name>` |
| `public/` | Copied as it is: `styles.css`, `favicon.svg`, `js/zb.js` (shared), `js/tools/*.js` (one script per tool) |
| `build.mjs` | Builds everything into `dist/`, plus `sitemap.xml`, `robots.txt` and `js/facts.js` |
| `nginx.conf` | Port 8080, clean URLs (`/tools/x` serves `x.html`), security headers, gzip, `/healthz` |
| `Dockerfile` | Step 1 runs the build in Node, step 2 serves `dist/` with nginx |

In page bodies, `{{facts.blueCard.standard|eur}}` inserts a value from `site.json` and
`{{block:toolGrid}}` inserts a generated section (the list is in `build.mjs`).

## Common changes

- **Menu or footer:** edit `nav` / `footer` in `content/site.json`.
- **New guide:** copy a file in `content/pages/guides/`, change the settings and the text.
- **New tool:** add it to `tools` in `site.json`, add `content/pages/tools/<slug>.html` and `public/js/tools/<slug>.js`.
- **Every January:** update `facts` in `site.json`, and the income tax formula in `public/js/tools/salary-calculator.js`.

## Preview locally

```bash
node preview.mjs      # http://localhost:4321 (rebuilds on every page load)
```

## Deploy (Coolify)

- Source: GitHub App, this repository, branch `main`
- Build pack: **Dockerfile**, port **8080**, health check `/healthz`
- Domains: `https://zindabaagh.com,https://www.zindabaagh.com`

Every push to `main` redeploys automatically.

## Before promoting the site

- Fill in the **Impressum** (`content/pages/impressum.html`). German law requires a real name and postal address.
- Review the **privacy policy** (`content/pages/datenschutz.html`).
