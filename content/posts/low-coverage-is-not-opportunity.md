+++
title = "Low Coverage Isn't The Same As Opportunity"
date = 2026-11-15T10:20:00-06:00
draft = false
number = 6
description = 'How I used coverage reports to pick fuzzing targets in GameNetworkingSockets, and why the biggest gaps were often the wrong ones to chase.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'Security']
+++

I picked what to fuzz next in GameNetworkingSockets by measuring coverage, and it took me a few
harnesses to learn that {=point: a big coverage gap isn't automatically a target=}. A lot of
uncovered code is code no attacker can reach. This post is how the coverage loop worked, the
harnesses that barely moved the number, and the filter I ended up applying to every gap.

## The Loop

The loop itself is simple:

1) Build the harnesses a second time with coverage instrumentation and no sanitizers.
2) Replay every harness's corpus through that build.
3) Read the per-file report, find the biggest uncovered parser, build a harness for it.

```bash
# Replay a corpus through the coverage build, then report on it
LLVM_PROFILE_FILE=prof/gns-snp-data-harness.profraw ./gns-snp-data-harness -runs=0 corpus/ seeds/
llvm-profdata merge -sparse prof/*.profraw -o merged.profdata
llvm-cov report ./gns-snp-data-harness -instr-profile=merged.profdata
```

The first five harnesses (the STUN and ICE parsers, the pre-login handler and the first SNP ones)
covered {=trophy: about 28% of GNS's lines=}. From there the report turns "what's unfuzzed" from a
guess into a worklist. The catch is that the worklist is sorted by size, and {=point: size is the
wrong sort key=}.

## A Good-Looking Harness That Did Almost Nothing

The biggest unfuzzed parser in that first report was the crypto handshake: certificates, session
crypto info, signature checks and key exchange, all parsed before any session keys exist. On
paper that's the best target in the library. So I built a harness that calls the handshake
function directly with two fuzzed protobuf messages, and it {=glitch: raised total coverage by about
0.3 points=}.

There were two reasons, and neither was visible until I measured:

- **The happy path was already covered.** My SNP harnesses set up a real connection for every
  input, and setting up a connection runs a real handshake. The new harness was mostly {=iron:
  re-covering lines I already had=}.
- **Raw bytes die at the protobuf parser.** The messages are nested protobufs, and {=static: a
  mutated blob almost never parses=}, so the fuzzer reached the rejection paths and not much else.

The obvious fix was structure-aware mutation, so the fuzzer mutates a valid certificate message
instead of raw bytes. That harness added about 0.5 points. Better, but one file didn't move at
all: `keypair.cpp`, the key parser, sat at exactly 18.96% through both harnesses.

## Reading What A Gap Is Made Of

So I went and read `keypair.cpp` to see what the gap was actually made of. The uncovered 81% is
parsers for PEM, OpenSSH, hex and base64 key formats, plus key serialization and generation.
That's all code for {=ward: the application's own keys=}, loaded from its own config. The part an
attacker reaches is a length check on a raw key, and the real handshake already covered it.
Fuzzing the rest would have been fuzzing code with {=crimson: no attacker on the other end of
it=}.

Later on, the certificate chain validator was the same story with a different ending. It
looked like a
deep, attacker-facing parser, so I built a harness with its own certificate authority to get
valid chains through it. The harness's startup self-check failed: this build hardcodes Valve's
root key and refuses any other, so without Valve's private key {=crimson: nothing I sign is ever
trusted=}. That's a dead end for my harness, and it's also why the code isn't much of a target.
{=ward: An attacker has the same problem I do=}.

So now every gap gets sorted into one of three buckets before I spend time on it:

- **Reachable:** a remote peer or a spoofed server can push bytes into it. Worth a harness.
- **Local:** sender-side serialization, connection lifecycle and API code, local crypto setup.
  An attacker doesn't drive it, so the coverage number doesn't matter.
- **Blocked:** reachable in theory, but gated by something I can't forge from outside (the
  hardcoded root key), or not compiled into this build at all (the WebRTC path).

## The Gaps That Were Real

Reading gaps that way, the harnesses that came right after the certificate one each moved the
number a lot more:

| Harness | What it reached | Total line coverage |
|---|---|---|
| Inline stats | A protobuf any connected peer can attach to a data packet | 28.9% to 31.8% |
| P2P signaling | About 1,900 lines of rendezvous handling that sat at 0% | 31.8% to 36.9% |
| Real-crypto data path | AES-256-GCM decrypt, which the other harnesses skip | up to 37.6% |

The stats harness is the most useful comparison, because it's the mirror image of the
certificate one.
Same technique (mutating a real protobuf), but this message has {=point: no gate in front of it=},
so every mutated field reaches the code that consumes it. Why that difference matters so much
is in [the structure-aware post](/posts/structure-aware-fuzzing-protobuf/).

The SNP reliability layer had a subtler gap. Its file was around half covered, with 23 of 62
functions never reached, even after days of fuzzing. The biggest reachable piece of what was
missing was the sender's side: what happens when a peer acknowledges packets you sent. My
harnesses {=ghostly: only ever received=}, so that code had nothing to do. Getting there took a
different kind of harness, which is [its own post](/posts/fuzzing-stateful-code/).

## Knowing When To Stop

At eleven harnesses I ran everything overnight under both engines, and total coverage {=static: sat
flat at 37.6% all night=}. I think that's the clearest signal fuzzing gives you: more hours on
the same harnesses weren't going to find new code, so {=point: the next gains had to come from new
harnesses=}. Nine more took it to 43.71%.

And then it stops being worth it. What's left uncovered now is almost all in the local and
blocked buckets, so I think the reachable surface is covered better than 43.71% suggests. I
could push the number up by fuzzing key-file parsers, and it would look great on a chart lol.
It just wouldn't find {=crimson: anything an attacker could use=}.

## What I'd Take From It

- **Measure before aiming, and again after.** Two of my harnesses looked right and moved almost
  nothing. I only know that because I checked.
- **Read the gap before building for it.** The size of a gap says nothing about who can reach
  it.
- **A flat line is information.** When coverage stops growing overnight, the answer is a new
  harness or a new oracle, not more hours.

Deciding what's reachable is a judgment call, so I've been writing mine down, harness by
harness. That's
[the next post](/posts/threat-model-per-harness/).
