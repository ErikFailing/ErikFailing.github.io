+++
title = 'Twenty-One Harnesses, No Critical Bug: The Results'
date = 2026-11-15T11:10:00-06:00
draft = false
number = 11
description = "What a week of fuzzing Valve's GameNetworkingSockets produced: the harness suite, the coverage it reached, what it found, where things stand with Valve, and what's not done."
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'Security', 'Valve']
+++

What the GameNetworkingSockets fuzzing produced: {=static: twenty-one harnesses=}, 46.24% line
coverage, five findings (none of them high severity), one report to Valve, and no critical bug.

## The Suite

- **NAT traversal** (how two machines behind routers reach each other): the STUN attribute parser,
  the ICE candidate parser, and the STUN and TURN handling behind them.
- **UDP packet handling:** the handler for packets from an unknown host, the server's
  connect-request handler entered with a valid challenge, and the stats message a connected
  peer can attach to any data packet.
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
| After fixing two harnesses | 43.79% |
| Twenty-one, after the last overnight campaign | 46.24% |

I think {=trophy: 46.24% undersells it=}, because most of what's left is code an attacker can't
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

## The Last Campaign

After fixing the two harnesses that stopped short of the accept (that story is in
[the threat model post](/posts/threat-model-per-harness/)), I ran everything that hadn't had a
long run for about eleven hours overnight: the fixed harnesses under AFL++ with both oracles,
and MemorySanitizer across thirteen harnesses.

The fixed harnesses saturated within the first couple of hours, so I used the time to build a
twenty-first. It covers the server's connect-request handler, a stretch that runs
{=crimson: before authentication=} and sat between two existing harnesses without being reached
by either. It takes the fuzzer's whole request and supplies the anti-spoofing challenge an
honest client would have been given.

The result was the same as every campaign before it: {=point: nothing new=}. MemorySanitizer
ran about 49 million executions without a single report, the new harness ran about 657
million, and every crash anything saved was a finding I already had. Coverage went from 43.79%
to 46.24%.

I came back afterward and tidied up the loose ends. MemorySanitizer now runs across the whole
suite instead of thirteen of the harnesses, and the two newest harnesses got the small
extensions they were short of (sending the same connect request twice, and accepting a
connection from inside the callback instead of after it). Same answer: no bug I didn't already
have.

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

- **The seeded bugs only cover SNP.** Nothing but coverage says the other harnesses catch a
  bug, and the other public bugs from that era can't help: one lived in a crypto library I don't
  build, and another was a 32-bit overflow that just doesn't happen on a 64-bit build. Covering
  another layer would mean writing a bug myself to catch, which is weaker evidence than a real
  one.

Overall, I think the durable result is the suite and the method, not a bug. The biggest thing
left is {=flow: getting the harnesses upstream=}, since a project fuzzing itself continuously will
cover far more ground than my desktop ever will.
