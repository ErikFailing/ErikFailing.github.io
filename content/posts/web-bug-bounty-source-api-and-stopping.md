+++
date = '2026-11-26T09:30:00-06:00'
draft = false
title = 'Probing The API, Reading The Source, And Knowing When To Stop'
description = 'Testing a few hundred gRPC-Web API methods without sending anything risky, finding the public source I should have read on day one, and the stop rules and program answer that ended the engagement.'
project = 'web-bug-bounty'
tags = ['Bug Bounty', 'gRPC', 'Recon', 'Web', 'Security', 'Bash']
+++

The last part of the week was the API behind the main login page, the public source code I found
after I'd already been testing for days, and a few hosts I decided not to touch. Auth held on every
API method it was safe to call, and the program confirmed I'd drawn the line in the right place.
This post covers {=protobuf: the gRPC-Web probing=}, the source-first tools, and how it ended.

## The Login Page Shipped The Whole API

The main app's login page talked to its backend over gRPC-Web (gRPC carried over ordinary HTTP
requests, so a browser can call it), and two of its methods answer without a token, since the login
page needs them before anyone logs in. gRPC-Web clients are usually generated wholesale from a
service's protobuf definitions, so I figured the JavaScript calling those two would name every
other method too.

My first search for method paths found nothing, on every host. The generated client registers each
method as an object like `{methodName: "X", service: Y}`, with the method and service names as
separate string literals, and only joins them into the real `/package.Service/Method` path at call
time, so a regex looking for whole paths can't see them. Searching for the `methodName:` pattern
instead turned up {=crimson: a few hundred method names=}, for far more of the API than a login
page needs.

A method name on its own proves nothing about whether it's reachable or protected. Finding out
means calling it, and that's where it needed care.

## Deciding What To Send

My probe, `grpc-web-probe.sh`, sends one minimal call per method and reads the real gRPC status
instead of guessing from the HTTP code. I'd given it a filter that holds back method names that
look mutating (Create, Delete, Set...). Against this vocabulary that filter {=glitch: missed more
than half of them=}, because plenty of state-changing methods don't start with a CRUD
(create/read/update/delete) verb. So I didn't trust it, and reviewed every name by hand into three
tiers:

- **Tier 1, safe:** read-only metadata and listing calls, the same kind of thing the login page
  already calls.
- **Tier 2, borderline:** each with the specific reason it was ambiguous.
- **Tier 3, never send:** anything that changes state, touches credentials, sessions or tokens,
  has side effects outside the app, works with files, or exports data in bulk.

An "empty" call isn't harmless by default. Protobuf can't tell an absent field from a zero one, so
an empty gRPC-Web request is a call with every field set to its zero value, not a no-op. For
Tier 3, being wrong was much worse than anything a finding could be worth, so {=point: nothing in
Tier 3 that could change state ever got sent=}, then or later.

Then I resolved every Tier 1 and Tier 2 name to its real service before sending anything, by
tracing each `{methodName, service}` object back to the service's full name in the JavaScript. A
name alone can mislead: a generic-sounding status or progress call can turn out to belong to a
far more sensitive service. Resolving moved 8 Tier 1 methods and 10 Tier 2 methods into stricter tiers
before a single request went out.

## Two Bugs That Never Touched The Network

Both were caught by testing the tool against a local fixture server first.

The first: the body of each call is the empty gRPC-Web message frame, five zero bytes (one
compression-flag byte and a four-byte length). My first version stored it in a bash variable, and
bash variables can't hold a NUL byte, so it was silently an empty string. Every probe would have
sent a 0-byte body and gotten back a malformed-request error instead of an auth answer. The fix was
to write the bytes to a file and have curl read that:

```bash
# Bash can't hold NUL bytes in a variable: $'\x00\x00\x00\x00\x00' is just an empty string.
frame=$(mktemp)
printf '\x00\x00\x00\x00\x00' > "$frame"
od -An -tx1 "$frame"   # prints: 00 00 00 00 00
curl -sk -i -H 'Content-Type: application/grpc-web+proto' -H 'X-Grpc-Web: 1' \
  --data-binary @"$frame" "https://api.example.com/package.Service/Method"
```

The second was a `set -e` gotcha: a `cond && cmd` as the last line of a loop inside a `$(...)`
substitution. On the iterations where the condition was false, the substitution's exit status was
non-zero, and the script aborted silently. I first blamed every `cond && cmd` in a loop body, and
three small test cases showed that wasn't it, the trigger was being inside the substitution. A
`sed` rewrite that avoids the loop fixed it.

## What Came Back

Tier 1 ended at 18 methods (22 real paths, since a few names lived on two versions of the same
service) and Tier 2 at 23 methods (24 paths). Against three hosts behind the shared gateway that's
138 requests. Every path got {=ward: a clean `401 UNAUTHENTICATED`=}
on at least one host, carrying the backend's own auth error (`missing auth header`), so the
application's auth check was firing, rather than an edge proxy. The rest were timeouts, or
`UNIMPLEMENTED` where a host's gateway didn't route that service at all.

Later I widened the same list to 21 more hosts, one request every 4 seconds: 966 responses, each decoded byte by byte instead of
trusted by status code. 769 were clean 401s, 166 were the same `UNIMPLEMENTED` routing non-result
wrapped in an HTTP 200, and 31 timed out. Nothing fell outside those three buckets, and no method
ever answered without a token.

## The Source Was Public The Whole Time

On day five I finally did what I should have done on day one: looked for the company's public
code. It had published SDKs that documented its public API in detail, which I'd been piecing
together from JavaScript for days.

I built two tools so this is step one on every target now:

- **`source-discover.sh`** sweeps GitHub, GitLab, Bitbucket, PyPI, npm, crates.io, Maven, RubyGems,
  NuGet, Docker Hub, Quay, SwaggerHub, the Wayback Machine and the iOS App Store for a target's
  code, and writes a manifest for me to prune (namesakes are everywhere). It's passive and only
  talks to the code hosts' own APIs, so it sends no research header, and it never sends my identity.
- **`source-pull.sh`** clones the repos with full history and fetches the packages from the pruned
  manifest, then runs trufflehog and gitleaks over the history and pulls out API specs and auth
  details. It {=ward: never builds or runs anything it downloads=}, and a test checks that.

For this target, one code host was the whole public surface. Everything in the package registries
was a mirror of it or something unrelated, and the secret scans were clean. The SDKs turned into a
detailed test plan for authorization bugs (IDOR, insecure direct object references, and friends)
for when I had an account. As it
turned out, that plan never got used.

## Knowing When To Stop

A rule based on hostnames only sees names. During the CORS sizing from the last post, three hosts
with completely ordinary names answered an already-approved, read-only request with
{=point: a legal-notice banner=} that made me unsure the program could authorize testing them, the
same banner the screenshot clustering had shown on a small group of hosts earlier in the week. The request was identical to what
had come back clean on 94 other hosts, but the content said these weren't systems I should be
poking at without asking.

So I stopped sending to them, and made the stop permanent in code:

- **Hold files.** The scope guard got its fifth rule: any host listed in a `hold-*.txt` next to the
  scope config is dropped, for every tool, without anyone having to remember an `--exclude` flag. It
  fails closed on an unreadable file or a bad entry.
- **Content stop rules.** The HTTP probe got a `--stop-on REGEX` option that halts the whole run the
  moment a response body matches. I checked it against a local server: it stopped on the matching
  response, and the next request was never sent.

Then I asked the program. HackerOne treats contacting a program off-platform without permission as
a violation, and a question filed as a report would have spent one of my trial reports, so I sent
one ticket to HackerOne Support asking two things: whether the program could provide a test account,
and whether those hosts were intended targets.

The answer came back two days later. The hosts weren't intended targets, and excluding them was
the right call. And they couldn't provide test accounts.

## Where It Ended

Without an account there was no way into the authenticated side, which is where most of the real
application logic lives. The no-credential surface was done and clean, so I parked the program as
a monitoring target and moved my time back to fuzzing.

What I'd do differently:

1) Read the target's public source first, before any recon traffic.
2) Ask the program my questions (test accounts, unclear scope) on day one. The answer took two
   days and decided what the rest of the engagement could be.
3) Build content-based stop rules before the first sweep, not after a response surprises me.

I think the most useful thing I got out of the week is that the careful parts (preview by default,
resolving before sending, re-checking the impact chain) never felt like they slowed me down, and
they're what kept a week with zero findings from turning into a bad report.
