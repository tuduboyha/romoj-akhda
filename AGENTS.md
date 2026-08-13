# Romoj Akhra

Plain HTML/CSS/JS site — no build step, no framework, no bundler. Edit files in `site/` and refresh the browser; nothing needs to be compiled.

## Structure

- `site/index.html` — the whole page
- `site/css/style.css` — all styles (custom properties for the charcoal/rice/ochre palette, media queries at 640px/768px mirroring the old Tailwind sm/md breakpoints)
- `site/js/app.js` — clock, category tabs + By Year dropdown, and the YouTube IFrame Player API integration (custom audio-only UI, playlist shuffle, retry-with-random-index on embedding-restricted videos)
- `site/admin.html` + `site/js/admin.js` + `site/css/admin.css` — password-gated bulk audio upload page (see below). Not linked from the public UI.
- `functions/` — Cloudflare Pages Functions (serverless), at the **repo root**, sibling to `site/` — NOT inside it. `wrangler pages dev`/`deploy` only detect Functions there; putting them under `site/functions` silently no-ops ("No Functions. Shimming...").

## Local preview

Static-only (no Functions/R2, fine for everything except `admin.html`):

```bash
npx http-server site -p 5500 -c-1
```

Full preview including the upload Functions + local R2 emulation:

```bash
npx wrangler pages dev --port 8788 --r2 AUDIO_BUCKET=romoj-akhra-audio
```

(no positional directory — it reads `pages_build_output_dir` from `wrangler.toml`; passing `site` explicitly breaks Functions detection the same way putting them in the wrong folder does). Needs a `.dev.vars` file with `ADMIN_UPLOAD_KEY=<password>` (gitignored, not committed). Both a `romoj-akhra-static` and a `romoj-akhra-functions` entry already exist in `.claude/launch.json`.

## Deployment

Two targets, both served from `site/` directly with no build step:

- **GitHub Pages** — `.github/workflows/deploy.yml` uploads `site/` on every push to `main`. Static-only — Pages Functions don't run here, so `admin.html`'s upload feature only works on the Cloudflare deployment.
- **Cloudflare Pages** (custom domain `romojakhra.com`) — deploy manually with `npx wrangler pages deploy --project-name=romoj-akhra --branch=main` (no positional directory, same reasoning as local dev above — `wrangler.toml` supplies both the output dir and the R2 binding).

All asset paths in `index.html` are relative (`css/…`, `js/…`, `images/…`), so the same files work under any subpath without a basePath/prefix step — unlike the previous Next.js version, which needed `NEXT_PUBLIC_BASE_PATH` wired through every component.

## Bulk audio upload

`site/admin.html` is a password-gated page (checks the `ADMIN_UPLOAD_KEY` secret, entered once and cached in `sessionStorage`) for uploading MP3/WAV/M4A/OGG/FLAC files in bulk to a Cloudflare R2 bucket (`romoj-akhra-audio`). Backend is three Pages Functions:

- `functions/api/upload.js` — `POST`, multipart form (`files` field, repeatable), validates the `X-Admin-Key` header against `env.ADMIN_UPLOAD_KEY` and the MIME type/size (100MB cap) of each file, then writes to `env.AUDIO_BUCKET`.
- `functions/api/tracks.js` — `GET`, lists bucket contents (`list({ include: ["customMetadata"] })` — the `customMetadata.originalName` is invisible without that `include`).
- `functions/api/audio/[key].js` — `GET`, streams a single object back out, with `Range` request support for audio scrubbing.

These uploaded files aren't wired into the main player's category tabs yet — that's a separate follow-up if/when needed.
