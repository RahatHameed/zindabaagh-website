# Zindabhaag: architecture

_Last updated: 2026-11-12_

Everything that makes up zindabhaag.com, how the parts talk to each other, where every key lives
and when it was created. For day-to-day use of the admin panel see [USING-DIRECTUS.md](USING-DIRECTUS.md);
for setting everything up from scratch see the [README](../README.md).

## 1. Overview

```
                         Cloudflare DNS (zindabhaag.com, all records "DNS only")
                                         │
                                         ▼
                ┌────────────── Hetzner server "main-server" (2.31.191.119) ──────────────┐
                │  Coolify (coolify.zindabhaag.com) + Traefik proxy, Let's Encrypt certs   │
                │                                                                         │
                │  App "zindabaagh-website"            Service "zindabaagh-cms"           │
                │  (project "zindabaagh website")      (project "zinda sub domains")      │
                │  nginx serving the static site        ├─ directus  (Directus 11)        │
                │  zindabhaag.com, www                  │   cms.zindabhaag.com            │
                │                                       │   SQLite on volume              │
                │                                       │   + upload-guard extension      │
                │                                       └─ backup    (Alpine + cron)      │
                └───────────────────────┬───────────────────────────┬─────────────────────┘
                                        │                           │
              GitHub repo (private)     │                           │  files + nightly DB backups
              RahatHameed/              │                           ▼
              zindabaagh-website ──push─┘                 Cloudflare R2 bucket "zindabaagh-cms" (EU)
                                                         
   E-mail out: Directus → Brevo SMTP (mail.zindabhaag.com) → your inbox
   E-mail in:  hello@ / support@ / privacy@zindabhaag.com → Cloudflare Email Routing → zindabaagh@gmail.com
   Bookings:   1-on-1 calls → Cal.com (https://app.cal.com/discover/rahat-hameed-1n1)
   Separate:   ExamKlar (examklar.com) - own app, own repo, own Supabase project
```

## 2. The website (zindabhaag.com)

| | |
|---|---|
| Code | This repository, branch `main` |
| Type | Static site, built by `build.mjs` (Node, no dependencies), served by `nginx-unprivileged` |
| Hosting | Coolify app `zindabaagh-website`, Dockerfile build pack, port 8080, health check `/healthz` |
| Deploys | Every push to `main` (GitHub App webhook), and every publish in the CMS (flow "Rebuild website") |
| Domains | `https://zindabhaag.com`, `https://www.zindabhaag.com` (two separate entries in Coolify) |

**How a build works** (`Dockerfile` step 1 runs `node build.mjs`):

1. Reads `content/site.json` (menu, footer, tools, services, yearly figures).
2. If `cms.url` is set (it is: `https://cms.zindabhaag.com`), fetches from Directus:
   the `site` item (tagline, menu, menu button, services) and all **published** `guides` and `pages`.
   CMS values replace the file values. If Directus is unreachable, the build continues with the files.
3. Renders every page in `content/pages/**` plus every CMS guide/page into `dist/`, with header, footer,
   `sitemap.xml`, `robots.txt` and `js/facts.js` (figures + form endpoints for the browser).
4. Copies `public/` (CSS, JS, images). CSS/JS links carry `?v=<build id>` so browsers fetch new versions.

**Pages:** home, 8 tools (`/tools/<slug>`, all calculations run in the browser), `/guides` + guides,
`/services`, `/free-evaluation`, Impressum, privacy policy.

**Security headers** (nginx.conf): CSP (`default-src 'self'`, form/API calls only to cms.zindabhaag.com),
X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. No cookies, no analytics, no third-party
scripts or fonts, so no cookie banner is needed.

## 3. The CMS (cms.zindabhaag.com)

Directus 11, Coolify Docker Compose service `zindabaagh-cms`. The compose file is generated from
`cms/compose.template.yml` by `node cms/make-compose.mjs` (see section 7).

| Collection | Holds | Public access |
|---|---|---|
| `guides` | Guides / blog posts (title, slug, description, HTML body, keyword, related tool, status) | Read when `status = published` |
| `pages` | Simple text pages at `/<slug>` | Read when published |
| `site` (single item) | Tagline, main menu, menu button, services list | Read |
| `leads` | Free evaluation requests incl. document links, your status and notes | **Create only** (needs consent = true); never readable |
| Files, folder **Public** | Images for guides (default upload folder) | Read |
| Files, folder **Lead uploads** | Documents from the form (IELTS, CV, degree, transcript) | **Create only**: PDF/JPG/PNG/WEBP, max 10 MB; never readable or listable |

**Users / roles**
- Admin: `hello@zindabhaag.com` (password in Coolify, see section 6).
- "Guide publisher": no app login; its token (`CMS_TOKEN`) may only create/read/update guides and files.
  Used by `cms/publish-guide.mjs` and the reel-post-package skill.

**Automations (Settings → Flows)**, created by `node cms/flows.mjs`:
- **Notify: new lead**: on every new lead, e-mails all answers + a link to the lead to `hello@zindabhaag.com`.
- **Rebuild website**: on create/update/delete of guides, pages or site, sends
  `POST https://coolify.zindabhaag.com/api/v1/deploy?uuid=rt1bcj6gvrcspoud34r4lidf&force=true`
  with the Coolify token. `force=true` is required: otherwise Coolify reuses the old image and skips the build.

**upload-guard extension** (`cms/extensions/upload-guard/`): after every upload into "Lead uploads" it
reads the stored file and deletes it unless the content really is PDF/JPG/PNG/WEBP, the file name matches,
and a PDF contains no active content (`/JavaScript`, `/Launch`, `/EmbeddedFile`, …). Every 30 minutes it
removes empty records left by refused uploads, and documents older than 2 hours that no lead points to
(abandoned forms, bots, and the documents of leads you deleted). It also checks **Cloudflare Turnstile** on
every public lead and contact message (collections `leads` and `messages`): the form sends the token as `captcha`, the hook verifies it with Cloudflare
(`TURNSTILE_SECRET`, hostname must be zindabhaag.com / www) and removes it before saving; a failed check
answers 400. Logged-in users and API tokens are not checked. Without `TURNSTILE_SECRET` the check is off,
and if Cloudflare cannot be reached the lead is accepted (logged). Directus itself enforces `FILES_MAX_UPLOAD_SIZE=10mb` and a
MIME allow-list. Tested on 2026-11-12: real PDF kept; fake PDF (exe), PDF with JavaScript, wrong extension,
wrong type, 11 MB file and uploads into other folders all rejected or deleted.

**How the form attaches documents without being able to read them:** the browser picks a random ID for each
file (`crypto.randomUUID()`), uploads it into "Lead uploads", then sends the lead with those IDs.

## 4. Storage and backups

| What | Where | Notes |
|---|---|---|
| Directus database | SQLite `/directus/database/data.db` on Docker volume `lb7zkub4dx5xkq1rl6ykzz2y_directus-database` | Small; the only CMS data on the server disk |
| Uploaded files | R2 bucket `zindabaagh-cms` (EU jurisdiction), object names = file IDs | Nothing is stored on the server disk |
| DB backups | R2 bucket `zindabaagh-cms`, prefix `backups/`, `directus-YYYY-MM-DD_HHMM.db.gz.enc` | Container `backup`: daily 03:15 Berlin + once at every restart. Consistent SQLite copy → integrity check → gzip → AES-256 (openssl, PBKDF2) with `BACKUP_PASSPHRASE` → upload. Keeps 30 days. First backup: 2026-11-12 14:58 (40 KB) |
| Website | GitHub repo + the Docker image Coolify builds | Rebuildable from git at any time |

**Restore the CMS database** (in Coolify → `zindabaagh-cms` → Terminal, container `backup`):
```sh
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
aws s3 ls s3://$R2_BUCKET/backups/ --endpoint-url "$R2_ENDPOINT"            # pick a file
aws s3 cp s3://$R2_BUCKET/backups/<file> /tmp/b.enc --endpoint-url "$R2_ENDPOINT"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in /tmp/b.enc | gunzip > /tmp/restore.db
sqlite3 /tmp/restore.db "PRAGMA integrity_check;"                            # must print: ok
```
Then stop the `directus` container (Coolify → Stop), `cp /tmp/restore.db /data/data.db` in the backup
container, and start the service again. **A restore has not been tested yet.**

## 5. E-mail and bookings

| Address / tool | Direction | Path |
|---|---|---|
| `hello@zindabhaag.com` | in | Cloudflare Email Routing → zindabaagh@gmail.com (rule added 2026-11-12) |
| `support@`, `privacy@zindabhaag.com` | in | Cloudflare Email Routing → zindabaagh@gmail.com (added for ExamKlar) |
| Everything else @zindabhaag.com | in | dropped (catch-all disabled) |
| Contact form notification | out | Flow "Notify: new contact message" → Brevo → zindabaagh@gmail.com, Reply-To = the sender (added 2026-11-12) |
| Lead notification | out | Flow "Notify: new lead" → Brevo → **zindabaagh@gmail.com directly** (since 2026-11-12, not via hello@), Reply-To = the visitor's e-mail |
| `noreply@mail.zindabhaag.com` | out | Directus → Brevo SMTP (`smtp-relay.brevo.com:587`); domain authenticated in Brevo (DKIM/DMARC in Cloudflare) |
| Cal.com | bookings | 1-on-1 calls with online payment; linked from `/services` and the home page |

## 6. Keys, passwords and where they live

No secret is stored in this repository. Values live in **Bitwarden** (note "Zindabhaag CMS (Directus) -
cms.zindabhaag.com"), in **Coolify**, and in the local file **`C:\Users\Zigron\.zindabaagh-cms.env`**
(used by the scripts in `cms/`).

| Secret | Created | Where it is used / stored | Who can change it |
|---|---|---|---|
| Directus admin password | 2026-11-12, generated by Coolify (`SERVICE_PASSWORD_ADMIN`) | Coolify → zindabaagh-cms → General ("Admin · Password"); Bitwarden | Coolify / Directus profile |
| Directus `SECRET` | 2026-11-12, generated by Coolify (`SERVICE_BASE64_64_SECRET`) | Coolify env; Bitwarden. Needed to rebuild the CMS elsewhere | Coolify |
| `CMS_ADMIN_TOKEN` (admin static token) | 2026-11-12, by Rahat in Directus (user profile → Token) | `~/.zindabaagh-cms.env`; Bitwarden. **Temporary**: clear it in Directus when no more set-up runs are planned | Directus |
| `CMS_TOKEN` (Guide publisher) | 2026-11-12, by `cms/setup.mjs` | `~/.zindabaagh-cms.env`; Bitwarden. Used by `publish-guide.mjs` / reel skill | Directus → Users → Guide Publisher |
| R2 API token `zindabaagh-cms` (Access Key ID + Secret) | 2026-11-12, Cloudflare R2 → API Tokens (Account token, Object Read & Write, bucket `zindabaagh-cms` only, no expiry) | Coolify env `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (service zindabaagh-cms, used by `directus` and `backup`); Bitwarden | Cloudflare |
| `R2_ENDPOINT` (not secret) | 2026-11-12 | Coolify env: `https://edbed2fad026cd7a5a10244eedc81165.eu.r2.cloudflarestorage.com` | |
| `BACKUP_PASSPHRASE` | 2026-11-12, generated by Coolify (`SERVICE_PASSWORD_64_BACKUP`) | Coolify env of zindabaagh-cms. **Copy it to Bitwarden**: without it no backup can be restored | Coolify |
| Brevo SMTP key `zindabaagh-cms` | 2026-11-12, Brevo → SMTP & API | Coolify env `BREVO_SMTP_KEY`; Bitwarden. Login (not secret): `BREVO_SMTP_USER=c29990001@smtp-brevo.com` | Brevo |
| Coolify API token `directus-rebuild` | 2026-11-12, Coolify → Keys & Tokens (permission **deploy** only, resource **zindabaagh-website** only, no expiry) | `~/.zindabaagh-cms.env` `COOLIFY_TOKEN`; inside the Directus flow "Rebuild website"; Bitwarden | Coolify |
| `COOLIFY_DEPLOY_WEBHOOK` (not secret) | 2026-11-12 | `~/.zindabaagh-cms.env` and the flow | |
| Turnstile widget "zindabaagh free evaluation": **secret key** | 2026-11-12, Cloudflare → Application security → Turnstile (hostname zindabhaag.com, mode Managed) | Coolify env `TURNSTILE_SECRET` (service zindabaagh-cms, read by the upload-guard hook); Bitwarden | Cloudflare → Turnstile → widget → Rotate secret key |
| Turnstile **site key** (not secret) | 2026-11-12, same widget | `content/site.json` → `cms.turnstileSiteKey` (public, sent to browsers) | |

**Settings changed on 2026-11-12:** Coolify API access enabled (Settings → Advanced); Cloudflare Email Routing
rule `hello@` → zindabaagh@gmail.com.

**If a key leaks:** create a new one at the "Who can change it" place, update Coolify (then Force Restart) or
the env file, run `node cms/flows.mjs` again for the Coolify token, and delete the old key.

## 7. Changing the infrastructure

| Change | How |
|---|---|
| Website code or files | Edit, `node preview.mjs` to check, commit, `git push` → Coolify deploys |
| Content, menu, services, guides | Directus → the site rebuilds by itself (~1 minute) |
| Directus settings, upload guard, backup | Edit `cms/compose.template.yml`, `cms/extensions/upload-guard/*` or `cms/backup/backup.sh` → `node cms/make-compose.mjs` → paste `cms/compose.yml` into Coolify (zindabaagh-cms → Edit Compose File → Validate → Save) → Restart dropdown → **Pull latest and restart / Force Restart**. Note: after the first save Coolify keeps file contents (the extension) under **Persistent Storage → Files**; edit them there afterwards |
| Collections, permissions | `node cms/setup.mjs`, `node cms/setup-uploads.mjs` (safe to re-run) |
| Flows | `node cms/flows.mjs` (re-creates both flows) |
| Coolify redeploy by hand | Use **Force deploy (without cache)**, otherwise new CMS content is not fetched |

## 8. Known limits and open items

- Pushing to GitHub needs Rahat's go-ahead (the assistant may not deploy to production). Commit `622afed`
  (study uploads, Cal.com link, guide lead box) was **not pushed yet** on 2026-11-12.
- Impressum and privacy policy contain placeholders (name, address, VAT line, retention periods).
- Spam protection: Cloudflare Turnstile on the lead (2026-11-12), honeypot, Directus rate limit. Document
  uploads themselves are not Turnstile-checked (a token can be used only once); unused uploads are removed
  after 2 hours by the guard.
- Backups: restore not tested yet. Uploaded files in R2 are not versioned (deleting one is final).
- The PDF check is a strong heuristic, not a virus scanner. Open uploads in the browser's PDF viewer.
- Figures (Blue Card, Opportunity Card points, tax) come from secondary sources and need a yearly check.
