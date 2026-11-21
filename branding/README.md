# Zindabhaag branding

**Idea:** Zindabhaag means "run alive". The mark is a runner in full stride, leaving a gold line
(home) behind. The gold head doubles as a rising sun: a new start abroad.

## Ready to use

| File | Use |
|---|---|
| `instagram-profile-1080.png` | Instagram, Facebook, YouTube and TikTok profile picture. Square with no rounded corners; the runner stays inside the circle crop. |
| `facebook-cover-1640x624.png` | Facebook page cover. Text sits in the middle so phones do not cut it off. |
| `og-image-1200x630.png` | Preview image when a zindabhaag.com link is shared (already used by the website). |
| `logo-mark.svg`, `logo-mark-512.png`, `logo-mark-1024.png` | App-style icon: runner on green, rounded corners. This is also the website favicon. |
| `logo-mark-light.svg` | Same icon on cream, for green or dark backgrounds. |
| `logo-runner.svg` | Runner only, no background. |
| `logo-horizontal.png`, `logo-horizontal-dark.png` | Icon plus the name, for headers, documents and video end cards. |
| `apple-touch-icon-180.png` | Home-screen icon for phones (used by the website). |

## Colours

| Name | Hex | Use |
|---|---|---|
| Green | `#1f6b46` | Main brand colour, backgrounds, buttons |
| Dark green | `#154d32` | Gradients, hover |
| Gold | `#e0a526` | Accent: the runner's head, highlights. Use sparingly. |
| Cream | `#fbfaf6` | Light background, the runner on green |
| Ink | `#1d2a22` | Text on light backgrounds |

Typeface: Segoe UI / the system font, extra bold for the name.

## Rules of thumb

- Keep clear space around the mark of at least the size of the runner's head.
- The runner always runs to the right (forward).
- Do not recolour the runner outside this palette, stretch it, or put it on busy photos without the green or cream square.

## Changing something

Sources are the `.svg` files here and the files in `src/`. After editing, run:

```bash
node branding/render.mjs
```

It re-creates every PNG and copies the favicon, link preview image and home-screen icon into `public/` for the website. Needs Google Chrome.
