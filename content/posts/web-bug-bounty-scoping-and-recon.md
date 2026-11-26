+++
date = '2026-11-26T09:10:00-06:00'
draft = false
title = 'Scoping And Recon: Thousands Of Hosts, Eighteen Apps'
description = 'How I turned a bug bounty scope into code before sending a packet, kept every request attributed and paced, and narrowed a few thousand hostnames down to eighteen distinct apps.'
project = 'web-bug-bounty'
tags = ['Bug Bounty', 'Recon', 'Web', 'Security', 'Bash']
+++

In November 2026 I spent about a week on a closed-scope HackerOne program, my first bug bounty
against live web targets. This post covers the start of the week: turning the program's scope
into code, keeping every request attributed and paced, and recon that started at {=crimson: a few
thousand hostnames=} and ended at eighteen distinct apps worth looking at.

I'm leaving the program, the company and every hostname out of these posts. The examples use
`example.com`.

## The Program And The Bar

The scope was a handful of domains, all eligible up to Critical. The program
requires a research header with your HackerOne username on every request, and it's Signal-gated:
below a Signal of 1.0 you only get a few trial reports, and a report closed as Not Applicable
lowers your Signal.

That set the bar for the whole week. With only a few shots, {=point: I'd only submit something I'd
fully reproduced and could prove the impact of=}. A plausible-looking report that falls apart in
triage costs more than not reporting at all.

## Scope As Code

The first thing I built was the gate every active tool sends its targets through. `scope-guard.sh`
reads hostnames on stdin and writes only the ones that are safe to test to stdout, with the reason
for every drop on stderr. A host gets through only if:

1) it's a well-formed hostname (no scheme, port, path or wildcard),
2) it matches an include rule in the program's own Burp project config,
3) it matches no exclude rule,
4) its name doesn't carry a marker I'd decided to ask the program about first, and
5) it isn't on a hold list (a `hold-*.txt` file next to the scope config).

The scope comes from the files HackerOne generates for the program (the scope CSV and the Burp
project configuration), not a list I typed in, so the rules are exactly what the program published.
And it {=ward: fails closed=}: if it can't read the scope, or a hold file is unreadable or
malformed, it passes nothing and exits non-zero, so a pipeline never runs on a scope that didn't
load.

```bash
subfinder -d example.com -silent | bash tools/web/scope-guard.sh example | httpx -silent
```

Rule 4 mattered right away. Some names suggested systems the program might not be able to
authorize testing on, and safe harbor only covers what the program can authorize. So the guard
{=ward: held a few hundred hosts by name=} in the first recon pass, until I could ask the program
about them. Rule 5 came later in the week, for
a case rule 4 couldn't catch (that's in the last post).

## Attribution And Pacing

Every active tool follows the same rules:

- **Preview by default.** Without `--live`, a tool prints exactly what it would send and sends
  nothing.
- **Attributed.** A live run refuses to start without my HackerOne username in the environment, and
  every request carries the program's research header with it.
- **Paced.** Every tool has a rate limit and a request cap. The probes defaulted to 3 requests a
  second, and the later runs went at 1 a second or slower.

DNS was the awkward one. A DNS lookup can't carry an HTTP header, and I caught (in an audit of my
own traffic, later in the week) that one DNS-only tool had resolved names without recording who ran
it. The rule I settled on is that {=ward: DNS-only tools still require the username=}, and write it
to a `run-meta.txt` with the run's details, so every run is attributable even when the protocol
can't say so.

One app made the pacing point for me. During content discovery, its backend {=glitch: stopped
answering after about ten fast requests=}, a tarpit. So I stopped content discovery there and mined
the app's front-end JavaScript instead, which gave me its full API map (130 routes) without another
discovery request.

## Passive First, Then One Active Sweep

Passive enumeration (subfinder, assetfinder, github-subdomains and gau over the wildcards) came back
with a few thousand in-scope hostnames. Then I ran one breadth-first active sweep through the guard:
dnsx, tlsx, naabu, httpx, katana and gowitness, plus a curated set of nuclei templates, a short ffuf
quick-hits list and trufflehog. That sweep came back with zero nuclei findings, zero sensitive paths
and zero secrets.

The more useful number was what actually resolved. About 87% of the names that resolved pointed
at private (RFC 1918) addresses, so most of the estate isn't reachable from the internet at all.
A few hundred hosts answered.

## Eighteen Apps, Not Hundreds Of Hosts

A few hundred live hosts sounds like a lot of attack surface. It isn't, because {=point: most of a big estate
is the same app behind the same login=}. Two passes made that concrete:

- **Fingerprinting:** grouping hosts by what they serve (titles, headers, technology) collapsed the
  live set to 18 distinct apps.
- **Screenshot clustering:** I clustered all 498 gowitness screenshots by perceptual hash into 14
  groups, then reviewed each group's montage instead of 498 images. Nearly everything was an SSO
  (single sign-on) login, an identity provider page, or a CDN (content delivery network)
  "restricted" page. There was no exposed admin panel,
  dashboard or debug page hiding in the pile.

So the real target list was {=trophy: eighteen apps=}, and most of the week went into those. The
screenshot pass also turned up one small cluster showing a legal-notice banner, which comes back
in the last post.

## What Carried Forward

The scope guard, the attribution rules and preview-by-default became the base of every tool I wrote
after this, and each one has hermetic tests that check those rules (it refuses to run unattributed,
it drops out-of-scope hosts, it sends nothing in preview) before it ever touches the network. The
next post is the no-credential checklist, and the one finding that looked real.
