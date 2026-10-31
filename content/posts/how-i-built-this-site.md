+++
title = 'How I Built This Site'
date = 2026-10-30
draft = false
description = 'Hugo, PaperMod, GitHub Actions and a custom domain, with an LLM helping along the way.'
tags = ['hugo', 'github-actions', 'web', 'ai']
+++

This site is a static [Hugo](=hugo) site using the PaperMod theme, built and deployed by [GitHub Actions](=flow) to
GitHub Pages, with my Squarespace domain pointed at it. Below is how the pieces fit together, the
design decisions I made along the way, and how I used an LLM to help (and where I had to catch its
mistakes).

## The Setup In One Picture

The whole thing is pretty simple once you see the flow:

1) I write Markdown and push to `main`.
2) A GitHub Actions workflow installs Hugo, builds the site, and uploads the result.
3) GitHub Pages serves it, and my domain points at GitHub Pages.

There's no server for me to patch, no database, and no hosting bill. For a personal site I think
that's the right amount of infrastructure: [the attack surface is basically a folder of HTML files](=point).

## Why Hugo, And Why PaperMod

I went with Hugo because it's a [single binary](=iron), it builds fast (this site currently builds in under
100 ms locally), and the output is plain static files. No Node toolchain to keep updated, which I
was honestly happy to skip.

For the theme, the first plan an LLM helped me brainstorm was actually [Blowfish](=flood). It looks great,
but when I compared them, PaperMod won for a couple of practical reasons:

- **Readability.** PaperMod's article page is 18px text in a single ~720px column, with a lot less
  visual chrome. People who read writeups are the main audience, so [the article page is what has
  to be good](=point).
- **Build compatibility.** Blowfish needs Hugo's extended edition and capped its supported version
  below what the official GitHub Pages workflow installs. PaperMod just works with standard Hugo.

The theme is pulled in as a [Git submodule](=git), so the repo only stores a pointer to one specific
commit of PaperMod instead of a copy of its files:

```bash
git submodule add --depth=1 https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
```

Updating it is a deliberate step (`git submodule update --remote`, check locally, commit), so a
theme change [never lands on the live site by surprise](=ward). I also never edit the theme's files. Every
customization lives in my own `layouts/` and `assets/` folders, which Hugo uses in place of the
theme's versions.

## Build And Deploy With GitHub Actions

The workflow is [Hugo's official GitHub Pages workflow](=flow), with two small changes. I pulled it from
Hugo's docs repo directly and diffed my copy against it, so I know exactly what's different:

```yaml
env:
  HUGO_VERSION: 0.169.0
  TZ: America/Chicago             # change 1: my time zone, for dates Hugo prints
# ...
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v5
        with:
          include-hidden-files: true   # change 2: publish /.well-known/security.txt
          path: ./public
```

The second one was a fun one to find. The upload step [skips anything starting with a dot](=glitch) by
default, which is a sensible default, but it means `/.well-known/` never gets published. More on
why I wanted that folder below.

A few things I like about this setup:

- The [build job](=flow) only gets `contents: read`, `pages: write` and `id-token: write`. It can't push
  to the repo.
- [If the build fails, nothing deploys, so the live site stays on the last good version](=point).
- The base URL comes from the repo's Pages settings at build time, so the same workflow worked at
  `erikfailing.github.io` first and then at `erikfailing.com` [with zero changes](=trophy).

## Pointing The Domain At It

My domain is registered through [Squarespace](=iron), so this was mostly clicking through their DNS panel
in the right order:

1) **[Verify the domain with GitHub first.](=point)** GitHub gives you a TXT record
   (`_github-pages-challenge-<username>`), and once it's verified, only my account can publish a
   Pages site on that domain. This prevents [domain takeover](=crimson) if the repo ever gets deleted or Pages
   gets turned off while DNS still points at GitHub.
2) **Delete Squarespace's default records** (their parking page A records and `www` CNAME).
3) **Add GitHub's records:** four `A` records and four `AAAA` records for the apex, plus a `CNAME`
   for `www` pointing to `erikfailing.github.io`.
4) **Set the custom domain in the repo and turn on [Enforce HTTPS](=ward)** once GitHub finished issuing the
   certificate.

No [wildcard records](=crimson), since a wildcard is an easy way to end up with a subdomain someone else can
claim.

## A Few Security-Flavored Touches

It's a personal site, so I didn't go overboard, but there were a few things I wanted as a
security engineer:

- **`security.txt`.** There's an RFC 9116 file at `/.well-known/security.txt` that points to the
  repo's [private vulnerability reporting](=ward), plus a short `SECURITY.md` policy. It has an `Expires`
  field, so it's a once-a-year chore to bump the date.
- **No third-party requests for fonts.** I self-host the font instead of loading it from Google
  Fonts, so loading a page [doesn't send visitors' IPs anywhere else](=ward).
- **`robots.txt` that blocks [AI training but not AI search](=arcane).** It turns out the big AI companies
  use separate crawler names for training and for search (e.g. `GPTBot` vs `OAI-SearchBot`,
  `ClaudeBot` vs `Claude-SearchBot`). So I asked the training crawlers to stay out while still
  letting search engines and AI search assistants read and cite the site:

```text
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Meta-ExternalAgent
User-agent: CCBot
User-agent: Bytespider
Disallow: /
```

(robots.txt is a request, not access control, but the reputable crawlers do honor it.)

## A Font Flicker I Had To Fix

[Open Sans](=clarity) is my favorite font, so the whole site uses it, self-hosted as one variable font file.
The first version had an annoying bug though: clicking between pages, the text would visibly
shift. It turned out to be a [font swap on every page load](=static). The browser only discovered the font
after parsing the CSS, and `font-display: swap` told it to draw the text in the system font first
(Segoe UI on Windows) and then redraw it in Open Sans. The two fonts have different widths, so
everything jumped. [The fix was preloading the font](=point):

```html
<link rel="preload" href="/fonts/open-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
```

plus switching to `font-display: block`, so the browser waits the few milliseconds for the
preloaded font instead of painting a stand-in.

The colors got a similar amount of care: every text color passes [WCAG AAA contrast](=clarity) against the
background, and links stay underlined since my link blue is too close in brightness to the body
text for color alone to mark them.

## How I Used AI On This

I used [Claude Code](=claude) (an LLM coding assistant) a lot on this project, and I think it was genuinely
useful, but [as an assistant, not as the one in charge](=point). It drafted config, looked up docs, ran test
builds, and did research I'd otherwise do by hand (like verifying every crawler name against each
company's docs, or computing contrast ratios for a pile of candidate colors). I still made the
decisions and read every change before it went in.

And reading everything mattered. A few examples:

- On the very first step, the submodule command it wrote had the wrong GitHub username for
  PaperMod's author. That would have pulled a theme from a repo that wasn't the real one, which is
  a [supply-chain mistake in a single typo](=iron). It got blocked before running, and the correct URL went
  in instead, but it's exactly the kind of thing you only catch by actually reading the command.
- The font flicker above was something I noticed clicking around the site myself. The first font
  setup it gave me "worked," it just wasn't right.
- When I uploaded my resume to draft the resume page, I had to make sure work-specific details
  stayed off the public site. It was good at flagging candidates, but [deciding what's okay to
  publish is my call, not a model's](=ward).

So overall, I think the right mental model is a fast, well-read assistant that can [make mistakes
with total confidence](=glitch). It saved me a lot of time on the tedious parts (looking up DNS records,
reading theme source to find the right CSS selectors, etc...), and it left me more time for the
parts I actually care about. But anything it hands me still gets read before it ships.

## What's Next

No big roadmap. I'll update the site as I feel like it, mostly with [security projects](=crimson) and
writeups, plus some software dev stuff here and there.
