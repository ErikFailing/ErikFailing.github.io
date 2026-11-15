+++
title = 'Twenty Harnesses, No Critical Bug: The Results'
date = 2026-11-15T11:40:00-06:00
draft = false
number = 14
description = "What a week of fuzzing Valve's GameNetworkingSockets produced: the final harness suite, the coverage it reached, what it found, where things stand with Valve, and what I'd keep."
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'Security', 'Valve']
+++

This is the last stop in the series: what the GameNetworkingSockets fuzzing actually produced.
The short version is {=static: twenty harnesses=}, 43.71% line coverage, five findings (none of them
high severity), one report to Valve, and no critical bug. Below is the full picture, including
the parts I'm not done with.

## The Suite

Twenty harnesses, in five areas:

- **NAT traversal:** the STUN attribute parser, the ICE candidate parser, and the STUN and TURN
  handling behind them.
- **UDP packet handling:** the handler for packets from an unknown host, plus the stats message
  a connected peer can attach to any data packet.
- **SNP,** fuzzed four ways: one packet at a time, as a multi-packet sequence, as well-formed
  frames built from typed fields, and from the sender's side with malicious acks.
- **Crypto,** with five harnesses: the handshake on raw bytes, on a mutated certificate, past the
  signature check with a signing key the harness holds, from the server's side, and the real
  AES-256-GCM data path.
- **P2P signaling:** a rendezvous message to an existing connection, a connect request that
  creates one, and two peers dialing each other at once.

Around them: three oracles (ASan with UBSan, GNS's own asserts, and MemorySanitizer), two
engines, a threat model for every harness, and two seeded bugs that prove the SNP harnesses
catch what they're meant to.

## The Numbers

Line coverage across the suite, at each point in the series:

| Harnesses | Line coverage |
|---|---|
| The first five | 28% |
| Eleven | 37.6% |
| After the second campaign | 39.95% |
| All twenty | 43.71% |

I think {=trophy: 43.71% undersells it=}, because most of what's left is {=crimson: code an
attacker can't drive=}: local key management, sender-side serialization, connection lifecycle and
API code. The files that matter most sit higher (about 54% of the SNP layer's main file, for
example).

On speed, the two stateless parsers run at 40,000 to 100,000 executions a second, and most of the
connection harnesses run at a few hundred, because they rebuild a connection for every input. It
adds up anyway. One 45-minute campaign on a single harness with 14 parallel instances got through
{=static: 21.7 million executions=} (45 * 60 = 2,700 seconds, so about 8,000 a second across the
machine).

## What It Found

No critical bug. The SNP decoder, the sender-side ack accounting and the crypto handshake all
came through hundreds of millions of executions under ASan and UBSan without a memory-safety
crash. Considering CVE-2020-6016 and CVE-2020-6017 were in that same decoder, I think
{=point: GNS is a well-hardened target now=}, and I'd rather say that plainly than dress it up.

What did come out was five findings:

- **Four undefined-behavior findings:** two signed integer overflows and two out-of-range enum
  loads, all on values parsed off the wire. They only show up under UBSan and corrupt no memory,
  so I'm treating them as {=ward: hardening fixes=}, not vulnerabilities.
- **One memory-safety finding,** which I reported privately to Valve.

And {=glitch: three false positives that never left my machine=}, which I count as a result too.

## Where Things Stand

I reported the memory-safety finding through Valve's HackerOne program, and it was {=trophy: closed
as a duplicate=} of an earlier private report. So Valve already knew about it, and it isn't fixed
yet, which means {=ward: I'm not publishing anything about it until a fix ships=}.

Separately, I opened
[issue #475](https://github.com/ValveSoftware/GameNetworkingSockets/issues/475) asking the
maintainers how they'd like fuzz harnesses contributed: where they should live in the tree, how
they should hook into the build, and whether they want them shaped for OSS-Fuzz. It's only been
a few days, so I'm waiting to hear back. The harness code stays private until both of those are
settled, and then I'll link it from the [project page](/projects/gamenetworkingsockets-fuzzing/).
There's one more post to write, about the reporting side, once that story has an ending.

## What's Not Done

A few things I know are open:

- **Two harnesses reach less than I thought.** The threat models showed that the server-side
  handshake harness and the P2P connect-request harness both stop before the connection is
  accepted. Fixing them comes first.
- **MemorySanitizer hasn't had a real campaign.** The build works and replays the SNP and
  crypto corpora clean, but it hasn't run overnight yet.
- **The seeded bugs only cover SNP.** Nothing proves the handshake, P2P or NAT traversal
  harnesses catch a bug, beyond coverage.
- **Smaller items:** leak detection is still off, and I want a build that replays the corpus
  against both the pinned commit and current master to catch regressions.

## What I'd Take From It

Overall, I think the durable result here is the suite and the method, not a bug. Three things
I'd keep for the next target:

- **Coverage needs a reachability filter.** A file at 19% coverage looks like an opportunity
  until you read it and find out no attacker can reach it.
- **Most early crashes are your own harness.** Root-cause every one before it goes anywhere near
  a report.
- **A hardened target is a real result.** "I fuzzed it this thoroughly and it held" is worth
  writing down, and {=ward: the harnesses keep working after I stop=}.

The biggest thing left is {=flow: getting the harnesses upstream=}, since a project fuzzing itself
continuously will cover far more ground than my desktop ever will.
