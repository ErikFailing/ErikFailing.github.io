+++
title = "Fuzzing Valve's GameNetworkingSockets: The Target And The Lab"
date = 2026-11-15T10:00:00-06:00
draft = false
number = 4
description = "Why I picked Valve's open-source networking library to fuzz, what its attack surface looks like, and the pinned lab I built to do it."
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'Docker', 'Security', 'Valve']
aliases = ['/posts/reproducible-fuzzing-lab/']
+++

In November 2026 I spent about a week fuzzing Valve's GameNetworkingSockets, the open-source
version of the networking API in the Steamworks SDK. These posts follow that in the order it
happened. Spoiler: {=point: I didn't find a critical bug=}, and I ended up with twenty harnesses,
five findings (none of them high severity) and one report to Valve. This first post is why I
picked the target and the lab I built for it.

## Why GameNetworkingSockets

[GameNetworkingSockets](https://github.com/ValveSoftware/GameNetworkingSockets) (GNS from here on)
is a UDP transport for games: reliable and unreliable messages, encryption, and peer-to-peer
connections with NAT traversal. Three things made it a good pick:

1) It's open source, so I could build it with sanitizers and coverage instrumentation.
2) The project wants this. In
   [issue #410](https://github.com/ValveSoftware/GameNetworkingSockets/issues/410), a bug report
   from someone who had been fuzzing GNS, one of the maintainers replied "I would love to add
   some fuzzing to the test suite." I couldn't find GNS in OSS-Fuzz either, so harnesses are
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

It also has history. Check Point Research found four vulnerabilities in it in 2020, including
memory corruption in the SNP layer's segment reassembly (CVE-2020-6016 through CVE-2020-6019,
written up in
[Game On](https://research.checkpoint.com/2020/game-on-finding-vulnerabilities-in-valves-steam-sockets/)
by Eyal Itkin), and issues #409 and #410 from earlier this year are {=glitch: logic bugs in the same
reliability code=}. All of those were fixed before the version I pinned, so they were my map, not
my findings.

## The Lab

I wanted two things from the lab: a crash found today has to reproduce next month, and nothing
sensitive can land in Git by accident. So corpora and crashes live {=ward: outside every repo=}, and
everything that can change a result is pinned.

My desktop runs Windows, so the stack is Windows 11, WSL2 with Ubuntu 24.04, and {=docker: Docker=}
inside Ubuntu. The toolchain is one image with every pin at the top of its Dockerfile:

```dockerfile
ARG UBUNTU_IMAGE=ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852
ARG LLVM_MAJOR=22
ARG LLVM_APT_GPG_FINGERPRINT=6084F3CF814B57C1CF12EFD515CF4D18AF4F7421
ARG AFLPLUSPLUS_TAG=v5.03c
ARG AFLPLUSPLUS_COMMIT=dbaf11913c1b2702dee5b4d3dcfffd52f1defe50
ARG CASR_VERSION=2.13.1
ARG CASR_SHA256=4a8cafc51aa68a1bff8be92b886c20c66dd4924d41ac30d9b29ac76b3f324ad4
```

The base image is pinned by digest, LLVM's apt key by fingerprint, AFL++ by tag *and* commit (so
a moved tag fails the build), and CASR by hash. The build ends with a smoke test: libFuzzer has
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

## Two Ways To Hide A Crash

The library and harnesses compile with one set of flags:

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
   the fuzzer {=glitch: never sees a crash=}. My first plan didn't have it.
2) **Overriding the CMake build type.** GNS's CMake defaults to `RelWithDebInfo`, which appends
   `-DNDEBUG` after my flags and strips the asserts. Those asserts turn out to be a whole oracle
   later, and `-DCMAKE_CXX_FLAGS_RELWITHDEBINFO=-O1` keeps them.

I built all of this with {=claude: Claude Code=} doing a lot of the implementation and babysitting
the overnight runs, same as the rest of this site. With the lab working, the next step was
something to run in it: [the first harnesses](/posts/first-fuzzing-harnesses/).
