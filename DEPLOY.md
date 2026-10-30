# Deployment: GitHub Actions to GitHub Pages

Every push to `main` builds the site with Hugo and publishes it to GitHub Pages. Nothing is built
on your computer for deployment, and the built site (`public/`) is never committed.

## What runs, and when

The workflow lives in [`.github/workflows/hugo.yaml`](.github/workflows/hugo.yaml). It runs:

- on every push to `main`, and
- on demand from **Actions > Build and deploy > Run workflow** (`workflow_dispatch`).

It has two jobs:

1. **build**: checks out the repo *with the PaperMod submodule*, installs Hugo, runs
   `hugo build --gc --minify`, and uploads `./public` as a Pages artifact.
2. **deploy**: takes that artifact and publishes it to the `github-pages` environment.

If the build fails, nothing is deployed, so the live site stays on the last good version.

## Where the workflow came from

It is a copy of Hugo's official workflow from
[Deploy to GitHub Pages](https://gohugo.io/host-and-deploy/deploy-to-github-pages/) (checked
2026-10-29), with two changes:

- `TZ: America/Chicago`, the build time zone, which affects dates Hugo prints.
- `include-hidden-files: true` on the upload step, so `/.well-known/security.txt` is published.
  Without it, the upload skips every file or folder whose name starts with a dot.

Staying close to the official file makes future updates a simple compare-and-copy.

Before adding it we checked that:

- every action version it uses exists (`checkout@v7`, `configure-pages@v6`, `cache@v6`,
  `upload-pages-artifact@v5`, `deploy-pages@v5`, and the optional `setup-go@v7`/`setup-node@v7`);
- the Hugo 0.169.0 and Dart Sass 1.106.1 downloads resolve;
- PaperMod supports this Hugo version (its `theme.toml` requires at least 0.158.0, no maximum);
- the site builds locally with Hugo 0.169.0.

## Notes on specific settings

- **Submodules.** `submodules: recursive` on checkout, plus the "Initialize Git submodules" step,
  pull in `themes/PaperMod` at the commit this repo pins. Without it the build has no theme.
- **Full history (`fetch-depth: 0`).** Lets Hugo read Git dates (for example, last-modified dates)
  if we turn that on later.
- **Go, Node.js, Dart Sass.** Go and Node install only if `go.mod` or `package-lock.json` exist,
  which they don't, so those steps skip. Dart Sass installs but PaperMod doesn't use it; it is
  left in to match the official file and costs a few seconds.
- **`baseURL`.** The build passes `--baseURL` from GitHub's own Pages setting, so the site works
  at `https://erikfailing.github.io/` now and switches to `https://erikfailing.com/` once the
  custom domain is set, with no workflow change.
- **Image cache.** `hugo.toml` sets `[caches.images] dir = ':cacheDir/images'` (step 3 of Hugo's
  guide), so processed images are kept in the cache the workflow saves and restores between runs,
  making later builds faster.
- **Permissions.** The workflow can only read the repo (`contents: read`) and publish to Pages
  (`pages: write`, `id-token: write`). It cannot push commits.
- **Concurrency.** `group: pages` with `cancel-in-progress: false` means two quick pushes deploy
  one after the other instead of interrupting each other.

## security.txt

[`static/.well-known/security.txt`](static/.well-known/security.txt) follows
[RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) and points security reports to this repo's
private vulnerability reporting. Its `Expires` date must stay in the future (and under a year
away), so **update it every year**; the current one expires 2027-10-29.

## Security headers

GitHub Pages can't send custom response headers, so the site carries what it can as meta tags in
[`layouts/_partials/extend_head.html`](layouts/_partials/extend_head.html):

- **Content-Security-Policy:** only the site's own origin may supply scripts, styles, fonts and
  images. No `'unsafe-inline'`, which works because:
  - PaperMod's inline scripts were moved to [`assets/js/site.js`](assets/js/site.js), loaded by a
    footer override ([`layouts/_partials/footer.html`](layouts/_partials/footer.html)) as one
    fingerprinted file with an `integrity` hash. Hashing inline scripts in the CSP instead would
    break silently whenever Hugo's minifier or a theme update changed them.
  - Code highlighting uses CSS classes (`noClasses = false` in `hugo.toml`) with colors in
    `assets/css/extended/zz-chroma.css`, instead of inline `style=""` attributes.
- **Referrer policy:** `strict-origin-when-cross-origin`.

Meta tags can't deliver HSTS, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors` or
`Permissions-Policy`. For a static site with no cookies, forms or third-party content, only HSTS
has real value; it was requested from GitHub Support (community reports say they'll enable it on
request). Getting the rest would mean a proxy or a different host, which wasn't worth it here.

**Keeping it working:**

- After updating PaperMod, diff `themes/PaperMod/layouts/_partials/footer.html` against the
  override and `site.js`, and copy over any changes.
- Adding anything from another domain (analytics, embeds, a CDN font) needs a CSP change, and
  inline `<script>`/`style=""` will be blocked. Check the browser console for "Refused to..."
  errors after changes.
- Scan with [Mozilla HTTP Observatory](https://developer.mozilla.org/en-US/observatory). The
  expected score is 55 (C), or 75 (B) once HSTS is enabled.

## One-time GitHub setting

In the repo, **Settings > Pages > Build and deployment > Source** must be **GitHub Actions**
(not "Deploy from a branch"). This is already set.

## Day-to-day use

```bash
hugo server -D        # preview locally at http://localhost:1313 (includes drafts)
git add .
git commit -m "Describe the change"
git push              # deploys about a minute later
```

Watch progress in the repo's **Actions** tab. A green check means the site is live; the deploy
step links to it. Pages with `draft = true` are never published.

## Updating Hugo or the actions later

1. Compare our workflow with the one on Hugo's
   [Deploy to GitHub Pages](https://gohugo.io/host-and-deploy/deploy-to-github-pages/) page and
   copy over any changes, keeping `TZ: America/Chicago` and `include-hidden-files: true`.
2. To bump only Hugo, change `HUGO_VERSION` and install the same version locally, so previews
   match the live build. Check the theme still supports it (`min_version` in
   `themes/PaperMod/theme.toml`).
3. Run `hugo server` locally, then push and confirm the Actions run turns green.

## If a run fails

- **Build job red:** open the failed step's log. Usually it's a content or config error that
  `hugo server` locally will also show.
- **Deploy job red with a Pages or environment error:** recheck that the Pages source is
  **GitHub Actions**.
- **Site loads without styling:** the theme submodule wasn't fetched, or `baseURL` is wrong.
  Check the "Initialize Git submodules" and "Build" step logs.
