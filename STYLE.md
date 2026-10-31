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
- **Tags:** green pills (tint fill, green edge and text); brighter on hover. Posts show them at
  the top (under the date line, slightly smaller) and at the bottom, and every card in a post list
  shows its post's tags, all through `layouts/_partials/post_tags.html`.
- **Code blocks:** Hugo's `github-dark` highlighting on `#111318` with a `--border` edge; long
  lines scroll instead of wrapping mid-token. Comments are the lowest-contrast token at 6:1 (AA).
- **Inline code:** surface-2 fill, thin border, 4px radius.
- **Blockquotes:** 3px green bar, upright body text.
- **Tables:** horizontal rules only, surface-2 header row, scroll sideways on phones.
- **Images:** 1px `--border` so dark screenshots don't blend into the page.
- **Numbered sections (posts only):** each `##` section heading is numbered "1.", "2.", ... with
  the number in green, and the table of contents shows the same numbers. It's generated with CSS
  counters, so headings are written plainly in Markdown, never numbered by hand. Pages (About,
  Resume) aren't numbered; any page can override with `numberHeadings = true` or `false` in front
  matter. `###` subsections stay unnumbered.

## Accents

Color draws the reader to the important points, a nod to the colored keywords in text games like
Caves of Qud. Accents are written by hand (by me or an LLM) in the Markdown, so they go exactly on
the words that matter.

**Syntax:** link syntax with `=` and a style name. It works on a word, a phrase or a whole
sentence, and bold or `code` inside still works:

```markdown
The [upload step](=flow) [skips anything starting with a dot](=glitch) by default.
[If the build fails, nothing deploys](=point), so the live site stays on the last good version.
```

**Two tiers:**

1. **Key point (`=point`):** the one takeaway of a section, the sentence or phrase a skimming
   reader must not miss. Shown as the brightest text, a bit heavier, over a soft green
   highlighter mark (no hue). **At most one per section**, and not every section needs one.
2. **Colored accents (every other style):** a tool, company, person, place or idea that carries
   a paragraph, in a color from the palette below.

**How to accent a page:**

- **About one accent per paragraph, on average.** Some paragraphs get two, some get none; skip a
  paragraph when nothing in it is worth pulling out.
- **Accent the main idea.** Skimming only the colored text should give the gist of the page.
  Accent the phrase that carries the point ("never lands on the live site by surprise"), not just
  any noun that happens to be in the palette.
- **Keep accents short:** usually 1 to 6 words. A whole sentence is for key points, and rare.
- **Picking a style:** a named tool, language, company, person or place gets its own style
  (`python`, `docker`, `boeing`, `rocket`). Otherwise pick the vibe that matches what the phrase
  is about (attack, defense, danger, winning, flow, secrets...). The palette's `use` notes list
  which style fits which tools and terms.
- **Be consistent:** a tool gets the same style every time it's accented.
- **Never** in headings, links, code or tables. The resume gets no accents; About gets them
  sparingly.

**The palette** lives in [`data/accents.yaml`](data/accents.yaml): every style's colors and a
`use` note saying when to pick it, including suggested styles for tools and terms. The CSS is
generated from it, and a misspelled style name fails the build. In short:

| Style | Look | Use for |
|---|---|---|
| `point` | bright text + green highlighter mark | The key point of a section (tier 1) |
| `crimson` | red | Attacks and offensive work: pentesting, red teaming, phishing, takeovers, attack surface |
| `blaze` | red → orange gradient | Something on fire: RCE, exploit development |
| `glitch` | magenta → red gradient | Unknown, corrupted or absurd: zero-days, memory corruption, surprising gotchas |
| `toxic` | lime → purple gradient | Injection bugs: SQL injection, command injection, XSS |
| `ascend` | orange | Climbing up or breaking out: privilege escalation, sandbox escapes |
| `flood` | sky blue | Overflows: buffer and integer overflows |
| `ghostly` | pale lavender → violet gradient | Haunted or invisible: use-after-free, clickjacking, CSRF, side channels |
| `static` | cyan → magenta gradient | Noise and chaos: fuzzing, AFL++, race conditions, visual glitches |
| `arcane` | violet | Secrets, deep knowledge, AI: reverse engineering, crypto, hashes, SRI, LLMs |
| `trophy` | gold | Winning and proving it: CTFs, PoCs, bug bounties, awards, scores |
| `ward` | green | Defenses: defense in depth, least privilege, threat modeling, CSP, HSTS, DNSSEC, SPF/DMARC, MFA |
| `iron` | steel gray-blue | Machinery: supply chain, SBOMs, plumbing, black-and-white brands (Unreal, Unity, Squarespace) |
| `flow` | cyan | Pipelines: CI/CD, GitHub Actions/Pages, Dependabot, build and deploy steps |
| `clarity` | pale gold | Legibility: WCAG, accessibility, readability, fonts |
| `signature` | blue → violet gradient | Me (Erik Failing) |
| `rocket` | gold → red gradient | Huntsville, Alabama (the Rocket City) |
| `anchor`, `qud` | own gradients | World Anchor, Caves of Qud |
| Brand styles | brand colors | Companies (`boeing`, `northrop`), AI (`claude`, `openai`), languages (`python`, `rust`, `golang`, `javascript`, `typescript`, `cpp`, `csharp`, `dotnet`, `java`, `bash`, `powershell`, `zig`), security tools (`ghidra`, `burp`, `wireshark`, `metasploit`, `kali`, `htb`, `tryhackme`, `splunk`), dev tools (`git`, `docker`, `kubernetes`, `terraform`, `ansible`, `aws`, `azure`, `cloudflare`, `linux`, `hugo`, `vscode`, `vim`, `godot`, `steam`, `letsencrypt`) |

**Adding a style:** add it to `data/accents.yaml` with one color (solid) or two (gradient) and a
`use` note. Keep the palette mostly solid; gradients are for signature styles only (about 1 in 5).
Brand colors use the brand's own color, lightened (keeping the hue) if needed to pass 7:1.

**How it's built:**

- [`layouts/_markup/render-link.html`](layouts/_markup/render-link.html) turns `[text](=style)`
  into `<span class="accent accent-STYLE">` and renders every other link exactly as before.
- Each style's class is generated from the data file
  ([`assets/css/accent-styles.css`](assets/css/accent-styles.css)); shared rules, the key-point
  look, gradients and print/high-contrast fallbacks are in
  [`assets/css/extended/accents.css`](assets/css/extended/accents.css).
- A gradient is painted inside the letters of one element (`background-clip: text`), so screen
  readers and copy/paste see normal text.
- Every color and every point along each gradient passes 7:1 on the canvas. Solid blues are fine:
  links are always underlined and accents never are.

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
