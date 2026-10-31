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
2026-10-29), with these changes:

- `TZ: America/Chicago`, the build time zone, which affects dates Hugo prints.
- `include-hidden-files: true` on the upload step, so `/.well-known/security.txt` is published.
  Without it, the upload skips every file or folder whose name starts with a dot.
- **Removed the Go, Node.js and Dart Sass steps** (2026-10-30). The site uses none of them. Go
  and Node were skipped at runtime anyway, but Dart Sass downloaded an unverified binary onto the
  build's PATH on every run, which was attack surface for nothing.
- **Pull requests only build** (2026-10-31). The `pull_request` trigger runs the build job as a
  check, including on Dependabot's pull requests, and the deploy job is skipped
  (`if: github.event_name != 'pull_request'`). Concurrency is per branch, so deploys from `main`
  still queue one after another, while a newer push to a pull request cancels its older check.
- **Hugo's download is checked against a pinned SHA-256** (`HUGO_SHA256`), taken from the
  release's `hugo_<version>_checksums.txt`. If the tarball doesn't match, `sha256sum --check`
  fails the build before Hugo is unpacked. The hash lives in the workflow, not fetched at build
  time, so a tampered release can't supply a matching checksum file.

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
- **Full history (`fetch-depth: 0`).** Hugo reads each page's last-modified date from Git
  (`enableGitInfo = true` in `hugo.toml`), which needs the full history. A shallow clone would
  give every page the date of the latest commit.
- **`baseURL`.** The build passes `--baseURL` from GitHub's own Pages setting, so the site works
  at `https://erikfailing.github.io/` now and switches to `https://erikfailing.com/` once the
  custom domain is set, with no workflow change.
- **Image cache.** `hugo.toml` sets `[caches.images] dir = ':cacheDir/images'` (step 3 of Hugo's
  guide), so processed images are kept in the cache the workflow saves and restores between runs,
  making later builds faster.
- **Permissions, per job.** The workflow grants nothing by default (`permissions: {}`). The build
  job, which runs Hugo and the theme's code, can only read the repo and the Pages settings
  (`contents: read`, `pages: read`). Only the deploy job, which runs GitHub's own deploy action,
  can publish (`pages: write`, `id-token: write`). Neither can push commits. Checkout uses
  `persist-credentials: false`, so the job's token isn't left on disk for later steps.
- **Dependabot** ([`.github/dependabot.yml`](.github/dependabot.yml)) checks monthly for new
  major versions of the actions (one grouped pull request) and for PaperMod updates. Nothing
  changes until a pull request is merged. Before merging a PaperMod update, review its changes and
  diff its `footer.html` against the override (see "Security headers" below). Actions use
  major-version tags rather than commit SHAs on purpose: they're all GitHub's own, and SHA pins
  would mean an update pull request for every minor release.
- **Branch ruleset.** `main` blocks force pushes and deletion (Settings > Rules > Rulesets). Normal
  pushes are unaffected.
- **Concurrency.** `group: pages` with `cancel-in-progress: false` means two quick pushes deploy
  one after the other instead of interrupting each other.

## security.txt

[`static/.well-known/security.txt`](static/.well-known/security.txt) follows
[RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) and points security reports to this repo's
private vulnerability reporting. Its `Expires` date must stay in the future (and under a year
away), so **update it every year**; the current one expires 2027-10-29.

[`.github/workflows/security-txt.yml`](.github/workflows/security-txt.yml) is the reminder: on
the 1st of every month (and whenever the file changes) it fails if `Expires` is less than 60 days
away or more than a year out, and GitHub emails the repo owner about the failed run. GitHub pauses
scheduled workflows after 60 days without any commits to the repo; re-enable it from the Actions
tab if that happens.

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
has real value. Community reports say GitHub Support will enable it on request. A ticket from the
free account was closed without review in October 2026, since free plans only get self-service
support, so the account was upgraded to Pro and the ticket reopened; it's pending as of
2026-10-31. Getting the other headers would mean a proxy (e.g. Cloudflare's free plan) or a
different host, which wasn't worth the rework or risk for this site.

**Keeping it working:**

- After updating PaperMod, diff `themes/PaperMod/layouts/_partials/footer.html` against the
  override and `site.js`, and `themes/PaperMod/layouts/single.html`, `list.html`, `404.html`,
  `_partials/post_meta.html`, `_partials/index_profile.html`,
  `_partials/templates/schema_json.html` and `_partials/templates/_funcs/get-page-images.html`
  against the overrides in `layouts/` (numbered headings, tags, post numbers, series order, 404
  page, blog tabs, home page tagline and photo, structured data, social cards), and copy over any
  changes. `layouts/series/taxonomy.html` and `layouts/tags/taxonomy.html` replace the theme's
  `taxonomy.html` for the Series and Tags pages; check them if the theme's changes. `layouts/_partials/_funcs/get-page-images.html` overrides a template built into Hugo
  itself (PaperMod's `opengraph.html` calls it); it only forwards to the PaperMod override, so it
  needs no diffing.
- Adding anything from another domain (analytics, embeds, a CDN font) needs a CSP change, and
  inline `<script>`/`style=""` will be blocked. Check the browser console for "Refused to..."
  errors after changes.
- Scan with [Mozilla HTTP Observatory](https://developer.mozilla.org/en-US/observatory). The
  expected score is 55 (C), the ceiling for meta tags on GitHub Pages (scanned 2026-10-30).

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
   copy over any changes, keeping the changes listed under "Where the workflow came from" (don't
   re-add the Go, Node or Dart Sass steps unless the site starts using them).
2. To bump only Hugo, change `HUGO_VERSION` **and** `HUGO_SHA256` (the `linux-amd64.tar.gz` line
   from `hugo_<version>_checksums.txt` on the release page), and install the same version locally, so previews
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
