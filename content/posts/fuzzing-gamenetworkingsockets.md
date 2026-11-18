+++
title = "Fuzzing Valve's GameNetworkingSockets: The Target And The First Harnesses"
date = 2026-11-15T10:00:00-06:00
draft = false
description = "Why I picked Valve's open-source networking library to fuzz, the pinned lab I built for it, and the first five harnesses, from a parser that takes a buffer to a real connection."
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'Docker', 'cpp', 'libFuzzer', 'Security', 'Valve']
aliases = ['/posts/reproducible-fuzzing-lab/', '/posts/first-fuzzing-harnesses/']
+++

In November 2026 I spent about a week fuzzing Valve's GameNetworkingSockets, the open-source
version of the networking API in the Steamworks SDK. These posts follow that in the order it
happened. Spoiler: {=point: I didn't find a critical bug=}, and I ended up with twenty-one
harnesses, five findings (none of them high severity) and one report to Valve. This first post is
the setup: why I picked the target, the lab I built, and the first few harnesses.

## Why GameNetworkingSockets

[GameNetworkingSockets](https://github.com/ValveSoftware/GameNetworkingSockets) (GNS from here on)
is a UDP transport for games: reliable and unreliable messages, encryption, and peer-to-peer
connections with NAT traversal (getting two machines behind home routers to reach each other).
Three things made it a good pick:

1) It's open source, so I could build it with sanitizers and coverage instrumentation.
2) The project wants this. In
   [issue #410](https://github.com/ValveSoftware/GameNetworkingSockets/issues/410), a bug report
   from someone who had been fuzzing GNS, one of the maintainers replied "I would love to add
   some fuzzing to the test suite." I couldn't find GNS in OSS-Fuzz (Google's free continuous
   fuzzing service for open-source projects) either, so harnesses are
   {=trophy: a contribution the project asked for=}.
3) A real finding has somewhere to go. The repo's
   [SECURITY.md](https://github.com/ValveSoftware/GameNetworkingSockets/blob/master/SECURITY.md)
   sends vulnerabilities to Valve's HackerOne program.

## What There Is To Attack

GNS is a lot of C++ parsing bytes from strangers, and {=crimson: a lot of it runs before any
authentication=}:

| Layer | What parses untrusted bytes | Who can reach it |
|---|---|---|
| STUN and ICE | Attribute and candidate parsing during NAT traversal | Any peer, or a spoofed STUN/TURN server, before auth |
| UDP pre-login | The handler for packets from an unknown host | Anyone who can send a UDP packet |
| Crypto handshake | Certificate and session-crypto protobufs, signature checks, key exchange | A remote peer, before session keys exist |
| P2P signaling | Rendezvous messages and connect requests | A remote peer, through the signaling channel |
| SNP | The reliability layer: data segments, acks and nacks | The peer on an established connection |

A few names in that table come up in every post:

- **STUN, ICE and TURN** are the standard protocols for NAT traversal. STUN (Session Traversal
  Utilities for NAT) lets a machine learn its public address, ICE (Interactive Connectivity
  Establishment) tries address pairs until two peers can reach each other, and TURN (Traversal
  Using Relays around NAT) relays the traffic when nothing direct works.
- **SNP** (Steam Networking Protocol) is GNS's own layer for reliability: splitting messages
  into segments, acknowledging them, and resending what got lost.
- **P2P** is peer-to-peer: two players connecting to each other instead of to a server.

GNS also has history. Check Point Research found four vulnerabilities in it in 2020, including
memory corruption in the SNP layer's segment reassembly (CVE-2020-6016 through CVE-2020-6019,
written up in [Game
On](https://research.checkpoint.com/2020/game-on-finding-vulnerabilities-in-valves-steam-sockets/)
by Eyal Itkin), and issues #409 and #410 from earlier this year are {=glitch: logic bugs in the
same reliability code=}. All of those were fixed before the version I pinned, so they were my map,
not my findings.

## The Lab

I wanted two things from the lab: a crash found today has to reproduce next month, and nothing
sensitive can land in Git by accident. So corpora and crashes live {=ward: outside every repo=}, and
everything that can change a result is pinned.

My desktop runs Windows, so the stack is Windows 11, WSL2 (Windows Subsystem for Linux) with
Ubuntu 24.04, and {=docker: Docker=} inside Ubuntu. The toolchain is one image with every pin at
the top of its Dockerfile:
```dockerfile
ARG UBUNTU_IMAGE=ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852
ARG LLVM_MAJOR=22
ARG LLVM_APT_GPG_FINGERPRINT=6084F3CF814B57C1CF12EFD515CF4D18AF4F7421
ARG AFLPLUSPLUS_TAG=v5.03c
ARG AFLPLUSPLUS_COMMIT=dbaf11913c1b2702dee5b4d3dcfffd52f1defe50
ARG CASR_VERSION=2.13.1
ARG CASR_SHA256=4a8cafc51aa68a1bff8be92b886c20c66dd4924d41ac30d9b29ac76b3f324ad4
```

The base image is pinned by digest, the LLVM compiler's apt key by fingerprint, AFL++ (the
fuzzer I use for long runs) by tag *and* commit, so a moved tag fails the build, and CASR (a
crash triage tool) by hash. The build ends with a smoke test: libFuzzer has
to find a planted heap overflow, AFL++ has to fuzz the same harness, and CASR has to triage the
crash. GNS gets its own image on top, pinned to commit `d534c19` (v1.6.1), which was the head of
master the whole time.

Three things needed fixing before fuzzers ran properly in this stack:

- **WSL shuts down when idle** and Windows likes to sleep, so a setup script stops both.
- **AFL++ refuses to start under WSL's defaults,** because WSL pipes core dumps to its own
  handler. That's a kernel setting, so it's fixed at every boot, not in the image.
- **Docker's default seccomp filter costs speed.** The
  [Trail of Bits testing handbook](https://appsec.guide/) says it can cut fuzzing throughput by
  up to half, so campaign containers run with it off.

I built all of this with {=claude: Claude Code=} doing a lot of the implementation and babysitting
the overnight runs, same as the rest of this site.

## Two Ways To Hide A Crash

The library and harnesses compile with one set of flags, including the two sanitizers that
act as crash detectors: ASan (AddressSanitizer) for memory errors and UBSan
(UndefinedBehaviorSanitizer) for undefined behavior like signed overflow.

```text
-g -O1 -fno-omit-frame-pointer
-fsanitize=address,undefined
-fno-sanitize-recover=undefined
-fno-sanitize=function,alignment,nonnull-attribute
-fsanitize-ignorelist=sanitizer-ignorelist.txt
-DFUZZING_BUILD_MODE_UNSAFE_FOR_PRODUCTION
```

Two details here matter more than they look, because the obvious setup silently hides crashes:

1) **`-fno-sanitize-recover=undefined`.** Without it, UBSan prints its report and keeps going, so
   the fuzzer {=glitch: never sees a crash=}.
2) **Overriding the CMake build type.** GNS's CMake defaults to `RelWithDebInfo`, which appends
   `-DNDEBUG` after my flags and strips the asserts. Those asserts turn out to be a whole oracle
   later, and `-DCMAKE_CXX_FLAGS_RELWITHDEBINFO=-O1` keeps them.

## The First Harnesses: Start With The Cheapest Thing

With the lab working, the first five harnesses went in order of how much setup each one needs:
two stateless parsers, the handler for packets from unknown hosts, then {=static: a real
in-process connection=} to reach the reliability layer.

The parsers for STUN and ICE are {=crimson: the first code a packet touches=} during NAT
traversal, and they're easy targets: bytes in, result out. The one obstacle is that both are
file-local inside a GNS source file. I didn't want to patch GNS, so the harness includes the
whole `.cpp`. Here's the ICE candidate harness, minus a few standard includes:
```cpp
#include "steamnetworkingsockets_ice_client.cpp"

extern "C" int LLVMFuzzerTestOneInput( const uint8_t *data, size_t size )
{
    // 1: The parser takes a NUL-terminated C string and scans for the terminator itself.
    std::string candidate( reinterpret_cast<const char *>( data ), size );

    // 2: Parse it. The result is ignored on purpose: ASan and UBSan watch for the bugs.
    SteamNetworkingSocketsLib::RFC5245CandidateAttr attribute{};
    SteamNetworkingSocketsLib::ParseRFC5245CandidateAttribute( candidate.c_str(), &attribute );
    return 0;
}
```

Its one seed is a candidate line I wrote by hand
(`candidate:1 1 udp 2130706431 192.168.1.20 27015 typ host`). That's a rule I kept for every
harness: {=ward: seeds are written, never harvested from crashes=}, so a seeds folder can never
contain an unfixed bug. Both parsers ran at 100,000 to 200,000 executions a second.

## Standing The Library Up

Next is the handler for UDP packets from a host GNS has never heard of. That needs a listen
socket, and GNS normally services sockets on a background thread, where a fuzzer can't control
when things run. GNS exports a {=arcane: manual-poll mode=} that no public header declares. Turn
it on before initializing and the service thread never starts, so the harness drives every step.

The layer with the history is SNP, GNS's reliability layer, and it only runs on an established
connection, where data packets are normally encrypted with AES-GCM. A fuzzer can't forge that
encryption, but it doesn't have to: GNS also has a NULL cipher, and two connections in the same
process can legitimately negotiate it. So the harness makes a real client and server over loopback
with encryption off, and the fuzzer's bytes arrive at the decoder as the plaintext it would see
after decryption. Three decisions here carried into every connection harness after it:

- **Inject whole packets.** Calling the decoder directly skips setup and reads uninitialized
  state, so each input goes in as a complete UDP packet through the real receive function.
- **Rebuild the connection for every input.** That drops the speed to about 500 executions a
  second, but nothing carries over between inputs.
- **Destroy connections the hard way.** A normal close leaves a connection lingering on timers
  that never advance in a tight loop, so every input leaked a socket until the run died with
  {=glitch: "too many open files"=}.

## One Packet Isn't Enough

The logic bugs in #409 and #410 live in what the receiver remembers *between* packets: which
packet numbers arrived, where the gaps are. So a second SNP harness treats one input as a
sequence of packets, each with a signed sequence-number delta, so the fuzzer can
{=static: open gaps, fill them out of order, and send duplicates=}.

The connection still has to be rebuilt between inputs. If it stays alive, a crash depends on
everything the campaign sent before, and the saved file reproduces nothing. So state builds up
within an input and resets between them, because {=point: a crash I can't
reproduce is a crash I can't report=}.

## A Second Oracle

Bugs like #410 corrupt no memory, so {=ghostly: ASan and UBSan can't see them=}. What notices is
GNS itself: it's full of internal asserts that, in a normal build, log and carry on. So the
stateful harnesses share a hook with two modes. By default asserts are logged and skipped, like a
release build. With an environment variable set, every assert is a crash:
```bash
GNS_FUZZ_ASSERT_FATAL=1 ./gns-snp-sequence-harness corpus/
```

It's noisier, since some asserts fire on malformed input by design. One of them has a comment
from the author right next to it saying they're not sure it's even possible lol. Once I've read
one and decided it's harmless, it goes on an allowlist keyed by file and line.

That made five harnesses. What I didn't know was how much of the library they reached, and that
number is what drove everything after it: [aiming the fuzzer with
coverage](/posts/low-coverage-is-not-opportunity/).
