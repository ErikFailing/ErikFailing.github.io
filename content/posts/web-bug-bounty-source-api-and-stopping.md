+++
date = '2026-11-26T09:30:00-06:00'
draft = false
title = 'Probing The API, Reading The Source, And Knowing When To Stop'
description = "Testing a few hundred gRPC-Web API methods without sending anything risky, reading the target's public source, and the stop rules and program answer that ended the engagement."
project = 'web-bug-bounty'
tags = ['Bug Bounty', 'gRPC', 'Recon', 'Web', 'Security', 'Bash']
+++

The last part of the week was the API behind the main login page, the target's public source code,
and a few hosts I decided not to touch. Auth held on every API method it was safe to call, and the
program confirmed I'd drawn the line in the right place.
This post covers {=protobuf: the gRPC-Web probing=}, the source-first tools, and how it ended.

## The Login Page Shipped The Whole API

The main app's login page talked to its backend over gRPC-Web (gRPC carried over ordinary HTTP
requests, so a browser can call it), and two of its methods answer without a token, since the login
page needs them before anyone logs in. gRPC-Web clients are usually generated wholesale from a
service's protobuf definitions, so I figured the JavaScript calling those two would name every
other method too.

The generated client registers each method as an object like `{methodName: "X", service: Y}`,
with the method and service names as separate string literals, and only joins them into the real
`/package.Service/Method` path at call time, so a search for whole paths finds nothing. Searching
for the `methodName:` pattern turned up {=crimson: a few hundred method names=}, for far more of
the API than a login page needs.

A method name on its own proves nothing about whether it's reachable or protected. Finding out
means calling it, and that's where it needed care.

## Deciding What To Send

My probe, `grpc-web-probe.sh`, sends one minimal call per method and reads the real gRPC status
instead of guessing from the HTTP code. A keyword filter for mutating verbs (Create, Delete,
Set...) {=glitch: catches less than half of a vocabulary like this=}, because plenty of
state-changing methods don't start with a CRUD (create/read/update/delete) verb. So I reviewed
every name by hand into three tiers:

- **Tier 1, safe:** read-only metadata and listing calls, the same kind of thing the login page
  already calls.
- **Tier 2, borderline:** each with the specific reason it was ambiguous.
- **Tier 3, not sent:** anything that changes state, touches credentials, sessions or tokens,
  has side effects outside the app, works with files, or exports data in bulk.

Protobuf can't tell an absent field from a zero one, so an "empty" gRPC-Web request is a real
call with every field set to zero, not a no-op. That's why Tier 3 stayed out.

Then I resolved every Tier 1 and Tier 2 name to its real service by tracing each
`{methodName, service}` object back to the service's full name in the JavaScript, since
{=point: a method name alone can mislead=}: a generic-sounding status call can belong to a far
more sensitive service. That moved 18 methods into stricter tiers.

## What Came Back

Tier 1 ended at 18 methods (22 real paths, since a few names lived on two versions of the same
service) and Tier 2 at 23 methods (24 paths). Against three hosts behind the shared gateway that's
138 requests. Every path got {=ward: a clean `401 UNAUTHENTICATED`=} on at least one host,
carrying the backend's own auth error (`missing auth header`), so the application's auth check
was firing, rather than an edge proxy. The rest were timeouts, or `UNIMPLEMENTED` where a host's
gateway didn't route that service at all.

Later I widened the same list to 21 more hosts, one request every 4 seconds: 966 responses, each
decoded byte by byte instead of trusted by status code. 769 were clean 401s, 166 were the same
`UNIMPLEMENTED` routing non-result wrapped in an HTTP 200, and 31 timed out. Nothing fell outside
those three buckets, and no method ever answered without a token.

## Reading The Public Source

On day five I swept the company's public code. It had published SDKs that documented its public
API in detail, the same surface I'd been mapping from the JavaScript.

I built two tools for it, and source-first recon is now step one in my playbook:

- **`source-discover.sh`** sweeps GitHub, GitLab, Bitbucket, PyPI, npm, crates.io, Maven, RubyGems,
  NuGet, Docker Hub, Quay, SwaggerHub, the Wayback Machine and the iOS App Store for a target's
  code, and writes a manifest for me to prune (namesakes are everywhere). It's passive and only
  talks to the code hosts' own APIs.
- **`source-pull.sh`** clones the repos with full history and fetches the packages from the pruned
  manifest, then runs trufflehog and gitleaks over the history and pulls out API specs and auth
  details. It {=ward: never builds or runs anything it downloads=}.

For this target, one code host was the whole public surface. Everything in the package registries
was a mirror of it or something unrelated, and the secret scans were clean. The SDKs turned into a
detailed test plan for authorization bugs (IDOR, insecure direct object references, and friends)
for when I had an account.

## Knowing When To Stop

A rule based on hostnames only sees names. During the CORS sizing from the last post, three hosts
with completely ordinary names answered an already-approved, read-only request with
{=point: a legal-notice banner=} that made me unsure the program could authorize testing them, the
same banner the screenshot clustering had shown on a small group of hosts earlier in the week.
The request was identical to what had come back clean on 94 other hosts, but the content said
these weren't systems I should be poking at without asking.

So I stopped sending to them, added them to the scope guard's hold list, and asked the program
through HackerOne Support two things: whether they could provide a test account, and whether
those hosts were intended targets.

The answer came back two days later. The hosts weren't intended targets, and excluding them was
the right call. And they couldn't provide test accounts.

## Where It Ended

Without an account there was no way into the authenticated side, which is where most of the real
application logic lives. The no-credential surface was done and clean, so I parked the program as
a monitoring target and moved my time back to fuzzing.

What carries forward is the toolkit: the scope guard, the probes, and source-first recon.
