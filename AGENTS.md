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
- Never invent experiences, results, numbers, quotes or opinions. Work from Erik's notes and leave
  `TODO:` markers for anything missing.
- Never add details about Erik's current or past employers' work beyond what's already on the
  resume, and nothing classified or controlled in any form.

## Site changes

- Colors, typography and components follow [STYLE.md](STYLE.md); CSS lives in
  `assets/css/extended/`. Never edit files under `themes/PaperMod/` (a Git submodule).
- Build and deploy details are in [DEPLOY.md](DEPLOY.md); theme details in [THEME.md](THEME.md).
