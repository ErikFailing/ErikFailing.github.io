+++
title = 'A Flat Line Overnight, And Proving It Means Something'
date = 2026-11-15T10:30:00-06:00
draft = false
number = 7
description = 'Running the GameNetworkingSockets harnesses overnight under AFL++, what a coverage number that stops moving tells you, and putting two old bugs back to prove the harnesses can catch one.'
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'aflplusplus', 'CASR', 'Security']
aliases = ['/posts/seeded-bug-evaluation/']
+++

I left every harness I had (eleven at that point) running overnight under {=aflplusplus: AFL++=},
and total coverage {=point: didn't move all night=}. That has two explanations: the harnesses have
reached everything they can, or they're broken. This post is the overnight setup, and how I told
those apart by putting two fixed bugs back into the library.

## Same Harnesses, Second Engine

Every harness is a plain `LLVMFuzzerTestOneInput`, so nothing in the harness code changed for
AFL++. The build compiles everything again through AFL++'s compiler, plus a copy of each harness
built for {=static: CmpLog=}, which feeds the operands of comparisons back into the input so the
fuzzer gets past magic values without brute forcing them. Then it runs in parallel, one main
instance and the rest secondaries:

```bash
afl-fuzz -i seeds -o afl-output -M main -c ./harness.cmplog -l 2AT -- ./harness
afl-fuzz -i seeds -o afl-output -S sec1 -p explore -- ./harness
afl-fuzz -i seeds -o afl-output -S sec2 -p exploit -- ./harness
```

Long runs make two piles. For the corpus, libFuzzer's `-merge=1` shrinks it to the smallest set
with the same coverage, and my script {=ward: refuses the result unless nothing was lost=}. For
crashes, [CASR](https://github.com/ispras/casr) replays every file and clusters them by stack,
so hundreds of files become a short list of distinct crashes.

One catch: the engines aren't interchangeable once a crash has to reproduce. AFL++ keeps one
process alive across inputs, and GNS has a process-wide clock my per-input rebuild doesn't
reset. So an assert crash under AFL++ can depend on {=ghostly: clock state from thousands of
earlier inputs=}. I use AFL++ for the memory-safety oracle and libFuzzer when an assert crash
has to reproduce.

## The Flat Line

In the morning, total line coverage was {=static: 37.6%, exactly where it started=}. More hours on
the same eleven harnesses weren't going to find new code, so new coverage had to come from new
harnesses. I added three (the signing-key harness from the last post among them) and ran a second
campaign on just the changed harnesses. Coverage went from 37.6% to 39.95%, with nothing new
found.

## Putting Old Bugs Back

A fuzzer that reports nothing looks the same whether it's exercising hardened code or bouncing
off the first length check. Coverage says the code *ran*, not that the oracle would have fired.
So I borrowed the idea behind [Magma](https://hexhive.epfl.ch/magma/): take a real bug that's
{=ward: public and already fixed=}, revert the fix on my pinned version, and see if the harness
finds it again. (Reverting a public fix reveals nothing new, which is why I can show it.)

The first is [CVE-2020-6017](https://nvd.nist.gov/vuln/detail/CVE-2020-6017), a heap overflow in
unreliable-segment reassembly:

```diff
-			if ( (int64)nOffset + cbSegmentSize > k_cbMaxUnreliableMsgSizeRecv || cbSegmentSize > k_cbMaxUnreliableSegmentSizeRecv )
+			if ( (int64)nOffset + cbSegmentSize > k_cbMaxUnreliableMsgSizeRecv )
```

Without that condition, a segment longer than the 1,300-byte reassembly buffer gets copied
straight in. Each seeded bug names the harness and oracle that should catch it and the crash
signature to expect, and the runner does two checks:

1) **Verify.** Replay a trigger I wrote by hand (a 1,347-byte segment, so it {=flood: overflows by
   47 bytes=}) and look for the expected crash. This proves the plumbing.
2) **Discover.** Fuzz from the normal seeds for five minutes and scan every crash for the
   signature. This proves the fuzzer finds it without being handed the answer.

The second bug is [issue #410](https://github.com/ValveSoftware/GameNetworkingSockets/issues/410),
picked because it's the opposite kind: it corrupts a map's bookkeeping without touching memory,
so only the assert oracle sees it, and only the multi-packet harness can build the state it
needs. One run for it saved 470 crash files, which CASR collapsed to {=trophy: one distinct crash=},
the right one.

Both got caught. So when the SNP harnesses run clean, I know they can catch a heap overflow and
a logic bug there, because they did. It's a small sample though: both bugs are in SNP, and
nothing is seeded yet for the handshake, P2P or NAT traversal harnesses.

With some evidence that a clean run means something, the question went back to what the
harnesses still weren't reaching. That's [the next post](/posts/fuzzing-stateful-code/).
