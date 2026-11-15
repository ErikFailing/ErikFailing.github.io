+++
title = "Picking A Fuzzing Target: Valve's GameNetworkingSockets"
date = 2026-11-15T10:00:00-06:00
draft = false
number = 4
description = "Why I picked Valve's open-source networking library to fuzz, what its attack surface looks like, and the plan I started with."
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'Security', 'Valve']
+++

In November 2026 I spent about a week fuzzing Valve's GameNetworkingSockets, the open-source
version of the networking API in the Steamworks SDK. This series follows that project in the order
it happened, from an empty machine to {=static: twenty fuzzing harnesses=} and a report to Valve.
This first post is the starting point: why I picked this target, what there is to attack, and the
plan I went in with.

## Why GameNetworkingSockets

[GameNetworkingSockets](https://github.com/ValveSoftware/GameNetworkingSockets) (GNS from here on)
is a UDP transport for games: reliable and unreliable messages, fragmentation and reassembly,
encryption, and peer-to-peer connections with NAT traversal. I think three things made it a good
pick:

1) It's open source, so I could build it with sanitizers and coverage instrumentation instead of
   fuzzing a black box.
2) The project wants this. In
   [issue #410](https://github.com/ValveSoftware/GameNetworkingSockets/issues/410), a bug report
   from someone who had been fuzzing GNS with AFL++, one of the maintainers replied "I would love
   to add some fuzzing to the test suite." I couldn't find GNS in OSS-Fuzz either, so harnesses
   are {=point: a contribution the project asked for=}, not a surprise drop.
3) A real finding has somewhere to go. The repo's
   [SECURITY.md](https://github.com/ValveSoftware/GameNetworkingSockets/blob/master/SECURITY.md)
   sends vulnerabilities to Valve's HackerOne program instead of the public issue tracker.

## What There Is To Attack

GNS is a lot of C++ parsing bytes from strangers, and {=crimson: a lot of it runs before any
authentication=}. Roughly in the order a packet meets it:

| Layer | What parses untrusted bytes | Who can reach it |
|---|---|---|
| STUN and ICE | Attribute and candidate parsing during NAT traversal | Any peer, or a spoofed STUN/TURN server, before auth |
| UDP pre-login | The handler for packets from an unknown host | Anyone who can send a UDP packet |
| Crypto handshake | Certificate and session-crypto protobufs, signature checks, key exchange | A remote peer, before session keys exist |
| P2P signaling | Rendezvous messages and connect requests | A remote peer, through the signaling channel |
| SNP | The reliability layer: data segments, acks and nacks | The peer on an established connection |

It also has history, which told me where bugs like to live. Check Point Research found four
vulnerabilities in it in 2020, including memory corruption in the SNP layer's segment reassembly
(CVE-2020-6016 through CVE-2020-6019, written up in [Game
On](https://research.checkpoint.com/2020/game-on-finding-vulnerabilities-in-valves-steam-sockets/)
by Eyal Itkin), and issues #409 and #410 from earlier this year are {=glitch: logic bugs in the
same reliability code=}. All of those were fixed before the version I pinned, so they were my map,
not my findings.

## The Plan

I went in with a short plan, and most of it survived:

1) **Build a lab where results reproduce.** Pin the compiler, the fuzzers and the target, so
   {=ward: a crash found today still reproduces next month=}.
2) **Start with the cheapest harnesses.** The STUN and ICE parsers take a buffer and return, with
   {=iron: no connection, handshake or crypto in front of them=}. They'd give me working coverage
   and a fast feedback loop on day one.
3) **Then stand up real connections,** for the code that only runs once two peers are talking.
4) **Measure coverage and let it pick what's next,** instead of guessing where the unfuzzed code
   is.
5) **Use libFuzzer to develop and AFL++ for long runs.** Every harness would be a plain
   `LLVMFuzzerTestOneInput`, so {=static: the same code runs under both=}.

I built all of it with {=claude: Claude Code=} doing a lot of the implementation and babysitting the
overnight runs, same as the rest of this site.

## How The Series Goes

Each post is one step, in the order I took them:

1) Picking the target (this post).
2) [Building the lab](/posts/reproducible-fuzzing-lab/) on Windows, WSL2 and Docker.
3) [The first harnesses](/posts/first-fuzzing-harnesses/): two parsers, then a real connection.
4) [Measuring coverage](/posts/low-coverage-is-not-opportunity/), and learning that a big gap
   isn't always a target.
5) [Mutating protobuf messages](/posts/structure-aware-fuzzing-protobuf/) instead of raw bytes.
6) [Running everything overnight](/posts/overnight-fuzzing-campaigns/) with AFL++, and hitting a
   flat line.
7) [Putting old bugs back](/posts/seeded-bug-evaluation/) to prove the harnesses can catch one.
8) [Priming state](/posts/fuzzing-stateful-code/) to reach code that a fresh connection never
   runs.
9) [The false positives](/posts/my-early-crashes-were-my-own-harness/): three "findings" that
   were my own harness.
10) [Going back over every harness](/posts/threat-model-per-harness/) with a written threat
    model, and what that caught.
11) [The results](/posts/gns-fuzzing-results/): what it found, where it stands, and what I'd
    keep.

## Where It Ends Up

So nobody reads eleven posts waiting for a twist: {=point: I didn't find a critical bug=}. The
library held up to hundreds of millions of executions. What came out was five findings (none of
them high severity), one of which I reported to Valve, a harness suite I've offered upstream, and
a method I'd use again. I think that's worth writing up honestly.
