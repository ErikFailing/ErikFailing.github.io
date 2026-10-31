+++
title = 'Building the Color Accents on This Site'
date = 2026-10-31
draft = false
description = 'Three versions of a text-coloring system, from automatic keyword matching to hand-placed accents, and what each one taught me.'
tags = ['Hugo', 'Design', 'Web']
+++

The colored words on this site went through three versions before they actually did their job.
I started with a {=static: fully automatic keyword matcher=}, then made it per-page, and ended up
deleting most of it for something way simpler. This is the builder's side of that, including the
parts that didn't work.

## The Goal

I play a lot of ASCII and text-based games, and one of my favorite details in {=qud: Caves of Qud=} is
how it colors certain words: an item name in a gradient, a faction in its own color. It makes a
wall of text easy to scan. I wanted the same thing here, with a few constraints:

- **Professional, not zany.** It's a site people look at when deciding whether to hire me.
- **Readable for everyone.** Every color has to pass {=clarity: WCAG AAA contrast=} on the dark background,
  and screen readers have to read the words normally.
- **No inline styles.** The site has a strict {=ward: Content-Security-Policy=} (`style-src 'self'`), so
  every color has to come from a class in a stylesheet.

## Version 1: Automatic Keyword Matching

The first design was a keyword table in a data file, applied automatically at build time. Add
"fuzzing" to the table, and every page that mentions fuzzing gets it colored. That's
{=trophy: retroactive and zero effort per post=}, which sounded great.

The hard part was that Hugo only gives you the rendered HTML, and I had to color text without ever
touching markup. A keyword inside a link, a code block, a heading or an `href` attribute must stay
alone. Go's regex engine has {=glitch: no lookbehind=}, so you can't just write "match this word unless
it's inside `<code>`." I ended up splitting each page into tokens (tags vs. plain text), tracking
which protected element I was inside, and only running replacements on plain text:

```go-html-template
{{- range findRE `<!--[\s\S]*?-->|<[^>]*>|[^<]+` $html -}}
  {{- if hasPrefix . "<" -}}  {{/* a tag: update which protected element we're in */}}
  {{- else if eq $protTag "" -}}  {{/* plain text outside code/links/headings: safe to edit */}}
```

Matches got swapped for private-use placeholder characters first, so a short keyword couldn't
match inside a longer one that was already colored. Then there were the small surprises: Hugo's
typographer turns `'` into `&rsquo;`, so "Let's Encrypt" never matched, and `&` becomes `&amp;`.

The gradients had their own constraint. Coloring each letter separately means one `<span>` per
letter, and current testing shows that {=ghostly: screen readers handle per-letter spans badly=}
(spelling words out, or reading only the first letter). So every gradient is a single element
with `background-clip: text`, which paints the gradient inside the glyphs and leaves the text alone.

{=point: It worked, but it colored words, not ideas=}. Pages about topics on the list got crowded, and
pages about anything else got nothing.

## Version 2: Per-Page Picks

The fix seemed obvious: let each page pick its own terms in front matter, with the shared table
kept as a library so "fuzzing" is the same color everywhere. I added build checks too: the build
{=ward: fails on a typo'd term=} and warns when a picked term never gets colored.

Then the library grew to about 110 terms, including tools and languages in their brand colors
(Python's blue and yellow, Rust's copper, Claude's terracotta). A lot of brand colors are too dark
for a near-black page, so a script {=arcane: lightened each one in OKLCH until it passed 7:1=}. Raising
only the lightness keeps the hue and saturation, so reds stay red instead of fading to pink.

Two problems showed up once real posts used it:

1) **Too many gradients.** When everything shimmers, nothing stands out. I cut them to
   {=trophy: about 20% of styles=} and made the rest solid colors.
2) **First mentions cluster.** An intro paragraph previews the whole post, so it holds the first
   mention of half the picked terms and lights up like a Christmas tree.

I also shipped a bug here worth admitting: a Hugo pipe passes its value as the *last* argument, I
wrote it as if it were the first, and {=glitch: every match on the site silently disappeared=}. A
coverage report I'd written for checking density caught it before anything went live.

## Version 3: Just Mark the Point

Eventually I realized I was solving the wrong problem. A machine can match terms reliably, but it
can't tell which phrase in a paragraph is *the point*, and that's what I actually wanted readers to
catch. So I deleted the matcher, the library and the front matter picks, and replaced all of it
with {=point: an inline marker you place by hand=}:

```markdown
The {=flow: upload step=} {=glitch: skips anything starting with a dot=} by default.
If the build fails, {=point: the live site stays on the last good version=}.
```

There are two tiers. Colored accents mark the tool, company or idea a paragraph is about, picked
from a palette where every style has a short note on when to use it. A key-point style (bright
italics, no color) marks the one takeaway of a section, at most once per section. The
guideline is about {=clarity: one accent per paragraph=}, on the phrase that carries the idea.

The syntax took a couple of tries. My first version reused link syntax, `[phrase](=style)`, with a
render hook, which worked great on the site and {=crimson: looked like broken links on GitHub=}. Double
brackets (`[[style: phrase]]`) never fired, because Markdown's link parser claims `[` first. What
worked was Hugo's passthrough extension, which hands anything between custom delimiters to a render
hook untouched:

```toml
[markup.goldmark.extensions.passthrough]
  enable = true
  [markup.goldmark.extensions.passthrough.delimiters]
    inline = [['{=', '=}']]
```

I skipped `::` and `<<` as delimiters because they show up in normal writing about code
(`std::vector`, heredocs). The render hook splits off the style name, {=ward: fails the build on an
unknown style=}, and runs the inner text back through Markdown so bold and code inside an accent
still work. After converting, I diffed every rendered accent and link against a saved baseline,
and the output was byte-for-byte identical.

## What I'd Take From It

I think the main lesson is to automate what's actually mechanical and leave judgment to people.
Contrast checks, style validation and "is this markup well-formed" are perfect for the build to
enforce. Picking what matters in a paragraph isn't, and version 1 and 2 were me spending a lot of
clever code avoiding that.

The final system is a palette file, a CSS template that generates one class per style, and two
small render hooks. {=point: That's less template code than the first version's matcher alone=}, and
it does the job better. I built it with Claude Code doing a lot of the implementation and testing, which made
it cheap to try (and throw away) the first two versions lol.
