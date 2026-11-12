// Re-creates the PNG files in this folder from the sources. Usage: node render.mjs
// Needs Google Chrome. Edit the SVG / HTML sources, then run this again.
import { execFileSync } from "node:child_process";
import { mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const chrome = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "zb-brand-"));

// Chrome cannot open a window narrower than 500px, so small images are drawn at 500px and scaled.
function shot(out, source, width, height, hash = "") {
  const base = Math.max(width, 500), scale = width / base;
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--user-data-dir=${profile}`,
    `--window-size=${base},${Math.round(height / scale)}`, `--force-device-scale-factor=${scale}`,
    "--default-background-color=00000000", "--virtual-time-budget=2000",
    `--screenshot=${join(here, out)}`, pathToFileURL(join(here, source)).href + hash,
  ], { stdio: "ignore" });
  console.log(out);
}
const square = (out, svg, size) => shot(out, "src/square.html", size, size, "#" + (svg.startsWith("src/") ? svg.slice(4) : "../" + svg));

square("instagram-profile-1080.png", "src/profile.svg", 1080);
square("logo-mark-1024.png", "logo-mark.svg", 1024);
square("logo-mark-512.png", "logo-mark.svg", 512);
square("apple-touch-icon-180.png", "src/profile.svg", 180);
shot("facebook-cover-1640x624.png", "src/facebook-cover.html", 1640, 624);
shot("og-image-1200x630.png", "src/og-image.html", 1200, 630);
shot("logo-horizontal.png", "src/logo-horizontal.html", 1000, 260);
shot("logo-horizontal-dark.png", "src/logo-horizontal-dark.html", 1000, 260);

// The website uses these two.
copyFileSync(join(here, "logo-mark.svg"), join(here, "../public/favicon.svg"));
copyFileSync(join(here, "og-image-1200x630.png"), join(here, "../public/og-image.png"));
copyFileSync(join(here, "apple-touch-icon-180.png"), join(here, "../public/apple-touch-icon.png"));
console.log("Copied favicon.svg, og-image.png and apple-touch-icon.png into public/");
