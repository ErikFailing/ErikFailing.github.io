+++
title = 'Proving A Fuzzer Works By Putting Old Bugs Back'
date = 2026-11-15T11:00:00-06:00
draft = false
number = 10
description = 'A clean fuzzing run only means something if the harness could have caught a bug. How I re-introduced two fixed GameNetworkingSockets bugs to check that mine do.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'Security']
+++

My GameNetworkingSockets fuzzing mostly found nothing, and "nothing" has two very different
explanations: the code is solid, or {=glitch: my harnesses are broken=}. To tell them apart, I took
two known, already-fixed, public bugs, put each one back into the pinned source, and checked
that the harness meant to catch it actually does. Both got caught. This post is how that check
works.

## The Problem With A Clean Run

A fuzzer that reports zero crashes {=ghostly: looks exactly the same=} whether it's exercising
hardened code or bouncing off the first length check forever. Coverage numbers help, but they only
say the code *ran*. They don't say the oracle would have fired if something went wrong in there.
My first build plan had UBSan printing its findings and carrying on without crashing, so the
fuzzer would never have noticed (that one's in [the lab post](/posts/reproducible-fuzzing-lab/)).

The idea of testing fuzzers against known bugs isn't mine.
[Magma](https://hexhive.epfl.ch/magma/) does it as a benchmark, by forward-porting real bugs
into current versions of open-source libraries. I did a small version of the same thing in the
other direction: {=point: revert a real fix on the version I'm fuzzing=} and see if I find the bug
again.

## Why This Is Safe To Publish

Everything in this post is about bugs that are {=ward: public and fixed upstream=}. Reverting a
public fix on an old pinned version doesn't reveal anything new: it rebuilds a vulnerability the
vendor already shipped a fix for and the world already knows about. That's a hard line for me. A
revert patch is never allowed to describe an unfixed bug, and findings from the live code stay
private until they're fixed.

## How A Seeded Bug Is Defined

Each seeded bug is a small directory with up to three files:

- **`revert.patch`** undoes the upstream fix, putting the bug back in the library.
- **`bug.json`** says which harness should catch it, with which oracle, and what the crash has to
  look like.
- **`trigger.bin`** (optional) is an input I wrote {=arcane: by hand from the wire format=} that
  triggers the bug directly.

Here's the patch for [CVE-2020-6017](https://nvd.nist.gov/vuln/detail/CVE-2020-6017), a heap
overflow in the code that reassembles unreliable message segments, one of the four bugs {=crimson:
Check Point Research=} found in 2020:
```diff
 			// Check if offset+size indicates a message larger than what we support.  (Also,
 			// protect against malicious sender sending *extremely* large offset causing overflow.)
-			if ( (int64)nOffset + cbSegmentSize > k_cbMaxUnreliableMsgSizeRecv || cbSegmentSize > k_cbMaxUnreliableSegmentSizeRecv )
+			// SEEDED BUG (CVE-2020-6017, evaluation only): the per-segment size cap that bounds the memcpy
+			// into the fixed SSNPRecvUnreliableSegmentData::m_buf below has been removed, so an over-long
+			// unreliable segment overflows that buffer.
+			if ( (int64)nOffset + cbSegmentSize > k_cbMaxUnreliableMsgSizeRecv )
```

The revert removes one condition. Without it, a segment longer than the fixed 1,300-byte
reassembly buffer gets copied straight in. My trigger is a single segment of 1,347 bytes, so it
{=flood: overflows the buffer by 47 bytes=}. And the metadata that goes with it (trimmed):

```json
{
  "id": "cve-2020-6017-unreliable-overflow",
  "class": "heap-buffer-overflow",
  "harness": "gns-snp-data-harness",
  "oracle": "default",
  "trigger": "trigger.bin",
  "expect_signature": "heap-buffer-overflow",
  "expect_location": "steamnetworkingsockets_snp.cpp",
  "budget_seconds": 300
}
```

## The Two Checks

The runner builds a patched copy of the library, rebuilds only the one harness named in
`bug.json`, and runs two checks:

1) **Verify.** Replay the hand-written trigger once and look for the expected crash. This is
   deterministic, and {=iron: it proves the plumbing=}: the revert is live, the harness reaches
   the code, and the oracle fires.
2) **Discover.** Fuzz from the harness's normal seeds and corpus for the time budget (five minutes
   here), collect every crash, and scan them for the expected signature. This is the one that says
   the fuzzer {=static: finds the bug by itself=}, without being handed the answer.

A bug only counts as caught when the crash has the specific expected signature, in the expected
file, from the designated harness and oracle. {=point: Some other crash doesn't count=}.

## A Bug No Sanitizer Can See

The second seeded bug is
[issue #410](https://github.com/ValveSoftware/GameNetworkingSockets/issues/410), and I picked
it because it's the opposite kind. A "stop waiting" frame can advance past a sentinel entry in
the map that tracks missing packets, which corrupts the map's bookkeeping. It doesn't touch
memory it shouldn't, so {=ghostly: ASan and UBSan stay completely silent=}.

Two things have to be right to catch it:

- **The oracle.** Only GNS's own invariant check notices, so the harness has to run with the
  assert oracle on, where {=ward: a failed internal assert counts as a crash=}.
- **The harness.** The bug needs {=static: state built up across several packets=} (gaps in the
  packet numbers, then a frame that trims them). My single-packet harness can never get there. The
  multi-packet one can.

There's no hand-written trigger for this one, on purpose. The same harness also reaches a
different, harmless assert nearby (the code comment on it literally says the author isn't sure
it's even possible), and a single crafted input could trip that one first and {=glitch: hide the
real target=}. So the check is discovery only: fuzz, keep every crash, and look through all of
them for the sentinel message. That's also why the runner scans instead of stopping at the first
crash.

One assert-oracle run for this bug saved 470 crash files. Triage with CASR collapsed them to
{=trophy: one distinct crash=}, the right one. That was a nice confirmation of the triage tooling
too, since 470 files looks a lot scarier than one bug.

## What It Proves, And What It Doesn't

Between them, the two bugs cover both oracles (memory safety and asserts) and two different
harnesses. So when the single-packet SNP harness runs clean under ASan, I know it can catch a heap
overflow in that decoder, because it did. Same for the multi-packet harness and reliability logic
bugs. I think that's what {=point: turns "the suite probably works" into evidence=}.

It's a small sample though, and I don't want to oversell it:

- **Two bugs, one layer.** Both are in SNP. Nothing is seeded yet for the handshake, P2P or NAT
  traversal harnesses, so those are {=iron: still on trust plus coverage=}.
- **Known bugs are the easy case.** Catching a bug I knew to aim at doesn't prove I'd catch a
  different one a few lines over.
- **Next up** are issue #409 and CVE-2020-6016, which are both on this same layer.

One practical gotcha if you try this on Windows: make the revert patch inside the Linux
container, against the pristine source. A patch made from a Windows checkout can pick up CRLF
line endings and then fail to apply.
