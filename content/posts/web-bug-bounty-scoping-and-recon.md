+++
date = '2026-11-26T09:10:00-06:00'
draft = false
title = 'Scoping And Recon: Thousands Of Hosts, Eighteen Apps'
description = 'How I turned a bug bounty scope into code before sending a packet, and narrowed a few thousand hostnames down to eighteen distinct apps.'
project = 'web-bug-bounty'
tags = ['Bug Bounty', 'Recon', 'Web', 'Security', 'Bash']
+++

In November 2026 I spent about a week on a closed-scope HackerOne program, my first bug bounty
against live web targets. This post covers the start of the week: turning the program's scope
into code, and recon that started at {=crimson: a few thousand hostnames=} and ended at eighteen
distinct apps worth looking at.

I'm leaving the program, the company and every hostname out of these posts. The examples use
`example.com`.

## The Program And The Bar

The scope was a handful of domains, all eligible up to Critical, and the program is Signal-gated:
below a Signal of 1.0 you only get a few trial reports, and a report closed as Not Applicable
lowers your Signal.

That set the bar for the whole week. With only a few shots, {=point: I'd only submit something I'd
fully reproduced and could prove the impact of=}. A plausible-looking report that falls apart in
triage costs more than not reporting at all.

## Scope As Code

The first thing I built was `scope-guard.sh`, the gate every active tool sends its targets
through. It reads hostnames on stdin and passes only the ones the program's own scope files (the
scope CSV and Burp project configuration HackerOne generates) allow, so {=ward: the rules are
exactly what the program published=}, not a list I typed in. It sits at the front of every
pipeline:

```bash
subfinder -d example.com -silent | bash tools/web/scope-guard.sh example | httpx -silent
```

Every tool also carries the program's research header on its requests and has a rate limit
built in, so neither depends on me remembering a flag.

The guard does two jobs, not one. It passes the in-scope hosts, and it also holds back a short
list of hosts that were technically in scope but that {=point: I'd decided I shouldn't touch
without asking the program first=}. Those live in a hold file the guard reads, and it drops them
before anything downstream can reach them, so a careless one-liner can't send to one by accident.

That's the shape every active tool I wrote after this follows: scope-gate the targets, stamp the
research header, rate-limit, and {=ward: default to a no-packet preview=} that prints exactly what
it would send before it sends anything. So the safety isn't me remembering to be careful on each
run, it's built into the tool.

## Passive First, Then One Active Sweep

Passive enumeration (subfinder, assetfinder, github-subdomains and gau over the wildcards) came back
with a few thousand in-scope hostnames. Then I ran one breadth-first active sweep through the guard:
dnsx, tlsx, naabu, httpx, katana and gowitness, plus a curated set of nuclei templates, a short ffuf
quick-hits list and trufflehog. That sweep came back with zero nuclei findings, zero sensitive paths
and zero secrets.

The more useful number was what actually resolved. About 87% of the names that resolved pointed
at private (RFC 1918) addresses, so most of the estate isn't reachable from the internet at all.
A few hundred hosts answered.

One app's backend {=glitch: stopped answering after about ten fast requests=} during content
discovery, a tarpit. So I mined its front-end JavaScript instead, which gave me its full API map
(130 routes) without guessing a single path.

## Reaching The Private Hosts Through The Gateways

That 87% private figure bugged me. Most of the estate rides a small number of shared public
gateways (reverse proxies that route by the `Host` header), so I wondered if I could reach the
private-only names through them: connect to a public gateway's IP, but set the `Host` header and
the TLS SNI (Server Name Indication, the hostname sent during the TLS handshake) to one of the
internal names, and see if the gateway {=crimson: hands me that internal app=}.

The trick to reading the result is a baseline. For each gateway I sent a couple of made-up canary
names that definitely don't exist anywhere, alongside the real internal names. If a real name comes
back different from the canaries, the gateway is routing by `Host` and there's something to chase.
If every name including the canaries gets the {=point: identical response, it's a catch-all=} and
there's nothing there.

I ran it across every distinct public gateway (deduped by resolved /24 so I wasn't hammering the
same box over and over), 14 names each, about 1,900 requests total. Every gateway was a catch-all:
the same login redirect or the same fixed error for every `Host`, canaries included. So none of the
private apps were reachable this way. A clean negative, but I only trust it because of the canaries.
Without them I'd have been staring at a wall of identical login redirects and might have read "routes
everything to the login page" as "routing works."

## Eighteen Apps, Not Hundreds Of Hosts

A few hundred live hosts sounds like a lot of attack surface. It isn't, because {=point: most of a
big estate is the same app behind the same login=}. Two passes made that concrete:

- **Fingerprinting:** grouping hosts by what they serve (titles, headers, technology) collapsed the
  live set to 18 distinct apps.
- **Screenshot clustering:** I clustered all 498 gowitness screenshots by perceptual hash into 14
  groups, then reviewed each group's montage instead of 498 images. Nearly everything was an SSO
  (single sign-on) login, an identity provider page, or a CDN (content delivery network)
  "restricted" page. There was no exposed admin panel, dashboard or debug page hiding in the
  pile.

So the real target list was {=trophy: eighteen apps=}, and most of the week went into those. The
screenshot pass also turned up one small cluster showing a legal-notice banner, which comes back
in the last post.

## What Carried Forward

The scope guard became the base of every web tool I wrote after this. The next post is the
no-credential checklist, and the one finding that looked real.
