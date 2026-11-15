+++
title = 'Writing A Threat Model For Each Fuzzing Harness'
date = 2026-11-15T10:30:00-06:00
draft = false
number = 7
description = 'Why every one of my GameNetworkingSockets harnesses comes with a written threat model, what goes in one, and two examples of the gaps it forces you to admit.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'Threat Modeling', 'Security']
+++

A fuzzing harness is always narrower than the real attack surface, and the dangerous part is
that {=ghostly: nothing tells you where=}. So every one of the twenty GameNetworkingSockets
harnesses has a short {=ward: threat model=} written next to it: who can really send these bytes,
what the harness drives, and where it cuts corners. This post is the template and two examples.

## Why Bother

"I fuzzed the STUN parser" sounds like a complete statement, and it isn't. Which function got the
bytes? Was the integrity check in front of it real or skipped? Would a crash be reachable by
anyone on the internet, or only by a peer who already knows a password? The harness source answers
all of that, but only if someone reads {=cpp: 200 lines of C++=} and already knows the library.

I think the bigger reason is that writing it down {=point: keeps me honest with myself=}. Every
harness makes simplifications to be fast or to get past a gate. Each one is fine on its own, and
each one is also a place where {=glitch: "the fuzzer found nothing"=} quietly stops meaning
"there's nothing to find." If I have to write the simplification down and say what it hides, I
can't pretend I didn't make it.

## What Goes In One

Every threat model has the same sections, {=ward: written from the defender's side=}:

1) **The surface in the real world.** How these bytes arrive in a real deployment, and who can
   send them.
2) **The trust boundary.** A two-column list: what the attacker controls, and what the harness
   fixes or trusts.
3) **What the harness drives.** The real functions the bytes flow through, by name.
4) **Assumptions and simplifications.** Everything the harness fixes, stubs or skips, and for
   each one, whether it hides surface an attacker could reach.
5) **In scope.** The bug classes this code could hold, and which oracle would catch each.
6) **Out of scope.** What this harness does not exercise, and which other harness (if any) does.
7) **Suppressions.** Every sanitizer check that's turned off for this code, and why.
8) **Reference bugs.** Public, fixed bugs that lived on this surface.

They're grounded in the pinned source, so {=iron: every claim points at a function I can go
check=}. And they describe {=crimson: attack surface and bug classes only=}. Findings don't go in
them, so a threat model is safe to publish alongside its harness.

## Example: The STUN Parser

The STUN harness fuzzes the attribute parser GNS runs on packets that arrive during NAT
traversal, {=crimson: before any connection exists=}. Its trust boundary is short:

| Attacker controls | Trusted or fixed |
|---|---|
| The packet buffer: every attribute's type, length and value | A fixed 7-byte integrity key (real callers use the ICE password) |
| The packet length | The other packet-info fields, zeroed (the parser never reads them) |
| The attribute framing, since lengths drive the walk | The output vector, owned by the harness |

The interesting entry is under simplifications. STUN messages carry a CRC and an HMAC, and the
receiver only runs the address and username decoders on a message that verifies. A fuzzer will
basically never guess a valid HMAC, so my first version of this harness only ever exercised the
code in front of the check. The current one {=arcane: forges both values=} with a key it also hands
to the parser, so well-formed inputs verify and the decoders behind the check get fuzzed too.
Edges covered went from {=trophy: about 90 to about 160=}.

That's a real trade, and the threat model has to say what it means for a crash:

- A crash in the attribute walk maps to **anyone who can reach the socket**, since that code runs
  before the sender has proven anything.
- A crash in the decoders behind the check maps to **someone who holds the ICE password**: the
  intended peer, or anyone who has observed it.

The harness forges the key to reach the code. {=point: It doesn't claim an attacker gets it for
free=}, and without the write-up I think that distinction would be the first thing to get lost.

## Example: The NULL Cipher

The SNP harnesses fuzz the reliability layer on an established connection. In production every
data packet on that connection is {=arcane: AES-256-GCM authenticated=}, so a random attacker
can't get chosen bytes anywhere near the decoder. My harnesses negotiate GNS's NULL cipher
instead, so the fuzzer's bytes arrive as plaintext without a tag to forge.

Is that cheating? The threat model's answer is that it changes {=crimson: who the attacker is=}, and
says so. The realistic sender here was never a stranger. It's the peer at the other end of the
connection, who completed the handshake, holds the session keys, and then turns hostile or runs
a modified client. That peer can encrypt whatever frames it likes, and the decoder trusts the
plaintext because the tag already vouched for it. So the NULL cipher skips the encryption, but
{=point: it doesn't skip a defense that would have stopped this attacker=}.

It does leave one thing completely dark: the decrypt path itself. The threat model lists that
under out of scope, and a later harness covers exactly that. It negotiates real AES-256-GCM
and encrypts the fuzzer's plaintext with the connection's own keys, so the tag
verifies and the real decrypt runs.

## Was It Worth It

I think so, for three reasons:

- **Gaps turn into a backlog.** An "out of scope" line like the decrypt path above is a ready-made
  description of the next harness to build.
- **A clean run means something specific.** "No crashes" only matters if you know what was
  actually exercised.
- **It's what makes a contribution reviewable.** When I [offered the harnesses
  upstream](https://github.com/ValveSoftware/GameNetworkingSockets/issues/475), the note on
  exactly what untrusted bytes reach which entry point was one of the three things I listed, since
  {=ward: a maintainer shouldn't have to take coverage on faith=}.

The cost is real though: each one is a document that has to be written, and then kept in sync when
its harness changes. I let that slip for a while, and five of the later harnesses went without
one.

When I went back and wrote those five, two of them turned out to reach less than my notes
claimed. The server-side handshake harness and the P2P connect-request harness both stop before
the connection is accepted, so {=glitch: the server's half of the key exchange never runs=} in
either one. My notes had both down as covering it. That's from reading the source, and I still
need a coverage run to confirm it, but fixing those two harnesses is now at the top of my list.
I think that's the best argument for the whole exercise: having to name, function by function,
what a harness drives is what caught it.

[The next post](/posts/fuzzing-stateful-code/) is about a bigger kind of simplification:
harnesses that set up state themselves before the fuzzer gets a turn.
