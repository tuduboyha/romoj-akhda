# Romoj Akhra

Plain HTML/CSS/JS site — no build step, no framework, no bundler. Edit files in `site/` and refresh the browser; nothing needs to be compiled.

## Structure

- `site/index.html` — the whole page
- `site/css/style.css` — all styles (custom properties for the charcoal/rice/ochre palette, media queries at 640px/768px mirroring the old Tailwind sm/md breakpoints)
- `site/js/app.js` — clock, category tabs + By Year dropdown, and the YouTube IFrame Player API integration (custom audio-only UI, playlist shuffle, retry-with-random-index on embedding-restricted videos)

## Local preview

```bash
npx http-server site -p 5500 -c-1
```

(`-c-1` disables caching so edits show up on refresh.) A matching `romoj-akhra-static` entry already exists in `.claude/launch.json`.

## Deployment

Two targets, both served from `site/` directly with no build step:

- **GitHub Pages** — `.github/workflows/deploy.yml` uploads `site/` on every push to `main`.
- **Cloudflare Pages** (custom domain `romojakhra.com`) — deploy manually with `npx wrangler pages deploy site --project-name=romoj-akhra --branch=main`.

All asset paths in `index.html` are relative (`css/…`, `js/…`, `images/…`), so the same files work under any subpath without a basePath/prefix step — unlike the previous Next.js version, which needed `NEXT_PUBLIC_BASE_PATH` wired through every component.
