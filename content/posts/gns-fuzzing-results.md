+++
title = 'Twenty Harnesses, No Critical Bug: The Results'
date = 2026-11-15T11:10:00-06:00
draft = false
number = 11
description = "What a week of fuzzing Valve's GameNetworkingSockets produced: the harness suite, the coverage it reached, what it found, where things stand with Valve, and what's not done."
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'Security', 'Valve']
+++

What the GameNetworkingSockets fuzzing produced: {=static: twenty harnesses=}, 43.71% line
coverage, five findings (none of them high severity), one report to Valve, and no critical bug.

## The Suite

- **NAT traversal** (how two machines behind routers reach each other): the STUN attribute parser,
  the ICE candidate parser, and the STUN and TURN handling behind them.
- **UDP packet handling:** the handler for packets from an unknown host, plus the stats message a
  connected peer can attach to any data packet.
- **SNP,** the reliability layer, fuzzed four ways: one packet at a time, as a multi-packet
  sequence, as well-formed frames built from typed fields, and from the sender's side with
  malicious acks.
- **Crypto,** with five harnesses: the handshake on raw bytes, on a mutated certificate, past the
  signature check with a signing key the harness holds, from the server's side, and the real
  AES-256-GCM data path.
- **Peer-to-peer signaling:** a rendezvous message to an existing connection, a connect request
  that creates one, and two peers dialing each other at once.

| Harnesses | Line coverage |
|---|---|
| The first five | 28% |
| Eleven | 37.6% |
| After the second campaign | 39.95% |
| All twenty | 43.71% |

I think {=trophy: 43.71% undersells it=}, because most of what's left is code an attacker can't
drive: local key management, sender-side serialization, lifecycle and API code.

## What It Found

No critical bug. The SNP decoder, the ack accounting and the crypto handshake all came through
hundreds of millions of executions under ASan and UBSan (the memory and undefined-behavior
sanitizers) without a memory-safety crash. Considering CVE-2020-6016 and CVE-2020-6017 were in
that same decoder, I think {=point: GNS is a well-hardened target now=}.

What did come out:

- **Four undefined-behavior findings:** two signed integer overflows and two out-of-range enum
  loads, all on values parsed off the wire. They only show up under UBSan and corrupt no memory,
  so I'm treating them as {=ward: hardening fixes=}, not vulnerabilities.
- **One memory-safety finding,** which I reported privately to Valve.

## Where Things Stand

I reported the memory-safety finding through Valve's HackerOne program, and it was {=trophy: closed
as a duplicate=} of an earlier private report. Valve already knew about it and it isn't fixed
yet, so I'm not publishing anything about it until a fix ships.

I also opened
[issue #475](https://github.com/ValveSoftware/GameNetworkingSockets/issues/475) asking the
maintainers how they'd like the harnesses contributed. It's only been a few days, so I'm
waiting to hear back. The harness code stays private until both are settled, and then I'll link
it from the [project page](/projects/gamenetworkingsockets-fuzzing/).

## What's Not Done

- **Two harnesses reach less than I thought.** The server-side handshake harness and the
  peer-to-peer connect-request harness both stop before the connection is accepted. Fixing them
  comes first.
- **MemorySanitizer hasn't had a real campaign.** The build works and replays the SNP and crypto
  corpora clean, but it hasn't run overnight.
- **The seeded bugs only cover SNP.** Nothing but coverage says the other harnesses catch a bug.

Overall, I think the durable result is the suite and the method, not a bug. The biggest thing
left is {=flow: getting the harnesses upstream=}, since a project fuzzing itself continuously will
cover far more ground than my desktop ever will.
