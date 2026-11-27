+++
title = 'Web Bug Bounty Recon And Tooling'
description = 'A week on a closed-scope HackerOne program: scope enforced in code, a few thousand hosts narrowed to eighteen apps, a CORS finding that did not survive its own impact check, and the tools I built along the way.'
date = 2026-11-26T09:00:00-06:00
draft = false
number = 3
status = 'Closed: no test accounts, so no authenticated testing'
role = 'Solo, personal research'
year = 2026
tags = ['Bug Bounty', 'Web', 'Security', 'Recon', 'CORS', 'gRPC', 'Python', 'Bash']
weight = 15
accent = 'crimson'
pattern = 'crosshatch'
+++

In November 2026 I spent about a week on a closed-scope web bug bounty program on HackerOne, my
first one against live systems instead of source code I could build. The program's assets were a
handful of domains, and I only had the no-credential side of them: anything reachable without
an account.

The honest headline is that {=point: I didn't submit a finding=}. The one real lead, a CORS
misconfiguration across a shared gateway, turned out to expose nothing that wasn't already public
once I checked how the app actually authenticates. What I came out with is a method and a tested
toolkit I'd use on the next program.

The posts below don't name the program or its company, and leave out hostnames, product names and
anything else that would identify it. Every example is either generic or rebuilt on a local lab.

## What I built

- **{=ward: A scope guard every active tool goes through=},** built from the program's official
  scope files, with the program's research header and rate limits built into every tool.
- **Probes for the no-credential checklist:** CORS (with a real-browser proof-of-concept runner),
  OIDC redirect and PKCE checks, gRPC-Web method probing, cookie inspection, open redirects and
  subdomain takeover.
- **Source-first recon tools** that sweep the common code hosts and package registries for a
  target's public code, then clone and secret-scan it without ever building or running any of it.
- **Hermetic tests for every tool.**

## Results

- No submittable findings. Every no-credential check held: takeover, open redirect, SSRF, login
  enumeration, OIDC redirect validation and PKCE, token forgery, and auth on every API method it
  was safe to call.
- One informational CORS misconfiguration across a shared gateway. Real mechanism, no impact, not
  submitted.
- A few hosts with a legal-notice banner that made me unsure the program could authorize testing
  them. I held them and asked the program, which confirmed they weren't intended targets.

## Where it stands

The program couldn't provide test accounts, so the authenticated side, where most of the real
application logic lives, is out of reach for now. I've parked it as a monitoring target and moved
my time back to fuzzing.
