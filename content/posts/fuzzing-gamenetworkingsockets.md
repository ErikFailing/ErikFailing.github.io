+++
title = "Twenty Fuzzing Harnesses For Valve's GameNetworkingSockets"
date = 2026-11-15T10:00:00-06:00
draft = false
number = 4
description = "What I built to fuzz Valve's open-source networking library, what it found, and why no critical bug is still a result."
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'Security', 'Valve']
+++

Over the second week of November 2026 I built a fuzzing lab and {=static: twenty fuzzing harnesses=}
for Valve's GameNetworkingSockets, the open-source version of the networking API in the Steamworks
SDK. The honest headline is that I didn't find a critical bug: the library held up to hundreds of
millions of executions, and what came out was five findings (none of them high severity), a
harness suite I've
offered upstream, and a method I'd use again. This post is the overview, and the rest of the
series goes through each piece.

## Why GameNetworkingSockets

[GameNetworkingSockets](https://github.com/ValveSoftware/GameNetworkingSockets) (GNS from here on)
is a UDP transport for games: reliable and unreliable messages, fragmentation and reassembly,
encryption, and peer-to-peer connections with NAT traversal. That's a lot of C++ parsing bytes
from strangers, and {=crimson: a lot of it runs before any authentication=}:

| Layer | What parses untrusted bytes | Who can reach it |
|---|---|---|
| STUN and ICE | Attribute and candidate parsing during NAT traversal | Any peer, or a spoofed STUN/TURN server, before auth |
| UDP pre-login | The handler for packets from an unknown host | Anyone who can send a UDP packet |
| Crypto handshake | Certificate and session-crypto protobufs, signature checks, key exchange | A remote peer, before session keys exist |
| P2P signaling | Rendezvous messages and connect requests | A remote peer, through the signaling channel |
| SNP | The reliability layer: data segments, acks and nacks | The peer on an established connection |

Beyond the attack surface, I think three things made it a good pick:

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

GNS also has history, which told me where bugs like to live. Check Point Research found four
vulnerabilities in it in 2020, including memory corruption in the SNP layer's segment reassembly
(CVE-2020-6016 through CVE-2020-6019, written up in [Game
On](https://research.checkpoint.com/2020/game-on-finding-vulnerabilities-in-valves-steam-sockets/)
by Eyal Itkin), and issues #409 and #410 from earlier this year are {=glitch: logic bugs in the
same reliability code=}. All of those were fixed before the version I pinned, so they were my map,
not my findings.

## The Setup

Everything runs on my Windows 11 desktop: WSL2 underneath, and {=docker: Docker=} inside WSL2 with
a pinned toolchain image (clang and LLVM 22, AFL++ v5.03c, CASR 2.13.1). GNS is pinned too, to
commit `d534c19` (v1.6.1), which was the head of master the whole time. The idea is that {=ward: a
crash found today still reproduces next month=}, because nothing that can change a result is
allowed to drift.

I used two engines and three oracles, because each one catches things the others can't:

- **libFuzzer** for development and **AFL++ with CmpLog** for the long parallel campaigns. Every
  harness is a plain `LLVMFuzzerTestOneInput`, so the same code runs under both.
- **ASan and UBSan** as the default build, for memory safety and undefined behavior.
- **An assert oracle,** which turns GNS's own internal invariant checks into crashes. That's the
  only way to catch logic bugs like #410, which {=ghostly: corrupt no memory at all=}.
- **MemorySanitizer,** for reads of uninitialized memory, which neither ASan nor UBSan can see.

I built all of this with {=claude: Claude Code=} doing a lot of the implementation and babysitting
the overnight campaigns, same as the rest of this site. The lab gets [its own
post](/posts/reproducible-fuzzing-lab/).

## The Twenty Harnesses

The harnesses fall into five areas, matching the table above:

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

The two stateless parsers run at 40,000 to 100,000 executions a second. The stateful ones stand up
a real connection for every input, so a crash always reproduces from a single file, and {=static:
that costs speed=}: most of them run at a few hundred a second. That sounds slow, but it adds up.
One 45-minute campaign on a single harness with 14 parallel instances got through 21.7 million
executions (45 * 60 = 2,700 seconds, so about 8,000 a second across the machine).

I picked what to build next by measuring coverage and then asking who can actually reach the
uncovered code, which is its own post: [Low Coverage Isn't The Same As
Opportunity](/posts/low-coverage-is-not-opportunity/). Line coverage across the suite went from
28% with the first five harnesses, to 37.6% with eleven, to {=trophy: 43.71% with all twenty=}. I
think that number undersells it, because most of what's left is {=crimson: code an attacker can't
drive=} (local key management, sender-side serialization, connection lifecycle and API code).

## What It Found

No critical bug. The SNP decoder, the sender-side ack accounting and the crypto handshake all came
through hundreds of millions of executions under ASan and UBSan without a memory-safety crash.
Considering CVE-2020-6016 and CVE-2020-6017 were in that same decoder, I think {=point: GNS is a
well-hardened target now=}, and I'd rather say that plainly than dress it up.

What did come out was five findings:

- **Four undefined-behavior findings:** two signed integer overflows and two out-of-range enum
  loads, all on values parsed off the wire. They only show up under UBSan and corrupt no memory,
  so I'm treating them as {=ward: hardening fixes=}, not vulnerabilities.
- **One memory-safety finding,** which I reported privately to Valve. More on that below.

There were also three "findings" that turned out to be {=glitch: my own harness or build=},
including one campaign that saved 439 crashes that were all the same bug in my code lol. Those get
[their own post](/posts/my-early-crashes-were-my-own-harness/), because I think catching them
before reporting was the most important habit of the whole project.

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

## What I'd Take From It

Overall, I think the durable result here is the suite and the method, not a bug. A few things
I'd keep for the next target:

- **Coverage needs a reachability filter.** A file at 19% coverage looks like an opportunity
  until you read it and find out no attacker can reach it.
- **Most early crashes are your own harness.** Root-cause every one before it goes anywhere near
  a report.
- **A hardened target is a real result.** "I fuzzed it this thoroughly and it held" is worth
  writing down, and the harnesses keep working after I stop.

What's left is mostly running things that are already built: MemorySanitizer campaigns over the
SNP and crypto harnesses, turning on leak detection, and a build that replays the corpus against
both the pinned commit and the current master to catch regressions. And {=flow: getting the
harnesses upstream=}, since a project fuzzing itself continuously will cover far more ground than
my desktop ever will.
