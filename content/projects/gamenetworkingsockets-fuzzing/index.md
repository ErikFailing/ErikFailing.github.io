+++
title = "Fuzzing Valve's GameNetworkingSockets"
description = "A reproducible fuzzing lab and twenty harnesses for Valve's open-source game networking library, aimed at the code a remote attacker can actually reach."
date = 2026-11-15T09:00:00-06:00
draft = false
number = 2
aliases = ['/series/fuzzing-gamenetworkingsockets/']
status = 'Harnesses offered upstream, waiting on the maintainers'
role = 'Solo, personal research'
year = 2026
tags = ['Fuzzing', 'Security', 'Valve', 'cpp', 'libFuzzer', 'aflplusplus', 'Sanitizers', 'libprotobuf-mutator', 'CASR', 'Docker']
featured = true
weight = 10
[[links]]
  name = 'Upstream issue #475'
  url = 'https://github.com/ValveSoftware/GameNetworkingSockets/issues/475'
[[links]]
  name = 'GameNetworkingSockets on GitHub'
  url = 'https://github.com/ValveSoftware/GameNetworkingSockets'
+++

[GameNetworkingSockets](https://github.com/ValveSoftware/GameNetworkingSockets) (GNS) is Valve's
open-source game networking library, the open version of the networking API in the Steamworks
SDK. It parses untrusted UDP packets in C++ at several layers, a lot of it before any
authentication, so in November 2026 I built a fuzzing lab around it and {=static: twenty fuzzing
harnesses=} that cover the code a remote attacker can actually reach.

The honest headline is that {=point: I didn't find a critical bug=}. GNS held up to hundreds of
millions of executions, and what came out was a handful of findings (none of them high severity),
a harness suite I've offered to the project, and a method I'd use again on the next target.

## Why this target

- It's open source, so coverage-guided fuzzing with sanitizers is possible.
- I couldn't find it in OSS-Fuzz, and in
  [issue #410](https://github.com/ValveSoftware/GameNetworkingSockets/issues/410) one of the maintainers said they "would love to add some fuzzing to the test suite", so harnesses are
  something the project actually wants.
- Valve takes security reports for it through HackerOne, so a real finding has somewhere to go.

## What I built

- **A reproducible lab.** Windows 11, WSL2 and {=docker: Docker=}, with everything that can change
  a result pinned: clang and LLVM 22, AFL++ v5.03c, CASR 2.13.1, the base image, and GNS itself at
  v1.6.1.
- **Twenty harnesses,** all plain `LLVMFuzzerTestOneInput`, so the same code runs under libFuzzer
  and AFL++. They cover the STUN and ICE code used for NAT traversal, the pre-connection UDP
  handler, the SNP reliability layer, the crypto handshake and the AES-256-GCM data path, and
  peer-to-peer signaling. Five of them mutate real protobuf messages with libprotobuf-mutator
  instead of raw bytes.
- **Three oracles.** ASan with UBSan for memory safety and undefined behavior, an assert oracle
  that turns the library's own invariant checks into crashes, and a MemorySanitizer build with the
  whole dependency stack instrumented.
- **{=ward: A threat model for every harness=},** saying what untrusted bytes reach which function,
  and where the harness is narrower than the real attack surface.
- **A seeded-bug check.** Two known, fixed, public bugs (CVE-2020-6017 and issue #410) get put
  back into the pinned source to prove the harnesses actually catch them.
- **Campaign tooling:** coverage reports, corpus minimization, parallel AFL++ runs with CmpLog,
  and crash triage with CASR.

## Results

- Line coverage across the suite went from 28% with the first five harnesses to {=trophy: 43.8% with
  all twenty=}. Most of what's left isn't code an attacker can drive.
- No high-severity bug. The parts with a history of memory-safety bugs, like the SNP decoder,
  came through clean.
- Five findings: four are undefined behavior on values parsed off the wire (signed overflows and
  out-of-range enum loads, visible only under UBSan), and one is a memory-safety finding I
  reported privately to Valve.
- Three false positives, each traced to my own harness or build before it went anywhere near a
  report.

## Where it stands

I reported the memory-safety finding through Valve's HackerOne program, and it was closed as a
duplicate of an earlier private report. So Valve already knows about it, and {=ward: the details
stay private until a fix ships=}.

I also opened
[issue #475](https://github.com/ValveSoftware/GameNetworkingSockets/issues/475) asking the
maintainers how they'd like the harnesses contributed, and I'm waiting to hear back. Until both
of those are settled the harness code isn't public. When it is, it'll be linked here.
