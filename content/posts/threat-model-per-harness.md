+++
title = 'Writing A Threat Model For Each Fuzzing Harness'
date = 2026-11-15T11:00:00-06:00
draft = false
number = 10
description = 'Every one of my GameNetworkingSockets harnesses has a written threat model. What goes in one, two examples, and the two harness gaps that writing them caught.'
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'Threat Modeling', 'Security']
+++

A fuzzing harness is always narrower than the real attack surface, and {=ghostly: nothing tells
you where=}. So each of the twenty harnesses has a short {=ward: threat model=} next to it: who can
really send these bytes, what the harness drives, and where it cuts corners. Finishing the last
five caught two harnesses that reach less than I thought.

## What Goes In One

"I fuzzed the STUN parser" sounds complete and isn't. Which function got the bytes? Was the
integrity check real or skipped? Would a crash be reachable by anyone, or only a peer who knows
a password? Every threat model answers that in the same sections:

1) **The surface in the real world:** how the bytes arrive, and who can send them.
2) **The trust boundary:** what the attacker controls, and what the harness fixes.
3) **What the harness drives:** the real functions the bytes flow through, by name.
4) **Simplifications:** everything the harness fixes, stubs or skips, and what each one hides.
5) **In scope and out of scope:** the bug classes and oracles, and what another harness covers.

They describe {=crimson: attack surface and bug classes only=}, never findings, so they're safe to
publish with the harness.

## Example: The STUN Parser

STUN messages carry a CRC and an HMAC, and the receiver only runs the address and username
decoders on a message that verifies. A fuzzer will basically never guess a valid HMAC, so
without help it only exercises the code in front of the check. The harness
{=arcane: forges both values=} with a key it also hands to the parser, which took the edges
covered from about 90 to about 160.

That's a real trade, and the threat model says what it means for a crash:

- In the attribute walk, it maps to **anyone who can reach the socket**.
- In the decoders behind the check, it maps to **someone who holds the ICE password**.

The harness forges the key to reach the code. {=point: It doesn't claim an attacker gets it for
free=}.

## Example: The NULL Cipher

In production every SNP data packet is AES-256-GCM authenticated. My harnesses negotiate the
NULL cipher, so the fuzzer's bytes arrive as plaintext. Is that cheating? The threat model's
answer is that it changes {=crimson: who the attacker is=}. The realistic sender was never a
stranger. It's the peer on the other end, who completed the handshake, holds the session keys,
and turns hostile. That peer can encrypt whatever it likes, so the NULL cipher doesn't skip a
defense that would have stopped them.

It does leave the decrypt path itself dark. That's listed as out of scope, and a later harness
covers it by negotiating real AES-256-GCM and encrypting the fuzzer's plaintext with the
connection's own keys.

## What Writing Them Caught

The cost is that each one has to be written and kept in sync. I let that slip, and five of the
later harnesses went without one.

When I went back and wrote those five, two turned out to reach less than my notes claimed. The
server-side handshake harness and the P2P connect-request harness both stop before the
connection is accepted, so {=glitch: the server's half of the key exchange never runs=} in either
one. That's from reading the source, and I still need a coverage run to confirm it, but fixing
those two is now at the top of my list. Having to name, function by function, what a harness
drives is what caught it.

What it all added up to is [the final post](/posts/gns-fuzzing-results/).
