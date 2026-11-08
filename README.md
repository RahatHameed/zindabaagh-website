# zindabaagh-website

Landing page for **zindabaagh.com**: guidance on studying and working in Germany.

Static HTML/CSS served by unprivileged nginx in Docker. No build step, no cookies,
no trackers, no third-party fonts or scripts.

## Structure

| Path | Purpose |
|---|---|
| `site/` | The website (`index.html`, `styles.css`, legal pages, favicon) |
| `nginx.conf` | Listens on 8080, security headers, gzip, `/healthz` |
| `Dockerfile` | `nginx-unprivileged:stable-alpine` + the site |

## Preview locally

```bash
node preview.mjs      # http://localhost:4321
```

## Deploy (Coolify)

- Source: GitHub App, this repository, branch `main`
- Build pack: **Dockerfile**
- Port exposed: **8080**
- Domains: `https://zindabaagh.com,https://www.zindabaagh.com`
- Health check path: `/healthz`

Every push to `main` redeploys automatically.

## Before promoting the site

- Fill in the **Impressum** (`site/impressum.html`). German law requires a real name and postal address.
- Review the **privacy policy** (`site/datenschutz.html`).
- Set up `hello@zindabaagh.com` (Cloudflare Email Routing) so the contact link works.
