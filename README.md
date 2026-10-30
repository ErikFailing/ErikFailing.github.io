# erikfailing.com

Source for [erikfailing.com](https://erikfailing.com), the personal site of Erik Failing, software
and security engineer. Built with [Hugo](https://gohugo.io/) and the
[PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme, deployed to GitHub Pages by
GitHub Actions on every push to `main`.

## Run it locally

Requires Git and Hugo 0.169.0 or newer.

```bash
git clone --recurse-submodules https://github.com/ErikFailing/ErikFailing.github.io.git
cd ErikFailing.github.io
hugo server -D        # http://localhost:1313, including drafts
```

## Layout

| Path | What it holds |
|---|---|
| `content/` | Pages and posts, in Markdown |
| `hugo.toml` | Site and theme settings |
| `assets/css/extended/` | Custom CSS, added after the theme's styles |
| `layouts/` | Template overrides for the theme |
| `static/` | Files published as-is (fonts, `.well-known/security.txt`) |
| `themes/PaperMod/` | The theme, as a Git submodule |

## More docs

- [STYLE.md](STYLE.md): colors, typography and component rules.
- [THEME.md](THEME.md): why PaperMod, how it's installed, and how to update it.
- [DEPLOY.md](DEPLOY.md): how the GitHub Actions build and deploy works.
- [SECURITY.md](SECURITY.md): how to report a security issue.
