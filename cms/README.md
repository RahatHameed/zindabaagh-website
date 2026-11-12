# CMS: Directus at cms.zindabaagh.com

Directus is the admin panel for guides, simple pages, the menu, the services list and the leads from the
free evaluation form (with uploaded documents). The website stays static and reads published content at
build time. Architecture, keys and restore: [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).
Daily use: [../docs/USING-DIRECTUS.md](../docs/USING-DIRECTUS.md).

## Files in this folder

| File | Purpose | Run |
|---|---|---|
| `compose.template.yml` | Coolify Docker Compose of the service `zindabaagh-cms` (Directus + backup), with placeholders | – |
| `make-compose.mjs` | Fills the template with the upload guard and the backup script → `compose.yml` | `node cms/make-compose.mjs` |
| `compose.yml` | Generated; paste into Coolify (Edit Compose File → Validate → Save → Force Restart) | – |
| `extensions/upload-guard/` | Directus hook: checks uploads into "Lead uploads", removes fakes and empty records | via compose |
| `backup/backup.sh` | Nightly encrypted SQLite backup to R2 (runs in the `backup` container) | via compose |
| `env.example` | All Directus settings with explanations (reference) | – |
| `setup.mjs` | Collections `guides`, `pages`, `site`, `leads`; public permissions; Guide publisher user + `CMS_TOKEN` | once / safe to re-run |
| `setup-uploads.mjs` | Folders Public + Lead uploads, upload permissions, lead file fields | once / safe to re-run |
| `flows.mjs` | Flows "Notify: new lead" and "Rebuild website" | after token changes |
| `publish-guide.mjs` | Create/update a guide from a JSON + HTML file (used by the reel skill) | per guide |

All scripts read `CMS_URL`, `CMS_ADMIN_TOKEN`, `CMS_TOKEN`, `COOLIFY_DEPLOY_WEBHOOK`, `COOLIFY_TOKEN`,
`LEAD_NOTIFY_TO` from the environment or from `~/.zindabaagh-cms.env`. They never print secrets.

Note: after the compose file was first saved, Coolify moved the upload-guard file contents into
**Persistent Storage → Files** of the service. Later changes to the guard are made there (paste the new
`index.js`, Save, then Restart → Pull latest and restart), not in the compose editor.

## State on 2026-11-12

All set up and tested on the live CMS:
- Directus 11 in Coolify service `zindabaagh-cms` with HTTPS; files in R2 (EU); SQLite on a volume.
- Content model, public permissions, Guide publisher token.
- Lead uploads: private folder, type allow-list, 10 MB limit, upload guard (fake/active-content files removed).
- Flows: lead notification via Brevo to hello@ (→ zindabaagh@gmail.com); rebuild of the website on publish
  (POST with `force=true`, tested: 44 s from save to live).
- Nightly backup to R2 (`backups/`), first one on 2026-11-12, 30 days kept. Restore not tested yet.

Open: clear the admin token when set-up work is over; copy `BACKUP_PASSPHRASE` from Coolify to Bitwarden;
restore test; Cloudflare Turnstile for the form.

## Publishing a guide from a script

```bash
node cms/publish-guide.mjs my-guide.json            # draft, prints the edit link
node cms/publish-guide.mjs my-guide.json --publish  # published; the site rebuilds by itself
```
```json
{
  "slug": "student-visa-checklist",
  "title": "Student visa checklist for Germany",
  "description": "Every document the embassy asks for, in the order to prepare them.",
  "bodyFile": "student-visa-checklist.html",
  "keyword": "VISA",
  "relatedTool": "visa-finder"
}
```
Public address: `https://zindabaagh.com/guides/<slug>`. Running it again with the same slug updates the guide.
