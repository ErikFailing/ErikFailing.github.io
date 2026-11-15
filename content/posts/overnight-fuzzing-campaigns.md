+++
title = 'Running Everything Overnight: AFL++, CmpLog And A Flat Line'
date = 2026-11-15T10:50:00-06:00
draft = false
number = 9
description = 'Moving eleven GameNetworkingSockets harnesses from short libFuzzer runs to parallel overnight AFL++ campaigns, the tooling that took, and what a coverage number that stops moving is telling you.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'aflplusplus', 'CASR', 'Security']
+++

By this point I had eleven harnesses, and most runs so far had been short ones under libFuzzer.
The next step was to leave all of them running overnight under {=aflplusplus: AFL++=}. This post
is the setup that took, the tooling I needed once crashes and corpora piled up, and the result:
total coverage {=point: didn't move all night=}, which turned out to be the most useful thing the
campaign could have told me.

## Same Harnesses, Second Engine

Because every harness is a plain `LLVMFuzzerTestOneInput`, {=iron: nothing in the harness code
changed=} for AFL++. The build compiles the library and harnesses a second time through AFL++'s
compiler, plus a third copy of each harness built for {=static: CmpLog=}. CmpLog watches the
operands of comparisons and feeds them back into the input, which is how a fuzzer gets past magic
values (a marker byte, a length, the STUN magic cookie) without brute forcing them. The CmpLog
copy has no sanitizers on purpose: it only guides the mutator, and {=ward: the sanitizer build is
the one that decides what's a crash=}.

AFL++ is meant to run many instances at once, so that's how I ran it: one main instance and the
rest secondaries, all syncing through one output directory.

```bash
afl-fuzz -i seeds -o afl-output -M main -c ./harness.cmplog -l 2AT -- ./harness
afl-fuzz -i seeds -o afl-output -S sec1 -p explore -- ./harness
afl-fuzz -i seeds -o afl-output -S sec2 -p exploit -- ./harness
```

The main and every third secondary run CmpLog, and the others rotate through AFL++'s power
schedules so {=iron: the instances don't all do the same work=}. Each campaign starts from my
hand-written seeds plus whatever corpus libFuzzer had already grown for that harness, so nothing
learned earlier gets thrown away.

Two small things mattered for the slow harnesses. AFL++ trims inputs to make them shorter, which
is great for a parser and a waste for a harness where every execution rebuilds a connection, so
those run with trimming off. And inside Docker, AFL++ needs a few environment variables and the
ptrace capability before it will start at all. I put all of that in one wrapper script, because
I was never going to remember it at midnight.

## Keeping The Pile Manageable

Long campaigns produce two piles: corpus files and crash files. Both needed tooling.

**The corpus.** A corpus that only grows slows every later run down, since each input gets
replayed at startup. libFuzzer can shrink one to the smallest set with the same coverage:

```bash
./gns-snp-data-harness -merge=1 corpus.min/ corpus/ afl-output/main/queue/
```

My script measures the coverage feature count before and after and {=ward: refuses to swap the new
corpus in unless nothing was lost=}. It also folds AFL++'s finds back into the shared corpus, so
libFuzzer starts from what AFL++ learned. On the single-packet SNP harness that took the feature
count {=trophy: from 6,333 to 6,710=}. It had one bug worth admitting: my first version measured the
"before" number in a single pass that aborted on the first crashing input, so it reported a
baseline that was only part of the corpus.

**The crashes.** A long run saves the same crash hundreds of times.
[CASR](https://github.com/ispras/casr) replays every file and clusters them by stack, so I read
{=trophy: "one distinct crash"=} and not 470 files. Two things I had to add around it:

- CASR's libFuzzer mode only parses ASan reports, so UBSan crashes get a separate replay pass
  that reads the UBSan summary line.
- For an assert, the crashing frame is my own oracle hook. The script walks up the stack to the
  first frame inside GNS and reports that as the crash site.

## Which Engine For Which Oracle

The two engines also turned out not to be interchangeable once a crash has to reproduce. AFL++
keeps a single process alive across many inputs. My harnesses rebuild the connection for each
input, but GNS also has a process-wide clock that a rebuild doesn't reset. So a crash from the
assert oracle under AFL++ can depend on {=ghostly: clock state built up over thousands of earlier
inputs=}, and then it doesn't reproduce from its file.

I thought about {=arcane: freezing GNS's clock per input=} and decided against it. It would mean
overriding three of GNS's time functions at once and suppressing its own "timer is not monotonic"
assert, which is fragile and specific to one commit. The split I use now is simpler:

- **Memory-safety oracle (ASan and UBSan):** either engine, and AFL++ for the long runs. Those
  crashes come from the input's content and reproduce from one file.
- **Assert oracle:** AFL++ to find leads fast, libFuzzer when the crash has to reproduce.

## The Flat Line

Then I ran all eleven harnesses overnight, under AFL++ with CmpLog and under libFuzzer. In the
morning, total line coverage was {=static: 37.6%, exactly where it started=}.

That looks like a wasted night, and I think it's actually the clearest signal fuzzing gives
you. The harnesses weren't broken, they'd just reached everything they were ever going to
reach. More hours on the same eleven weren't going to
find new code. New coverage had to come from {=point: new harnesses, not more time=}.

So that's what I built next: three more harnesses aimed past the handshake's signature check
(the signing-key trick from [the last post](/posts/structure-aware-fuzzing-protobuf/), a
server-side version of it, and a P2P connect request that creates a connection). I also found
and fixed the seed-loading bug described there. A second campaign over just the harnesses that
had changed took coverage {=trophy: from 37.6% to 39.95%=}, and found nothing new.

Two things I took from it:

- **A new harness's first coverage number is a floor.** It keeps climbing as the corpus settles,
  so every new harness is owed a real campaign before I judge it.
- **A flat line means stop.** When coverage stops growing overnight, the answer is a new harness
  or a new oracle, not a longer run.

A night of fuzzing that turns up nothing new does raise an awkward question, though. Is the code
solid, or would my harnesses miss a bug that's sitting right there? That's [the next
post](/posts/seeded-bug-evaluation/).