# TODO

Open work on the site. Check items off or delete them as they land. The longer reasoning behind
most of these is in `reports/Personal site improvement audit.md` (local only, not in the repo).

## Blog

- [ ] Finish and publish the last post in the Fuzzing GameNetworkingSockets series,
      `content/posts/reporting-and-upstreaming.md`. It's a draft on purpose: it waits on Valve
      shipping a fix for the reported finding and on the maintainers' reply to issue #475. Its
      `TODO:` markers say what's missing. Nothing about the unfixed finding goes in this repo
      before then, drafts included, since the repo is public.
- [ ] When the harnesses are public (upstream or in their own repo), link them from the project
      page (`content/projects/gamenetworkingsockets-fuzzing/index.md`, a `[[links]]` entry),
      update its `status`, and update the "Where Things Stand" section of the overview post.
- [ ] Keep writing posts.

## Projects page

- [x] Build `/projects/`: one page bundle per project (`content/projects/<slug>/index.md`) with a
      fixed set of front matter and a card grid in a site-only `layouts/projects/list.html`, so no
      theme file gets shadowed. `mainSections` stays `['posts']` so projects stay out of post
      numbering, and `hiddenInRss` keeps them out of RSS. See "Projects page" in STYLE.md.
- [x] Uncomment the Projects entries in `hugo.toml` (the `menu.main` item and the home page
      button).
- [ ] Add more projects, but only ones that exist and can be linked. No "coming soon" cards.

## Home page

- [ ] Pin selected projects and blog posts on the front page, 2 to 3 items, picked with
      `featured = true` in front matter (the GameNetworkingSockets project already has it) and
      rendered in `layouts/_partials/index_profile.html`. No JavaScript; styles go in
      `assets/css/extended/`.

## GitHub profile

- [ ] Fix up the GitHub profile, since it's the first icon on the home page: add a profile README
      (a repo named `ErikFailing`), pin this site and `Security-Research`, and add
      descriptions to (or archive) the repos that have none.

