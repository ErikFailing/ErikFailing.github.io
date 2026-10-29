# Theme: PaperMod

This site uses the [PaperMod](https://github.com/adityatelange/hugo-PaperMod) Hugo theme.

## Why PaperMod

We considered [Blowfish](https://github.com/nunocoracao/blowfish) first and chose PaperMod instead:

- **Easier to read.** The article page is what hiring managers actually read. PaperMod's default
  is larger and plainer: 18px body text in a single 720px column, with much less visual chrome
  than Blowfish (16px text).
- **Lightweight.** About 5.5 KB of gzipped CSS, compared with about 22.6 KB for Blowfish.
- **Works with our build.** PaperMod runs on standard Hugo, so it works with the Hugo 0.169.0
  GitHub Actions workflow as-is. Blowfish needs the extended edition of Hugo and only supports
  versions up to 0.167.0.

Any custom look (such as a darker palette or accent colors) goes in our own files, never in the
theme's files.

## How it was installed

PaperMod is a [Git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules), which means
this repo stores a pointer to one specific commit of the theme's own repo rather than a copy of
its files. It was added with:

```bash
git submodule add --depth=1 https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
```

This created:

- `.gitmodules`, which records the theme's path and repo URL.
- `themes/PaperMod`, which Git tracks as a pointer to a single commit.

Then `hugo.toml` was told to use it:

```toml
theme = 'PaperMod'
```

`--depth=1` downloads only the latest commit of the theme instead of its full history, which is
what PaperMod's install guide recommends.

## Cloning this repo

A plain `git clone` leaves `themes/PaperMod` empty. Either clone with submodules:

```bash
git clone --recurse-submodules https://github.com/ErikFailing/ErikFailing.github.io.git
```

or, in an existing clone:

```bash
git submodule update --init --recursive
```

The GitHub Actions build already does this.

## Updating the theme

The theme only changes when we choose to update it:

```bash
git submodule update --remote --merge themes/PaperMod
hugo server -D            # check the site locally at http://localhost:1313
git add themes/PaperMod
git commit -m "Update PaperMod theme"
git push
```

Never edit files inside `themes/PaperMod` directly; the next update would overwrite them. To
override a template or add CSS, copy or create the file at the same path in this repo's own
`layouts/` or `assets/` folder. Hugo uses the site's file instead of the theme's.
