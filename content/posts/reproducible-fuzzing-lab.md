+++
title = 'A Reproducible Fuzzing Lab On Windows, WSL2 And Docker'
date = 2026-11-15T10:10:00-06:00
draft = false
number = 5
description = 'The pinned toolchain, build flags, engines and oracles behind the GameNetworkingSockets fuzzing, and the build mistakes that would have hidden real crashes.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'Docker', 'Security']
+++

The lab behind the GameNetworkingSockets fuzzing is my Windows 11 desktop running WSL2, with
{=docker: Docker=} inside WSL2 and one toolchain image where everything that can change a result is
pinned. This post covers that setup, the build flags, the two engines and three oracles, and a
couple of build mistakes that would have quietly hidden crashes if I hadn't caught them.

## The Goal

I wanted two things out of the lab:

1) **A crash found today reproduces next month.** That means the compiler, the fuzzers, the base
   image and the target's commit can't drift under me.
2) **Nothing sensitive lands in Git by accident.** Corpora, crashes and triage output all live
   under `~/research/` on the Linux side, {=ward: outside every repo=}. An unfixed crash sitting one
   `git add .` away from a commit is a mistake waiting to happen.

My desktop runs Windows, so the stack is Windows 11, then WSL2 with Ubuntu 24.04, then Docker
Engine inside Ubuntu. I think that's {=point: the right amount of indirection=}: the fuzzers get a
real Linux kernel, and the same image would run unchanged in CI or on a rented Linux box.

## Pinning The Toolchain

The toolchain image is one Dockerfile with every pin at the top:

```dockerfile
ARG UBUNTU_IMAGE=ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852
ARG LLVM_MAJOR=22
ARG LLVM_APT_GPG_FINGERPRINT=6084F3CF814B57C1CF12EFD515CF4D18AF4F7421
ARG AFLPLUSPLUS_TAG=v5.03c
ARG AFLPLUSPLUS_COMMIT=dbaf11913c1b2702dee5b4d3dcfffd52f1defe50
ARG CASR_VERSION=2.13.1
ARG CASR_SHA256=4a8cafc51aa68a1bff8be92b886c20c66dd4924d41ac30d9b29ac76b3f324ad4
```

Each one is {=iron: pinned the strongest way its source allows=}:

- **The base image** by digest, not by tag.
- **clang and LLVM 22** from apt.llvm.org, with the repository's signing key {=arcane: checked against a
  pinned fingerprint=} before apt trusts it. That repo only keeps the newest build of each major
  version, so the image also writes the exact versions it was built with (22.1.8 right now) to a
  file inside itself.
- **{=static: AFL++=}** by tag *and* commit. If the tag ever moves upstream, the build fails instead of
  quietly changing what I fuzz with.
- **CASR** (the crash triage tool) as a prebuilt release checked against its SHA-256.

The build ends with a smoke test: libFuzzer with ASan has to find a planted heap overflow in a
tiny harness, AFL++ has to fuzz the same harness, and CASR has to triage the crash. So I know
{=ward: the whole toolchain works end to end=} before any campaign depends on it.

GameNetworkingSockets gets its own image on top of that one, with its build dependencies
(protobuf and OpenSSL), libprotobuf-mutator pinned to a commit, and the GNS source at commit
`d534c19` (v1.6.1). One thing that saved me a fight: my toolchain image is stock Ubuntu, so
everything compiles against the default libstdc++. OSS-Fuzz's base image compiles against libc++
instead, which {=glitch: clashes with Ubuntu's protobuf packages=}.

## WSL2 And Docker Gotchas

A few things needed fixing before fuzzers would run properly in this stack:

- **WSL shuts itself down when idle,** and Windows likes to sleep. A setup script stops both, so
  an overnight campaign is still running in the morning.
- **AFL++ refuses to start under WSL's defaults.** WSL pipes core dumps to its own handler, and
  AFL++ wants `core_pattern` set to a plain file name. That's a kernel setting, so the image can't
  fix it; the Ubuntu setup script sets it at every boot.
- **Docker's default seccomp filter costs speed.** The
  [Trail of Bits testing handbook](https://appsec.guide/) says it can {=static: cut fuzzing throughput by
  up to half=}, so campaign containers run with it off:

```bash
docker run --rm -it --user "$(id -u):$(id -g)" --env HOME=/tmp --cap-add=SYS_PTRACE \
  --security-opt seccomp=unconfined -v "$PWD:/work" fuzzing-toolchain:latest
```

## Build Flags, And Two Ways To Hide A Crash

The library and the harnesses compile with one set of flags:

```text
-g -O1 -fno-omit-frame-pointer
-fsanitize=address,undefined
-fno-sanitize-recover=undefined
-fno-sanitize=function,alignment,nonnull-attribute
-fsanitize-ignorelist=sanitizer-ignorelist.txt
-DFUZZING_BUILD_MODE_UNSAFE_FOR_PRODUCTION
```

Two things in this build are there because my first plan got them wrong:

1) **`-fno-sanitize-recover=undefined`.** Without it, UBSan prints its report and keeps going, so
   the fuzzer {=glitch: never sees a crash=}. Every UBSan finding in this project would have scrolled
   past in a log nobody reads.
2) **Overriding the CMake build type.** GNS's CMake sets the build type to `RelWithDebInfo` when
   you don't give one, which appends `-O2 -g -DNDEBUG` after my flags. That strips the asserts,
   and {=ward: the asserts are a whole oracle=} (below). Passing
   `-DCMAKE_CXX_FLAGS_RELWITHDEBINFO=-O1` keeps them.

The `-fno-sanitize=` line turns off three UBSan checks that GNS trips on code that's fine in
practice (unaligned reads of wire fields, for example). The ignorelist is narrower: it has
exactly two entries, each one a deliberate pattern in GNS like a two's-complement wraparound when
rebuilding a truncated packet number. I'd rather suppress by file and function than turn a check
off everywhere, because {=ward: every suppression is a place a real bug can hide=}.

## Two Engines

Every harness is a plain `LLVMFuzzerTestOneInput`, so {=static: the same source runs under both engines=}:

- **libFuzzer** for development. It's the simplest to run, and it prints per-input progress, so I
  can tell in a minute whether a new harness is reaching anything.
- **AFL++** for long campaigns, run in parallel the way its docs recommend: one main instance,
  the rest secondaries, all syncing through one output directory.

```bash
afl-fuzz -i seeds -o afl-output -M main -c ./harness.cmplog -l 2AT -- ./harness
afl-fuzz -i seeds -o afl-output -S sec1 -p explore -- ./harness
afl-fuzz -i seeds -o afl-output -S sec2 -p exploit -- ./harness
```

The `-c` binary is a second build of the harness with {=static: CmpLog=}, which watches the operands of
comparisons and feeds them back into the input. That's how the fuzzer {=arcane: gets past magic values=} (a
marker byte, a length, the STUN magic cookie) without brute forcing them. The main and every
third secondary run CmpLog, and the others rotate through AFL++'s power schedules so the
instances don't all do the same work.

## Three Oracles

An oracle is whatever decides a run found a bug, and one isn't enough:

- **ASan and UBSan** are the default: out-of-bounds access, use-after-free, and undefined
  behavior like signed overflow.
- **The assert oracle.** GNS has debug asserts that log and carry on. With an environment
  variable set, my harnesses turn those into crashes. That catches {=ghostly: logic bugs that corrupt no
  memory=}, and it's noisier, since some asserts fire on malformed input by design.
- **MemorySanitizer,** for reads of uninitialized memory. MSan {=glitch: false-positives on any code it
  didn't instrument=}, so this is a separate image where libc++, protobuf and OpenSSL are all
  built from source under MSan. It took a few tries (and one false alarm) to get there, which is
  in [the triage post](/posts/my-early-crashes-were-my-own-harness/).

Coverage is a fourth build, with `-fprofile-instr-generate -fcoverage-mapping` and no sanitizers.
A sanitizer build can't measure coverage, and I think it's worth keeping the two apart: one
build finds bugs, the other tells me {=point: where the fuzzers have never been=}. What I did with
that map is [the next post](/posts/low-coverage-is-not-opportunity/).
