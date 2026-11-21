# zindabaagh-website

**zindabhaag.com**: free tools and guides for studying, working and living in Germany, plus services
(free evaluation, study visa support, Opportunity Card, CV review, 1-on-1 calls).

| Document | Read it for |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How everything fits together, where every key lives and when it was created, backups and restore |
| [docs/USING-DIRECTUS.md](docs/USING-DIRECTUS.md) | Day-to-day use: leads, uploaded documents, guides, menu, where e-mails and bookings arrive |
| [cms/README.md](cms/README.md) | The scripts that set up and operate the CMS |
| [branding/README.md](branding/README.md) | Logo, colours, social media images |

## Repository layout

| Path | Purpose |
|---|---|
| `content/site.json` | Menu, footer, tools, services, yearly figures; fallback for what the CMS provides |
| `content/pages/` | One file per page: JSON settings between `---` lines, then the HTML body. `tools/` = tool pages, `guides/` = guides kept in git |
| `public/` | Copied as is: `styles.css`, `favicon.svg`, images, `js/zb.js` (shared), `js/tools/*.js`, `js/free-evaluation.js` |
| `build.mjs` | Builds the site into `dist/` (reads the CMS when `cms.url` is set) |
| `preview.mjs` | Local preview at http://localhost:4321 (rebuilds on every page load) |
| `nginx.conf`, `Dockerfile` | Production image: build in Node, serve with unprivileged nginx on port 8080 |
| `cms/` | Directus set-up and operations: content model, permissions, flows, upload guard, backup, compose file |
| `branding/` | Logo sources and rendered images (`node branding/render.mjs`) |

In page bodies, `{{facts.blueCard.standard|eur}}` inserts a value from `site.json` and `{{block:toolGrid}}`
a generated section (the list is in `build.mjs`). CMS content is inserted as written (no placeholders).

## Everyday work

```bash
node preview.mjs                 # check changes locally
git add -A && git commit -m "…"  # then:
git push                         # Coolify deploys zindabhaag.com (about 1 minute)
```
Content (guides, menu, services, pages) is edited in Directus and goes live by itself; see
[docs/USING-DIRECTUS.md](docs/USING-DIRECTUS.md). **Every January** update `facts` in `content/site.json` and
the income tax formula in `public/js/tools/salary-calculator.js`.

## Installation from scratch

Use this to rebuild everything on a new server or a new account. Order matters. Write each secret into
Bitwarden as you create it (section 6 of ARCHITECTURE.md lists them all).

### 1. Server, Coolify, DNS
1. Hetzner server with Coolify: follow `D:\Rahat Projects\hetzner-mcp\main-server-runbook.md`.
2. Cloudflare DNS for zindabhaag.com: A records `@`, `*` and `coolify` → server IP, all **DNS only** (grey cloud).
3. Coolify → Settings → Advanced → **API access: Enabled** (needed for the automatic rebuild).

### 2. Website
1. Coolify → project "zindabaagh website" → new resource → GitHub App → this repository, branch `main`,
   build pack **Dockerfile**, port **8080**, health check `/healthz`.
2. Domains: add `https://zindabhaag.com` and `https://www.zindabhaag.com` as two separate entries (each with `https://`).
3. Deploy. Check that `/`, `/tools/visa-finder` and `/healthz` answer.

### 3. Cloudflare R2 (file storage + backups)
1. R2 → Create bucket `zindabaagh-cms`, location **European Union**, storage class **Standard**.
2. R2 → API Tokens → **Create Account API token**: name `zindabaagh-cms`, **Object Read & Write**,
   **specific bucket** `zindabaagh-cms`, TTL Forever. Copy Access Key ID and Secret (shown once).
3. Endpoint: `https://<account id>.eu.r2.cloudflarestorage.com` (EU bucket).

### 4. Brevo (outgoing e-mail)
1. Brevo account with the authenticated sending domain `mail.zindabhaag.com` (see `D:\Rahat Projects\zindabaagh-email-guide.md`).
2. SMTP & API → **Generate a new SMTP key** named `zindabaagh-cms` (Brevo asks for an e-mailed code). Note the SMTP login.

### 5. Directus (cms.zindabhaag.com)
1. Locally: `node cms/make-compose.mjs` → creates `cms/compose.yml`.
2. Coolify → project "zinda sub domains" → new resource → **Docker Compose (empty)** → paste `cms/compose.yml`
   → Create. Name it `zindabaagh-cms`.
3. General → set **Admin Email** `hello@zindabhaag.com` (the admin password is generated; copy it to Bitwarden).
4. Domains → edit the Directus domain → **https**, `cms.zindabhaag.com`, port `8055`, **Noindex**.
5. Environment Variables (clear anything the browser autofills; set Build time to "not available"):
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`,
   `EMAIL_TRANSPORT=smtp`. Copy the generated `SERVICE_BASE64_64_SECRET` and `SERVICE_PASSWORD_64_BACKUP`
   (backup passphrase) to Bitwarden.
6. Deploy / Restart → dropdown → **Pull latest and restart**. Check https://cms.zindabhaag.com/server/ping.
7. Log in to the admin, open your user → **Token** → generate → save. Put it into
   `C:\Users\<you>\.zindabaagh-cms.env` as `CMS_ADMIN_TOKEN=…`.
8. Run, from this folder:
   ```bash
   node cms/setup.mjs           # collections, public permissions, Guide publisher (writes CMS_TOKEN to the env file)
   node cms/setup-uploads.mjs   # Public / Lead uploads folders, upload permissions, lead file fields
   ```
   `setup-uploads.mjs` prints nothing about IDs: if the "Lead uploads" folder ID differs from
   `cms.uploadFolder` in `content/site.json` and `LEAD_UPLOAD_FOLDER` in `cms/compose.template.yml`, update both
   (Directus → File Library → Lead uploads → the ID is in the address bar), regenerate the compose file and restart.
9. Copy the menu/services into the CMS once: Directus → Site → fill in from `content/site.json` (or ask the assistant to seed it).

### 6. Automations
1. Coolify → Keys & Tokens → API Tokens → New Token: `directus-rebuild`, permission **Deploy** only,
   resource **zindabaagh-website** only, expiry Never.
2. Add to `~/.zindabaagh-cms.env`:
   ```
   COOLIFY_DEPLOY_WEBHOOK=https://coolify.zindabhaag.com/api/v1/deploy?uuid=<website app uuid>&force=true
   COOLIFY_TOKEN=…
   ```
   (The app uuid is in the app's address bar in Coolify.)
3. `node cms/flows.mjs` → creates "Notify: new lead" (to zindabaagh@gmail.com; other inbox: `LEAD_NOTIFY_TO=…`
   in the env file) and "Rebuild website".
4. Cloudflare → Email Routing → rule `hello@zindabhaag.com` → your inbox.
5. Spam protection: Cloudflare → Application security → **Turnstile** → Add widget: name
   `zindabaagh free evaluation`, hostname `zindabhaag.com`, mode **Managed** → Create.
   - **Site key** (public) → `content/site.json` → `cms.turnstileSiteKey`, commit and push.
   - **Secret key** → Bitwarden and Coolify → zindabaagh-cms → Environment Variables → `TURNSTILE_SECRET`
     (Build time: not available) → Restart → **Pull latest and restart**. Set it only after the website with
     the site key is live, otherwise leads are refused in between.

### 7. Check
- Publish a draft guide in Directus → the website deploys within ~1 minute.
- Send the free evaluation form with a test PDF → the lead appears in Directus with the file, and the e-mail arrives.
- Coolify → zindabaagh-cms → Logs → service `backup` shows "backup ok".
- Afterwards: clear the admin user's Token in Directus and remove `CMS_ADMIN_TOKEN` from the env file.

## Before promoting the site

- Fill in the **Impressum** (`content/pages/impressum.html`): full name, postal address, VAT line.
- Complete the **privacy policy** placeholders (`content/pages/datenschutz.html`): controller, retention periods.
