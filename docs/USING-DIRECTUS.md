# Using the admin panel (Directus) and the other tools

_Last updated: 2026-11-12_

Where every enquiry, e-mail and evaluation request arrives, and how to work with them.

## Where things arrive

| What | Where you see it | Notification |
|---|---|---|
| **Free evaluation requests** (incl. uploaded documents) | Directus → **Leads** (https://cms.zindabaagh.com/admin/content/leads) | E-mail "New free evaluation: <name> (<goal>)" straight to zindabaagh@gmail.com; **Reply** answers the visitor |
| **Contact form messages** (zindabaagh.com/contact) | Directus → **Messages** (https://cms.zindabaagh.com/admin/content/messages); set **message_status** new → answered → closed | E-mail "Contact form: <name> (<topic>)" to zindabaagh@gmail.com; **Reply** answers the sender |
| E-mails to hello@zindabaagh.com (shown on the contact page and in the Impressum) | Gmail **zindabaagh@gmail.com** | Gmail |
| E-mails to support@ / privacy@zindabaagh.com | Gmail **zindabaagh@gmail.com** | Gmail |
| Form requests when the CMS was down (fallback) | Gmail, as an e-mail from the visitor's own address with the answers in the text | Gmail |
| **1-on-1 bookings and payments** | Cal.com dashboard (https://app.cal.com) | Cal.com e-mails |
| ExamKlar sign-ups and learners | ExamKlar's Supabase project (separate) | – |
| Instagram comments / keyword DMs | Instagram / SuperProfile, Facebook / SendPulse | as set up there |
| Did an e-mail from Directus go out? | Brevo → **Transactional → Logs** (https://app.brevo.com) | – |
| Is the site/CMS running, did a rebuild work? | Coolify (https://coolify.zindabaagh.com) → app / service → **Logs**, **Deployments** | – |
| Backups | Coolify → zindabaagh-cms → Logs → service **backup** ("backup ok: …"); files in Cloudflare R2 → bucket `zindabaagh-cms` → `backups/` | – |

Tip: in Gmail, create a filter for `from:noreply@mail.zindabaagh.com` and `subject:"New free evaluation"` with a label
"Leads", so requests never get lost between other mail.

## Logging in

https://cms.zindabaagh.com/admin, e-mail `hello@zindabaagh.com`, password from Bitwarden. Forgotten
password: "Forgot password" on the login page; the reset mail goes to hello@ → Gmail.

## Working with evaluation requests (Leads)

1. Open **Leads** in the left menu. Newest first; click a row to open it.
2. You see all answers: contact details (e-mail, WhatsApp), country, goal, service, qualification, field and
   grade, experience, timeline, languages, message, and **source** (where they came from, e.g.
   `guide-blue-card-germany` = from that guide, or an Instagram link).
3. **Documents** (study requests): the four file fields (IELTS, CV, Degree, Transcript). Click a file to open
   or download it. Open PDFs in the browser, not in desktop Acrobat or Word. Uploads were already checked by the
   upload guard, but caution is still right with files from strangers.
4. Set **lead_status**: `new` → `answered` → `client` or `closed`. Use **notes** for your own remarks
   (never visible to the visitor).
5. Reply by e-mail from Gmail or on WhatsApp.
6. **Filter / search:** the search box at the top, or the filter icon (e.g. `lead_status = new`,
   `goal = study`). Save useful filters as **bookmarks** in the left menu ("Open leads", "Study leads").
7. **Export:** the "…" menu at the top right of the list → Export (CSV/Excel), for example for a monthly overview.
8. **Delete on request** (GDPR): open the lead → delete (bin icon). Its documents in **File Library → Lead
   uploads** are removed automatically within about 2½ hours (the upload guard deletes documents no lead
   points to). The privacy policy promises deletion after 12 months without contact: once a month, filter
   `date_created < 12 months ago` and delete those leads.
   Keep only form documents in "Lead uploads": anything there that no lead points to is deleted after 2 hours.

**Spam protection:** the form has a Cloudflare Turnstile check (most visitors see nothing or one tick box).
Leads without a valid check are refused. Leads you create by hand in Directus are not affected. Refused
attempts show up in Coolify → zindabaagh-cms → Logs as "lead refused, Turnstile failed". Turnstile
statistics: Cloudflare → Application security → Turnstile.

## Writing and publishing a guide

Normally the reel-post-package skill does this from a reel. By hand:

1. **Guides** → **+** (top right).
2. Fill in: **title**; **slug** (the address, e.g. `student-visa-checklist` → zindabaagh.com/guides/student-visa-checklist);
   **description** (1-2 sentences for Google and link previews); **body** (the editor: headings, lists,
   links, tables, quotes); optional **keyword** (Instagram comment keyword) and **related_tool**
   (e.g. `blue-card-check`, shows a tool box under the guide).
3. **status = Draft** keeps it invisible. Save and check later.
4. Set **status = Published** and save. The website rebuilds by itself; after about a minute the guide is live.
   Every guide automatically ends with a tool box, a "free evaluation" box and the disclaimer.
5. **Images:** use the image button in the editor; images are stored in the **Public** folder (the default).
   Never put images for guides into "Lead uploads", which is private.

## Changing the menu, services or tagline

**Site** (left menu, a single page):
- **nav**: the main menu items (label, link, external yes/no), in order. Drag to reorder.
- **navCta**: the button on the right of the menu.
- **services**: the cards on the home page and on /services (title, text, bullet points, link, button text).
  The 1-on-1 service links to Cal.com; the others link to the free evaluation form with the service pre-selected.
- **tagline**: the line in the footer.

Save → the site rebuilds by itself. If something looks wrong, change it back and save again.

## Simple text pages

**Pages** → **+**: title, slug, body, status Published → appears at zindabaagh.com/<slug>.

## If something does not update

- Wait 2 minutes, then reload the page with Ctrl+F5.
- Coolify → project "zindabaagh website" → app `zindabaagh-website` → **Deployments**: the newest one should be
  "Finished". If it failed, open it to see why.
- Directus → Settings → **Flows** → "Rebuild website" → the logs (right side) show whether Coolify answered.
- By hand: Coolify → `zindabaagh-website` → Redeploy → **Force deploy (without cache)**.
- No lead e-mail? Directus → Flows → "Notify: new lead" logs, then Brevo → Transactional → Logs, then Gmail spam.
- Visitors say the form says "security check failed"? Check that `TURNSTILE_SECRET` in Coolify matches the
  widget in Cloudflare → Turnstile, and that the widget's hostname is zindabaagh.com. To switch the check off
  quickly: empty `TURNSTILE_SECRET` in Coolify → Restart → Pull latest and restart.
