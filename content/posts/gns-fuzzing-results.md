+++
title = 'Threat Models, And No Critical Bug: The Results'
date = 2026-11-15T11:10:00-06:00
draft = false
number = 7
description = "Giving every GameNetworkingSockets harness a written threat model (which caught two doing less than I thought), and the final tally: twenty-one harnesses, the coverage, what it found, and where it stands with Valve."
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'Threat Modeling', 'Security', 'Valve']
aliases = ['/posts/threat-model-per-harness/']
+++

The last stretch of the project was an audit: a written threat model for every harness, which
caught two of them doing less than I thought. Then the tally. The short version is twenty-one
harnesses, 46.24% line coverage, five findings (none of them high severity), one report to Valve,
and no critical bug.

## A Threat Model Per Harness

A fuzzing harness is always narrower than the real attack surface, and {=ghostly: nothing tells
you where=}. So each harness has a short {=ward: threat model=} next to it: who can really send
these bytes, what the harness drives, and where it cuts corners.

"I fuzzed the STUN parser" sounds complete and isn't. Which function got the bytes? Was the
integrity check real or skipped? Would a crash be reachable by anyone, or only a peer who knows a
password? Every threat model answers that in the same sections:

1) **The surface in the real world:** how the bytes arrive, and who can send them.
2) **The trust boundary:** what the attacker controls, and what the harness fixes.
3) **What the harness drives:** the real functions the bytes flow through, by name.
4) **Simplifications:** everything the harness fixes, stubs or skips, and what each one hides.
5) **In scope and out of scope:** the bug classes and oracles, and what another harness covers.

They describe {=crimson: attack surface and bug classes only=}, never findings, so they're safe to
publish with the harness.

## Example: The STUN Parser

STUN messages carry a checksum (a CRC) and a keyed signature (an HMAC), and the receiver only runs
the address and username decoders on a message that verifies. A fuzzer will basically never guess
a valid HMAC, so without help it only exercises the code in front of the check. The harness
{=arcane: forges both values=} with a key it also hands to the parser, which took the edges
covered from about 90 to about 160.

That's a real trade, and the threat model says what it means for a crash:

- In the attribute walk, it maps to **anyone who can reach the socket**.
- In the decoders behind the check, it maps to **someone who holds the ICE password** (a secret
  the two peers swap while setting up the connection).

The harness forges the key to reach the code. {=point: It doesn't claim an attacker gets it for
free=}.

## Example: The NULL Cipher

In production every data packet in SNP (the reliability layer) is encrypted and authenticated
with AES-256-GCM. My harnesses negotiate the NULL cipher, so the fuzzer's bytes arrive as
plaintext. Is that cheating? The threat model's answer is that it changes {=crimson: who the
attacker is=}. The realistic sender was never a stranger. It's the peer on the other end, who
completed the handshake, holds the session keys, and turns hostile. That peer can encrypt whatever
it likes, so the NULL cipher doesn't skip a defense that would have stopped them.

It does leave the decrypt path itself dark. That's listed as out of scope, and a later harness
covers it by negotiating real AES-256-GCM and encrypting the fuzzer's plaintext with the
connection's own keys.

## What Writing Them Caught

The cost is that each one has to be written and kept in sync. I let that slip, and five of the
later harnesses went without one. When I went back and wrote those five, two turned out to reach
less than my notes claimed. The server-side handshake harness and the peer-to-peer
connect-request harness both stopped before the connection was accepted, so {=glitch: the server's
half of the key exchange never ran=} in either one. The connect-request harness was worse than
that: its seed failed an identity check, so it had never created a connection at all.

Both fixes were small. Each harness now accepts the connection the way an application would, and
the seed is regenerated so it passes. A coverage run confirmed it: the connect-request harness
went from covering 2.5% of the peer-to-peer ICE setup file to {=trophy: 31%=}, and the server
harness now reaches the connected state with a negotiated cipher. Having to name, function by
function, what a harness drives is what caught it.

## The Suite

The twenty-one harnesses, by area:

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

Coverage climbed as the suite grew:

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

No critical bug. Across the suite, hundreds of millions of executions under ASan and UBSan turned
up no memory-safety crash. Considering this library had four memory-corruption CVEs in 2020, I
think {=point: GNS is a well-hardened target now=}.

What did come out:

- **Four undefined-behavior findings:** two signed integer overflows and two out-of-range enum
  loads, all on values parsed off the wire. They only show up under UBSan and corrupt no memory,
  so I'm treating them as {=ward: hardening fixes=}, not vulnerabilities.
- **One memory-safety finding,** which I reported privately to Valve.

## The Last Campaign

With those two harnesses fixed, I ran everything that hadn't had a long run for about eleven hours
overnight: the fixed harnesses under AFL++ with both oracles, and MemorySanitizer across the
suite. They saturated within the first couple of hours, so I used the time to build a twenty-first
harness. It covers the server's connect-request handler, a stretch that runs {=crimson: before
authentication=} and sat between two existing harnesses without being reached by either; it takes
the fuzzer's whole request and supplies the anti-spoofing challenge an honest client would have
been given.

The result was the same as every campaign before it: {=point: nothing new=}. MemorySanitizer ran
tens of millions of executions without a single new finding, the new harness ran hundreds of
millions, and every crash anything saved was a finding I already had. Coverage went from 43.79% to
46.24%.

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
