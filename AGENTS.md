# Instructions for AI assistants

This repo is Erik Failing's personal site (Hugo + PaperMod). It has two purposes: helping Erik land
software and security engineering roles, and sharing the projects and research he's genuinely
excited about with friends and colleagues. Accuracy and professionalism matter, but posts should
read like Erik showing someone something cool, not like marketing.

## Writing or editing content

- **Posts, project writeups, CTF/Hack The Box writeups, vulnerability disclosure writeups, and other
  conversational technical writing:** read [VOICE.md](VOICE.md) first and follow it closely,
  including its security writing rules and final checklist.
- **`content/resume.md`:** keep it strictly professional. Do not apply VOICE.md's voice to it.
- **`content/about.md`:** mostly professional with a light conversational touch; follow the
  toned-down rules in VOICE.md's "Where This Voice Applies" section.
- **Accents** (see "Accents" in STYLE.md): after drafting a post, do an accent pass. Mark the
  phrase that carries each paragraph's main idea with `{=style: phrase=}`, about one per paragraph
  on average (skip paragraphs with nothing worth pulling out), picking the style from
  `data/accents.yaml` (a named tool, company, person or place gets its own style; otherwise the
  vibe that fits). Mark at most one key point per section with `{=point: ...=}`. Never accent headings,
  links, code, tables or the resume. New tools get a brand-colored style (lightened to pass 7:1).
- Each post has a permanent `number` in front matter (see "Post numbers" in STYLE.md). Create posts
  with `hugo new content posts/...` so they get the next number, and never renumber existing posts.
- Post section headings (`##`) are numbered automatically by CSS (see "Numbered sections" in
  STYLE.md). Write them without numbers.
- Never invent experiences, results, numbers, quotes or opinions. Work from Erik's notes and leave
  `TODO:` markers for anything missing.
- Never add details about Erik's current or past employers' work beyond what's already on the
  resume, and nothing classified or controlled in any form.

## Site changes

- Colors, typography and components follow [STYLE.md](STYLE.md); CSS lives in
  `assets/css/extended/`. Never edit files under `themes/PaperMod/` (a Git submodule). Theme
  templates overridden in `layouts/` (`single.html`, `list.html`, `_partials/footer.html`, `_partials/post_meta.html`) must be diffed
  against the theme's versions when PaperMod updates.
- The site has a strict Content-Security-Policy (see "Security headers" in DEPLOY.md): no inline
  `<script>`, no `style=""` attributes, and no resources from other domains unless the CSP in
  `layouts/_partials/extend_head.html` is updated deliberately. Put JavaScript in `assets/js/site.js`.
- Build and deploy details are in [DEPLOY.md](DEPLOY.md); theme details in [THEME.md](THEME.md).
