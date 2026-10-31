+++
title = 'How I Built This Site'
date = 2026-10-30T17:45:00-05:00
draft = false
number = 1
description = 'Hugo, PaperMod, GitHub Actions and a custom domain, with an LLM helping along the way.'
series = ['Building This Site']
tags = ['Hugo', 'GitHub Actions', 'Web', 'AI']
+++

This site is a static {=hugo: Hugo=} site using the PaperMod theme, built and deployed by {=flow: GitHub Actions=} to
GitHub Pages, with my Squarespace domain pointed at it. Below is how the pieces fit together, the
design decisions I made along the way, and how I used an LLM to help (and where I had to catch its
mistakes).

## The Setup In One Picture

The whole thing is pretty simple once you see the flow:

1) I write Markdown and push to `main`.
2) A GitHub Actions workflow installs Hugo, builds the site, and uploads the result.
3) GitHub Pages serves it, and my domain points at GitHub Pages.

There's no server for me to patch, no database, and no hosting bill. For a personal site I think
that's the right amount of infrastructure: {=point: the attack surface is basically a folder of HTML files=}.

## Why Hugo, And Why PaperMod

I went with Hugo because it's a {=iron: single binary=}, it builds fast (this site currently builds in under
100 ms locally), and the output is plain static files. No Node toolchain to keep updated, which I
was honestly happy to skip.

For the theme, the first plan an LLM helped me brainstorm was actually {=flood: Blowfish=}. It looks great,
but when I compared them, PaperMod won for a couple of practical reasons:

- **Readability.** PaperMod's article page is 18px text in a single ~720px column, with a lot less
  visual chrome. People who read writeups are the main audience, so {=point: the article page is what has
  to be good=}.
- **Build compatibility.** Blowfish needs Hugo's extended edition and capped its supported version
  below what the official GitHub Pages workflow installs. PaperMod just works with standard Hugo.

The theme is pulled in as a {=git: Git submodule=}, so the repo only stores a pointer to one specific
commit of PaperMod instead of a copy of its files:

```bash
git submodule add --depth=1 https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
```

Updating it is a deliberate step (`git submodule update --remote`, check locally, commit), so a
theme change {=ward: never lands on the live site by surprise=}. I also never edit the theme's files. Every
customization lives in my own `layouts/` and `assets/` folders, which Hugo uses in place of the
theme's versions.

## Build And Deploy With GitHub Actions

The workflow is {=flow: Hugo's official GitHub Pages workflow=}, with two small changes. I pulled it from
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

The second one was a fun one to find. The upload step {=glitch: skips anything starting with a dot=} by
default, which is a sensible default, but it means `/.well-known/` never gets published. More on
why I wanted that folder below.

A few things I like about this setup:

- The {=flow: build job=} only gets `contents: read`, `pages: write` and `id-token: write`. It can't push
  to the repo.
- If the build fails, nothing deploys, so {=point: the live site stays on the last good version=}.
- The base URL comes from the repo's Pages settings at build time, so the same workflow worked at
  `erikfailing.github.io` first and then at `erikfailing.com` {=trophy: with zero changes=}.

## Pointing The Domain At It

My domain is registered through {=iron: Squarespace=}, so this was mostly clicking through their DNS panel
in the right order:

1) **{=point: Verify the domain with GitHub first.=}** GitHub gives you a TXT record
   (`_github-pages-challenge-<username>`), and once it's verified, only my account can publish a
   Pages site on that domain. This prevents {=crimson: domain takeover=} if the repo ever gets deleted or Pages
   gets turned off while DNS still points at GitHub.
2) **Delete Squarespace's default records** (their parking page A records and `www` CNAME).
3) **Add GitHub's records:** four `A` records and four `AAAA` records for the apex, plus a `CNAME`
   for `www` pointing to `erikfailing.github.io`.
4) **Set the custom domain in the repo and turn on {=ward: Enforce HTTPS=}** once GitHub finished issuing the
   certificate.

No {=crimson: wildcard records=}, since a wildcard is an easy way to end up with a subdomain someone else can
claim.

## A Few Security-Flavored Touches

It's a personal site, so I didn't go overboard, but there were a few things I wanted as a
security engineer:

- **`security.txt`.** There's an RFC 9116 file at `/.well-known/security.txt` that points to the
  repo's {=ward: private vulnerability reporting=}, plus a short `SECURITY.md` policy. It has an `Expires`
  field, so it's a once-a-year chore to bump the date.
- **No third-party requests for fonts.** I self-host the font instead of loading it from Google
  Fonts, so loading a page {=ward: doesn't send visitors' IPs anywhere else=}.
- **`robots.txt` that blocks {=arcane: AI training but not AI search=}.** It turns out the big AI companies
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

**Update (October 31, 2026):** I took these rules back out. They only stop crawlers polite enough
to ask, so they weren't keeping out anyone I'd actually worry about, and I'd rather AI assistants
know who I am when someone asks about me. The site also has an `llms.txt` now, a plain-text list
of its pages for AI tools.

## A Font Flicker I Had To Fix

{=clarity: Open Sans=} is my favorite font, so the whole site uses it, self-hosted as one variable font file.
The first version had an annoying bug though: clicking between pages, the text would visibly
shift. It turned out to be a {=static: font swap on every page load=}. The browser only discovered the font
after parsing the CSS, and `font-display: swap` told it to draw the text in the system font first
(Segoe UI on Windows) and then redraw it in Open Sans. The two fonts have different widths, so
everything jumped. {=point: The fix was preloading the font=}:

```html
<link rel="preload" href="/fonts/open-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
```

plus switching to `font-display: block`, so the browser waits the few milliseconds for the
preloaded font instead of painting a stand-in.

The colors got a similar amount of care: every text color passes {=clarity: WCAG AAA contrast=} against the
background, and links stay underlined since my link blue is too close in brightness to the body
text for color alone to mark them.

## How I Used AI On This

I used {=claude: Claude Code=} (an LLM coding assistant) a lot on this project, and I think it was genuinely
useful, but {=point: as an assistant, not as the one in charge=}. It drafted config, looked up docs, ran test
builds, and did research I'd otherwise do by hand (like verifying every crawler name against each
company's docs). I still made the decisions and read every change before it went in.

And reading everything mattered. A few examples:

- On the very first step, the submodule command it wrote had the wrong GitHub username for
  PaperMod's author. That would have pulled a theme from a repo that wasn't the real one, which is
  a {=iron: supply-chain mistake in a single typo=}. It got blocked before running, and the correct URL went
  in instead, but it's exactly the kind of thing you only catch by actually reading the command.
- The font flicker above was something I noticed clicking around the site myself. The first font
  setup it gave me "worked," it just wasn't right.

So overall, {=point: I think it saved me a lot of time on the tedious parts=} (looking up DNS records,
reading theme source to find the right CSS selectors, etc...), and it left me more time for the
parts I actually care about. But anything it hands me still gets read before it ships.

## What's Next

No big roadmap. I'll update the site as I feel like it, mostly with {=crimson: security projects=} and
writeups, plus some software dev stuff here and there.
