// Builds the static site into dist/. No dependencies. Usage: node build.mjs
//
//   content/site.json      menu, footer, tool list, services, yearly figures
//   content/pages/**.html  one file per page: JSON settings between --- lines, then the page body
//   content/pages/guides/  guides (blog posts): add "guide": true and a "date"; the URL is /guides/<file name>
//   public/                files copied as they are (CSS, JS, favicon)
//
// With CMS_URL set (or cms.url in site.json), published guides, pages, the menu and the services
// are also read from Directus at build time; without it, or if it cannot be reached, the files are used.
//
// In page bodies: {{facts.blueCard.standard|eur}} inserts a value from site.json,
// {{block:toolGrid}} inserts a generated section (see `blocks` below).
import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n, digits) => "€" + Number(n).toLocaleString("en-IE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const filters = { eur: (n) => money(n, 0), eur2: (n) => money(n, 2) };
const ext = (l) => (l.external ? ' target="_blank" rel="noopener"' : "");

async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.name.endsWith(".html")) files.push(p);
  }
  return files;
}

function parsePage(text, file) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: page must start with JSON settings between --- lines`);
  return { ...JSON.parse(m[1]), body: m[2] };
}

export async function build() {
  const site = JSON.parse(await readFile(join(root, "content/site.json"), "utf8"));
  const cmsUrl = (process.env.CMS_URL || site.cms?.url || "").replace(/\/+$/, "");
  const cms = cmsUrl ? await loadCms(cmsUrl) : null;
  if (cms?.site) for (const key of ["tagline", "nav", "navCta", "services"]) if (cms.site[key]?.length || cms.site[key]?.label) site[key] = cms.site[key];
  const toolHref = (t) => `/tools/${t.slug}`;
  const toolsIn = (group) => site.tools.filter((t) => !group || t.group === group);

  const toolCard = (t) => `
          <a class="card tool-card" data-group="${t.group}" href="${toolHref(t)}">
            <div class="icon" aria-hidden="true">${t.icon}</div>
            <h3>${esc(t.title)}</h3>
            <p>${esc(t.short)}</p>
            <span class="card-link">Open tool →</span>
          </a>`;

  const pages = [];
  for (const file of await walk(join(root, "content/pages"))) {
    const page = parsePage(await readFile(file, "utf8"), file);
    page.file = file;
    if (page.guide) page.path = `/guides/${basename(file, ".html")}`;
    pages.push(page);
  }
  // CMS guides and pages are added to the files; on the same address the CMS version wins.
  const addOrReplace = (page) => { const i = pages.findIndex((p) => p.path === page.path); if (i >= 0) pages[i] = page; else pages.push(page); };
  for (const g of cms?.guides ?? [])
    addOrReplace({ guide: true, fromCms: true, path: `/guides/${g.slug}`, file: `CMS guide "${g.slug}"`, title: g.title, description: g.description ?? "",
      date: String(g.date_published ?? g.date_created ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      relatedTool: g.related_tool || undefined, body: g.body ?? "" });
  for (const c of cms?.pages ?? [])
    addOrReplace({ fromCms: true, path: `/${c.slug}`, file: `CMS page "${c.slug}"`, title: `${c.title} | ${site.name}`, description: c.description ?? "",
      body: `\n    <div class="wrap legal">\n      <h1>${esc(c.title)}</h1>\n${c.body ?? ""}\n    </div>` });
  const guides = pages.filter((p) => p.guide).sort((a, b) => b.date.localeCompare(a.date));
  const niceDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const guideCards = (list) =>
    list.length
      ? `
        <div class="cards cards-wide">${list
          .map(
            (g) => `
          <a class="card tool-card" href="${g.path}">
            <span class="badge">Guide</span>
            <h3>${esc(g.title)}</h3>
            <p>${esc(g.description)}</p>
            <span class="card-link">Read the guide →</span>
          </a>`
          )
          .join("")}
        </div>`
      : `<p class="muted">The first guides are being written.</p>`;

  const blocks = {
    guideList: () => guideCards(guides),
    latestGuides: () => guideCards(guides.slice(0, 3)),
    toolGrid: () => `
        <div class="chips" role="group" aria-label="Filter tools">
          <button class="chip is-active" type="button" data-filter="all">All</button>${site.toolGroups
            .map((g) => `\n          <button class="chip" type="button" data-filter="${g.id}">${esc(g.label)}</button>`)
            .join("")}
        </div>
        <div class="cards" id="tool-grid">${site.tools.map(toolCard).join("")}
        </div>`,
    pathways: () => `
        <div class="cards">${site.pathways
          .map(
            (p) => `
          <a class="card tool-card" href="${p.href}">
            <div class="icon" aria-hidden="true">${p.icon}</div>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.text)}</p>
            <span class="card-link">${esc(p.cta)} →</span>
          </a>`
          )
          .join("")}
        </div>`,
    services: () => `
        <div class="cards">${site.services
          .map(
            (s) => `
          <a class="card tool-card" href="${s.external ? s.href : "/services#" + s.slug}"${ext(s)}>
            <span class="badge">${esc(s.badge)}</span>
            <h3>${s.icon ?? ""} ${esc(s.title)}</h3>
            <p>${esc(s.text)}</p>
            <span class="card-link">${s.external ? esc(s.cta) + " ↗" : "Details →"}</span>
          </a>`
          )
          .join("")}
        </div>`,
    serviceDetails: () =>
      site.services
        .map(
          (s) => `
        <article class="panel service" id="${s.slug}">
          <span class="badge">${esc(s.badge)}</span>
          <h2>${s.icon ?? ""} ${esc(s.title)}</h2>
          <p>${esc(s.text)}</p>${s.points?.length ? `\n          <ul>${s.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          <a class="btn btn-small" href="${s.href}"${ext(s)}>${esc(s.cta)}${s.external ? " ↗" : ""}</a>
        </article>`
        )
        .join(""),
    serviceOptions: () =>
      site.services
        .filter((s) => !s.external && s.slug !== "free-evaluation")
        .map((s) => `\n              <option value="${s.slug}">${esc(s.title)}</option>`)
        .join(""),
    sources: () => `
        <ul class="source-list">${site.sources
          .map((s) => `\n          <li><a href="${s.href}" rel="noopener" target="_blank">${esc(s.label)}</a>: ${esc(s.text)}</li>`)
          .join("")}
        </ul>`,
  };

  const fill = (html) =>
    html
      .replace(/\{\{block:(\w+)\}\}/g, (_, name) => {
        if (!blocks[name]) throw new Error(`Unknown block: ${name}`);
        return blocks[name]();
      })
      .replace(/\{\{\s*([\w.]+)(?:\|(\w+))?\s*\}\}/g, (_, path, filter) => {
        const value = path.split(".").reduce((o, k) => (o == null ? o : o[k]), site);
        if (value == null) throw new Error(`Unknown value: ${path}`);
        return filter ? filters[filter](value) : esc(value);
      });

  const header = `
  <header class="site-header">
    <div class="wrap nav">
      <a class="brand" href="/" aria-label="${esc(site.name)} home">
        <img src="/favicon.svg" alt="" width="28" height="28">
        <span>${esc(site.name)}</span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Menu">☰</button>
      <nav id="main-nav" aria-label="Main">${site.nav
        .map((l) => `\n        <a href="${l.href}"${ext(l)}>${esc(l.label)}${l.external ? " ↗" : ""}</a>`)
        .join("")}
        <a class="btn btn-small" href="${site.navCta.href}">${esc(site.navCta.label)}</a>
      </nav>
    </div>
  </header>`;

  const footer = `
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-cols">
        <div class="footer-brand">
          <a class="brand" href="/"><img src="/favicon.svg" alt="" width="24" height="24"><span>${esc(site.name)}</span></a>
          <p>${esc(site.tagline)}</p>
        </div>${site.footer
          .map((col) => {
            const links = col.tools ? toolsIn(col.tools).map((t) => ({ label: t.title, href: toolHref(t) })) : col.links;
            return `
        <nav aria-label="${esc(col.title)}">
          <h4>${esc(col.title)}</h4>${links.map((l) => `\n          <a href="${l.href}"${ext(l)}>${esc(l.label)}</a>`).join("")}
        </nav>`;
          })
          .join("")}
      </div>
      <p class="footer-note">© ${new Date().getFullYear()} ${esc(site.name)}. General information, not legal or tax advice. Figures are for ${site.facts.year}; always confirm with the responsible authority.</p>
    </div>
  </footer>`;

  // A tool page gets its title, intro, related tools and disclaimer from site.json.
  const toolPage = (page, tool) => `
    <section class="tool-head">
      <div class="wrap">
        <p class="crumbs"><a href="/">Home</a> / <a href="/#tools">Tools</a> / ${esc(tool.title)}</p>
        <h1><span aria-hidden="true">${tool.icon}</span> ${esc(tool.title)}</h1>
        <p class="lead">${esc(page.lead ?? tool.short)}</p>
      </div>
    </section>
    <div class="wrap tool-body">
${page.body}
      <p class="disclaimer">This tool gives an estimate based on ${site.facts.year} rules and what you enter. It runs in your browser: nothing you type is sent to us. It is not legal or tax advice. Confirm your case with the responsible German authority or mission.</p>
      <h2 class="more-title">More tools</h2>
      <div class="cards">${site.tools
        .filter((t) => t.slug !== tool.slug)
        .sort((a, b) => (a.group === tool.group ? -1 : 0) - (b.group === tool.group ? -1 : 0))
        .slice(0, 3)
        .map(toolCard)
        .join("")}
      </div>
    </div>`;

  // A guide gets its heading, date, a call to action and the disclaimer around its text.
  const guidePage = (page) => {
    const tool = page.relatedTool && site.tools.find((t) => t.slug === page.relatedTool);
    if (page.relatedTool && !tool) throw new Error(`${page.file}: no tool "${page.relatedTool}" in site.json`);
    return `
    <article class="wrap guide">
      <p class="crumbs"><a href="/">Home</a> / <a href="/guides">Guides</a> / ${esc(page.title)}</p>
      <h1>${esc(page.title)}</h1>
      <p class="muted">Updated ${niceDate(page.date)} · Figures for ${site.facts.year}</p>
${page.body}
      <aside class="guide-cta">${
        tool
          ? `
        <div>
          <h2>${tool.icon} ${esc(tool.title)}</h2>
          <p>${esc(tool.short)}</p>
        </div>
        <a class="btn btn-light" href="${toolHref(tool)}">Open the tool</a>`
          : `
        <div>
          <h2>Free tools for your move</h2>
          <p>${esc(site.tagline)}</p>
        </div>
        <a class="btn btn-light" href="/#tools">Browse the tools</a>`
      }
      </aside>
      <aside class="guide-lead">
        <div>
          <h2>Want someone to look at your case?</h2>
          <p>Tell us about your education, work and goal. We reply with the route that fits you and your first steps. Free, no obligation.</p>
        </div>
        <a class="btn" href="/free-evaluation?source=guide-${encodeURIComponent(page.path.split("/").pop())}">Get a free evaluation</a>
      </aside>
      <p class="disclaimer">General information, not legal advice. Rules change: confirm your case with the responsible German authority or mission. Questions? Write to <a href="mailto:${site.email}">${site.email}</a>.</p>
    </article>`;
  };

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(join(root, "public"), out, { recursive: true });
  await mkdir(join(out, "js"), { recursive: true });
  const config = { email: site.email, leadEndpoint: cmsUrl ? `${cmsUrl}/items/leads` : "", filesEndpoint: cmsUrl ? `${cmsUrl}/files` : "", uploadFolder: site.cms?.uploadFolder ?? "" };
  await writeFile(join(out, "js/facts.js"), `window.ZB_FACTS = ${JSON.stringify(site.facts)};\nwindow.ZB_SITE = ${JSON.stringify(config)};\n`);

  // Changes on every build, so browsers fetch new CSS and JS after a deploy instead of using their cached copy.
  const version = Date.now().toString(36);
  const urls = [];
  for (const page of pages) {
    const file = page.file;
    const tool = page.tool && site.tools.find((t) => t.slug === page.tool);
    if (page.tool && !tool) throw new Error(`${file}: no tool "${page.tool}" in site.json`);
    const path = tool ? toolHref(tool) : page.path;
    const title = page.guide ? `${page.title} | ${site.name}` : page.title ?? `${tool.title} (${site.facts.year}) | ${site.name}`;
    const description = page.description ?? tool.short;
    const canonical = site.url + path;
    const scripts = ["/js/facts.js", "/js/zb.js", ...(page.scripts ?? [])];

    // Text typed in the CMS is inserted as it is; {{...}} placeholders only work in the files.
    const main = tool ? toolPage(page, tool) : page.guide ? guidePage(page) : page.body;
    const html = `<!doctype html>
<html lang="${page.lang ?? "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">${page.noindex ? '\n  <meta name="robots" content="noindex">' : ""}
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${site.url}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="/styles.css?v=${version}">
</head>
<body>${header}
  <main>${page.fromCms ? main : fill(main)}
  </main>${footer}
${scripts.map((s) => `  <script src="${s}?v=${version}" defer></script>`).join("\n")}
</body>
</html>
`;
    const target = join(out, path === "/" ? "index.html" : path.endsWith(".html") ? path : `${path}.html`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html);
    if (!page.noindex) urls.push(canonical);
  }

  await writeFile(
    join(out, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .sort()
      .map((u) => `  <url><loc>${u}</loc></url>`)
      .join("\n")}\n</urlset>\n`
  );
  await writeFile(join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
  return urls.length;
}

// Reads published content from Directus. Returns null (and the build uses the files) if it cannot be reached.
async function loadCms(url) {
  const get = async (path) => {
    const res = await fetch(url + path, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return (await res.json()).data;
  };
  const published = "filter[status][_eq]=published&limit=-1";
  try {
    const [site, guides, pages] = await Promise.all([get("/items/site"), get(`/items/guides?${published}&sort=-date_published`), get(`/items/pages?${published}`)]);
    console.log(`CMS: ${guides.length} guides, ${pages.length} pages from ${url}`);
    return { site, guides, pages };
  } catch (e) {
    console.warn(`CMS not used (${e.message}). Building from files only.`);
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = await build();
  console.log(`Built dist/ (${n} indexable pages)`);
}
