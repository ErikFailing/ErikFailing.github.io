# Style guide

The site is **dark-only**: a near-black canvas, gray surfaces and borders, and two accents taken from
the World Anchor logo, brightened. All of it is implemented in
[`assets/css/extended/theme.css`](assets/css/extended/theme.css); fonts are in
[`fonts.css`](assets/css/extended/fonts.css).

Contrast ratios below are WCAG 2.x calculations made while building this guide (not published
values). Levels: AAA ≥ 7:1, AA ≥ 4.5:1, non-text ≥ 3:1.

## Colors

### Surfaces and text

| Token | Hex | Use | Contrast on canvas |
|---|---|---|---|
| `--theme` | `#08090c` | Page canvas, header, footer | — |
| `--entry` | `#111318` | Cards, TOC, code blocks | — |
| `--code-bg` | `#181b21` | Inline code, table header, profile buttons | — |
| `--tertiary` | `#22262d` | Copy button, hover fills | — |
| `--primary` | `#e9edf2` | Headings, nav, labels | 16.9:1 AAA |
| `--content` | `#d9dee5` | Body text | 14.7:1 AAA |
| `--secondary` | `#aab2bd` | Dates, meta, captions, icons at rest | 9.3:1 AAA |

The canvas is near-black (1.05:1 from pure `#000`) with a barely-there cool tint, so it reads as black
while keeping shadows and raised surfaces visible. Text is off-white, never pure white.

### Accents

| Token | Hex | Contrast on canvas |
|---|---|---|
| `--blue` / `--blue-hover` | `#4db8ff` / `#8fd3ff` | 9.1:1 / 12.3:1 |
| `--green` / `--green-hover` | `#3fd68a` / `#7fe5ad` | 10.6:1 / 13.0:1 |
| `--blue-tint` / `--green-tint` | `#101e29` / `#0f221b` | Backgrounds (12% accent over canvas) |
| `--on-accent` | `#08090c` | Text on blue or green fills (never white) |
| `--navy-hi` / `--navy-lo` | `#1a2fa8` / `#0a0f3d` | Decorative only (favicon, logo backdrops) |

**Roles: blue means "you can act here", green means "category, state or emphasis".**

- **Blue:** inline links, hover states, focus rings, the active menu item, card hover edges,
  social-icon hover, button hover, pagination, text selection.
- **Green:** tag pills, list bullets, the blockquote bar, the profile subtitle, highlights,
  success states. Green never colors a link; blue never fills a tag.
- Keep accents to roughly 10% of a page. The site should read as black and gray with blue and
  green as signals.

### Borders and focus

| Token | Hex | Use |
|---|---|---|
| `--border` | `#272b33` | Card, code-block, table and TOC edges (decorative) |
| `--border-strong` | `#343a43` | Button outlines, `hr`, copy button (decorative) |
| `--border-control` | `#6b7280` | Any control identified only by its border, e.g. the search box (≥ 3:1 on every surface) |
| `--focus` | `#4db8ff` | `:focus-visible` outline: 2px solid, 2px offset (9.1:1) |

## Accessibility rules

- **Links in text are always underlined.** Blue vs body text is only 1.6:1, so color alone can't
  mark a link (WCAG 1.4.1).
- **Blue and green must differ by form, not just hue.** They're nearly identical in lightness and
  close to indistinguishable with tritanopia, so tags are pills, links are underlined, and focus
  is an outline.
- **Decorative borders may be subtle;** a border that is the only sign of a control uses
  `--border-control`.
- **Every interactive element shows the blue focus outline** (outline, not box-shadow, so it
  survives Windows high-contrast mode).
- **`prefers-contrast: more`** brightens muted text, borders and link underlines.

## Typography

Open Sans for all text (self-hosted, weights 300–800); code uses a monospace stack
(`ui-monospace, Cascadia Code, Source Code Pro, Menlo, Consolas, …`) because code needs aligned
characters.

| Role | Size (phone → desktop) | Weight | Line height |
|---|---|---|---|
| Profile name | 45 → 55px | 700 | 1.1 |
| Post title, h1 | 37 → 44px | 700 | 1.15 |
| h2 | 31 → 35px | 650 | 1.2 |
| h3 | 26 → 28px | 600 | 1.25 |
| h4, card titles, profile subtitle | 22 → 22.5px | 600 | 1.3 |
| h5 | 18px | 600 | 1.4 |
| h6 (eyebrow label) | 15px uppercase, muted | 600 | 1.4 |
| Body | 18px | 400 (bold 650) | 1.65 |
| Meta, captions, tags | 15px | 400 (tags 600) | 1.5 |
| Tables | 16px | 400 (header 600) | 1.5 |
| Footer | 14px | 400 | 1.5 |
| Code blocks / inline code | 15px / 0.875em | 400 | 1.55 |

- Headings use a fluid scale (ratio 1.2 on phones to 1.25 on desktop) and slightly tighter
  letter-spacing at large sizes.
- Content column: 680px, about 66–70 characters per line.
- Bold is 650 rather than 700 because light text on dark looks heavier.

## Spacing

Base unit 4px: 4, 8, 12, 16, 24, 32, 48, 64px.

- Paragraphs and lists: 20px apart; list items 0.4em.
- Headings get at least 1.5× more space above than below: h2 40/12px, h3 32/8px, h4 24/8px.
- Code blocks, tables, figures and blockquotes: 24px above and below. `hr`: 48px.

## Components

- **Profile buttons:** surface-2 fill, `--border-strong` outline, 600 weight; on hover a blue
  border and light-blue text.
- **Social icons:** muted gray at rest, blue on hover.
- **Cards:** `--entry` fill and `--border` edge; the edge turns dark blue on hover.
- **Tags:** green pills (tint fill, green edge and text); brighter on hover.
- **Code blocks:** Hugo's `github-dark` highlighting on `#111318` with a `--border` edge; long
  lines scroll instead of wrapping mid-token. Comments are the lowest-contrast token at 6:1 (AA).
- **Inline code:** surface-2 fill, thin border, 4px radius.
- **Blockquotes:** 3px green bar, upright body text.
- **Tables:** horizontal rules only, surface-2 header row, scroll sideways on phones.
- **Images:** 1px `--border` so dark screenshots don't blend into the page.

## Keyword colors

A nod to the colored keywords in text games like Caves of Qud: a short list of terms gets a
signature color the first time it appears on a page. It's automatic and retroactive. The list
lives in [`data/keywords.yaml`](data/keywords.yaml), and adding a term there colors it in every
existing and future post.

Each style is colored to fit the term's vibe:

| Style | Look | Vibe | Terms |
|---|---|---|---|
| `anchor` | blue → green | World Anchor's logo | World Anchor |
| `qud` | Qud cyan → Qud gold | Caves of Qud's own palette | Caves of Qud |
| `crimson` | solid red `#ff6b6b` | Attacking | pentesting, red team |
| `blaze` | red → orange | Something on fire | remote code execution / RCE, exploit development |
| `glitch` | magenta → red | Unknown and dangerous | zero-day |
| `ascend` | orange → gold | Climbing up | privilege escalation |
| `flood` | blue → cyan | Water spilling over | buffer overflow |
| `ghostly` | pale lavender → violet | Haunted memory | use-after-free |
| `static` | cyan → magenta | Noise and chaos | fuzzing |
| `arcane` | violet → blue | Digging into secrets | reverse engineering |
| `trophy` | gold → orange | Winning | CTF / capture the flag, proof of concept |
| `ward` | green → teal | Shields up | defense in depth, least privilege, threat modeling, memory safety |
| `iron` | steel blue → silver | Metal links | supply chain |
| `flow` | lime → cyan | Moving through pipes | CI/CD, infrastructure as code |

When adding a term, pick the style whose vibe fits, or add a new style if none do.

Rules (enforced by [`layouts/_partials/keyword_colors.html`](layouts/_partials/keyword_colors.html)):

- **First mention only**, at most **2 per paragraph** and **5 per page** (earliest mentions win).
  Limits are set in the data file.
- **Never** inside code, links, headings, buttons or HTML attributes, and never in titles,
  summaries or the RSS feed. Pages can opt out with `noKeywordColors = true` (the resume does).
- **Whole words, any capitalization;** the text keeps its original capitalization.
- **Only solid and smooth-gradient styles.** A gradient is painted inside the letters of one
  element (`background-clip: text`), so screen readers and copy/paste see a normal word.
  Letter-by-letter effects would need one element per letter, which screen readers read badly.
- **No solid-blue style,** so a keyword never looks like a link.
- **Every color and every point along each gradient passes 7:1** on the canvas (lowest: steel at
  7.07:1, red at 7.17:1). New styles must too, and need a matching `.kw-NAME` class in
  [`assets/css/extended/keywords.css`](assets/css/extended/keywords.css).
- **Keep the list short and distinctive.** Coloring common words makes everything look clickable.

For a one-off phrase that isn't in the list, use the shortcode in a post:
`{{< kw tide >}}some phrase{{< /kw >}}`.
Manual uses don't count toward the limits, so use them rarely.

## Writing for skimmers

Open each post with a one-to-three-sentence summary, use a descriptive h2 every few hundred words,
keep paragraphs short, and use descriptive link text ("the AFL++ docs", not "here").

## Changing the theme

- Edit tokens in the first block of `theme.css`; components reference the tokens, so most changes
  are one line.
- Check any new text color reaches 7:1 (body) or 4.5:1 (minimum) against `#08090c` and the
  surfaces, e.g. with the [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/).
- Save CSS files as UTF-8 **without** a byte-order mark.
- To bring back a light mode, set `disableThemeToggle = false` in `hugo.toml`, move the dark
  values to `:root[data-theme="dark"]` only, and add a light palette on `:root` with darker
  accents (for example blue `#0b62b8`, green `#0f7040` on white); the current accents fail on
  white.
