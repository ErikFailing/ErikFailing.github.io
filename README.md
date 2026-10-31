# erikfailing.com

Source for [erikfailing.com](https://erikfailing.com), the personal site of Erik Failing, software
and security engineer, and the place I share write ups of projects and research I'm excited
about. Built with [Hugo](https://gohugo.io/) and the
[PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme, deployed to GitHub Pages by
GitHub Actions on every push to `main`.

## Run it locally

Requires Git and Hugo 0.169.0 or newer.

```bash
git clone --recurse-submodules https://github.com/ErikFailing/ErikFailing.github.io.git
cd ErikFailing.github.io
hugo server -D        # http://localhost:1313, including drafts
```

## Writing content

Three tones, depending on the page:

- **Posts and writeups** (blog posts, project writeups, CTF and Hack The Box writeups,
  vulnerability disclosures, anything technical and conversational): follow
  [VOICE.md](VOICE.md). It defines my writing voice, templates for each kind of writeup, and the
  security rules every post must pass (nothing from work, retired boxes only, disclosure complete,
  redactions done).
- **About** (`content/about.md`): in between. Mostly professional, with a light conversational
  touch; VOICE.md describes the toned-down rules.
- **Resume** (`content/resume.md`): strictly professional. VOICE.md does not apply.

When using an LLM to help draft, point it at `VOICE.md` (Claude Code and other coding agents pick
it up automatically through [AGENTS.md](AGENTS.md)). Drafts come from my own notes and work; the
LLM organizes and cleans up, it doesn't invent.

Start a new post with `hugo new content posts/my-post-title.md`; it begins as a draft, so set
`draft = false` when it's ready.

## Layout

| Path | What it holds |
|---|---|
| `content/` | Pages and posts, in Markdown |
| `hugo.toml` | Site and theme settings |
| `assets/css/extended/` | Custom CSS, added after the theme's styles |
| `assets/fonts/`, `assets/img/` | Build-time inputs for the generated social cards (see STYLE.md) |
| `layouts/` | Template overrides for the theme |
| `static/` | Files published as-is (fonts, `.well-known/security.txt`, the resume PDF) |
| `themes/PaperMod/` | The theme, as a Git submodule |

## More docs

- [VOICE.md](VOICE.md): writing voice and rules for posts and writeups.
- [STYLE.md](STYLE.md): colors, typography and component rules.
- [THEME.md](THEME.md): why PaperMod, how it's installed, and how to update it.
- [DEPLOY.md](DEPLOY.md): how the GitHub Actions build and deploy works.
- [SECURITY.md](SECURITY.md): how to report a security issue.
