# TODO

Open work on the site. Check items off or delete them as they land. The longer reasoning behind
most of these is in `reports/Personal site improvement audit.md` (local only, not in the repo).

## Blog

- [ ] Keep writing posts. The one that matters most is the first real security writeup: a finding
      paired with its fix, like a fuzzing campaign or a reverse engineering methodology post. It
      also becomes the first security project card and the first pinned item on the home page.

## Projects page

- [ ] Build `/projects/`: one page bundle per project (`content/projects/<slug>/index.md`) with a
      fixed set of front matter (title, summary, role, year, stack, links, status, featured,
      weight) and a card grid in a site-only `layouts/projects/list.html`, so no theme file gets
      shadowed. Keep `mainSections = ['posts']` so projects stay out of RSS and post numbering.
- [ ] Only list projects that exist and can be linked. No "coming soon" cards.
- [ ] Uncomment the Projects entries in `hugo.toml` (the `menu.main` item and the home page
      button).

## Home page

- [ ] Pin selected projects and blog posts on the front page, 2 to 3 items, picked with something
      like `featured = true` in front matter and rendered in
      `layouts/_partials/index_profile.html`. No JavaScript; styles go in `assets/css/extended/`.

## GitHub profile

- [ ] Fix up the GitHub profile, since it's the first icon on the home page: add a profile README
      (a repo named `ErikFailing`), pin this site and `Fuzzing-Infrastructure`, and add
      descriptions to (or archive) the repos that have none.

