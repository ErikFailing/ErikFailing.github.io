+++
title = "Aiming The Fuzzer: Coverage, And Proving A Clean Run Means Something"
date = 2026-11-15T10:20:00-06:00
draft = false
description = "Using coverage to pick fuzzing targets in GameNetworkingSockets, why the biggest gaps were often the wrong ones, running the harnesses overnight, and putting old bugs back to prove a clean run means something."
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'libprotobuf-mutator', 'aflplusplus', 'CASR', 'Security']
aliases = ['/posts/structure-aware-fuzzing-protobuf/', '/posts/overnight-fuzzing-campaigns/', '/posts/seeded-bug-evaluation/']
+++

With five harnesses running, the next question was where to point them. I picked by measuring
coverage, and it took a few harnesses to learn that {=point: a big coverage gap isn't automatically
a target=}: some uncovered code can't be reached by an attacker, and some sits behind a gate that
mutation alone won't get through. Then I left the harnesses running overnight and had to work out
what a flat coverage line actually meant.

## The Loop

Build the harnesses a second time with coverage instrumentation and no sanitizers, replay every
corpus through that build, and read the per-file report:

```bash
LLVM_PROFILE_FILE=prof/gns-snp-data-harness.profraw ./gns-snp-data-harness -runs=0 corpus/ seeds/
llvm-profdata merge -sparse prof/*.profraw -o merged.profdata
llvm-cov report ./gns-snp-data-harness -instr-profile=merged.profdata
```

The first five harnesses covered {=trophy: about 28% of GNS's lines=}. The report turns "what's
unfuzzed" into a worklist, but it's sorted by size, and size is the wrong sort key.

## A Good-Looking Harness That Did Almost Nothing

The biggest unfuzzed parser was the crypto handshake: certificates, session crypto info,
signature checks and key exchange, all before session keys exist. I built a harness that calls
the handshake with two fuzzed protobuf blobs, and it {=glitch: raised total coverage by about 0.3
points=}. Two reasons:

- **The happy path was already covered.** My SNP (reliability layer) harnesses set up a real
  connection for every input, which runs a real handshake.
- **Raw bytes die at the protobuf parser.** Flip a byte in a nested protobuf and the parse usually
  fails, so the fuzzer reached the rejection paths and not much else.

The fix for the second one is [libprotobuf-mutator](https://github.com/google/libprotobuf-mutator)
(LPM). Instead of mutating raw bytes and hoping they still parse, the harness declares a message
type and LPM hands it {=protobuf: a parsed, valid message with mutated fields=}:
```cpp
// LPM mutates and hands us a structurally valid (field-mutated) message.
DEFINE_BINARY_PROTO_FUZZER( const CMsgSteamSockets_UDP_Stats &msgStats )
{
    if ( !BuildConnectedPair() )   // fresh connection, so a crash reproduces from its file
        return;
    const std::string blob = msgStats.SerializeAsString();
    // ... wrap it in a real UDP data packet and deliver it through the real receive path ...
}
```

An LPM version of the certificate harness added about 0.5 points. Better, but the key parser I
was aiming at, `keypair.cpp`, sat at exactly 18.96% through both harnesses.

## Reading What A Gap Is Made Of

So I read `keypair.cpp`. The uncovered 81% is parsers for PEM, OpenSSH, hex and base64 key
formats, plus key generation. That's code for {=ward: the application's own keys=}, loaded from
its own config, not something a peer sends. The part an attacker reaches is a length check the
real handshake already covered.

The certificate chain validator looks like a deep, attacker-facing parser too, but this build
hardcodes Valve's root key and refuses any other. A harness can't get a certificate trusted
without Valve's private key, and {=crimson: an attacker has the same problem=}.

So now every gap gets sorted before I spend time on it:

- **Reachable:** a remote peer or a spoofed server can push bytes into it. Worth a harness.
- **Local:** sender-side serialization, lifecycle and API code, local crypto setup. Skip.
- **Blocked:** gated by something I can't forge (the hardcoded root key), or not compiled in.

I could push the number up by fuzzing the key-file parsers, and it would look great on a chart lol.

## Gated vs Ungated

The certificate harness had a second problem I hadn't named yet: {=point: the handshake is gated=}.
Before it parses the key, it checks the certificate's identity and validity, and a mutated
certificate fails those nearly every time. LPM got me through the protobuf parser, but the checks
behind it were the real wall.

To see the contrast, I pointed LPM at messages with nothing in front of them:

| Harness | What it reached | Total line coverage |
|---|---|---|
| Inline stats | A protobuf any connected peer can attach to a data packet | 28.9% to 31.8% |
| Peer-to-peer signaling | About 1,900 lines of rendezvous handling that sat at 0% | 31.8% to 36.9% |
| Real-crypto data path | AES-256-GCM decrypt, which the NULL-cipher harnesses skip | up to 37.6% |

Same tool, {=trophy: the biggest jumps of the project=}. On an ungated protobuf path every mutated
field reaches the code that uses it. On a gated one, LPM is necessary and not sufficient.

## Getting Through The Gate

The gate on the handshake is a signature. The session crypto info is signed, and that signature is
checked against the public key inside the certificate. Here's the lever: the open-source build has
no certificate authority, so it accepts a certificate that carries no authority's signature, and
the only signature left to check is the crypto one, verified against the cert's own key.

So the harness plays both sides. It generates its own ed25519 key, puts the public half into a
captured certificate, lets LPM mutate the crypto info, and signs the result with the matching
private half the way GNS does. The check passes because it's verifying the harness's signature
against the harness's key, and {=arcane: execution finally reaches the key exchange=} with
attacker-shaped fields behind the gate. When a gate is a check you can honestly satisfy, satisfy
it in the harness.

One LPM gotcha worth knowing: `DEFINE_PROTO_FUZZER` reads its corpus as text-format protobuf
and `DEFINE_BINARY_PROTO_FUZZER` reads binary. Binary seeds with the text macro fail to load
without any error, and the harness {=glitch: quietly starts from nothing=}.

## Leaving Them On Overnight

By now I had eleven harnesses, and none had run for long. So I left them all running overnight
under {=aflplusplus: AFL++=}, a fuzzer built for long parallel runs.

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

Long runs make two piles to manage. For the corpus, libFuzzer's `-merge=1` shrinks it to the
smallest set with the same coverage, and my script {=ward: refuses the result unless nothing was
lost=}. For crashes, [CASR](https://github.com/ispras/casr) (a crash triage tool) replays every
file and clusters them by stack, so hundreds of files become a short list of distinct crashes.

## The Flat Line

In the morning, total line coverage was {=static: 37.6%, exactly where it started=}. That has two
explanations, and they're opposites: either the harnesses have reached everything they can, or
they're broken and not really testing anything. For the first explanation, the fix is new
harnesses, so I added three (the signing-key handshake harness above among them) and ran a second
campaign on just the changed ones. Coverage went from 37.6% to 39.95%, with nothing new found.

## Proving A Clean Run Means Something

But a fuzzer that reports nothing looks the same whether it's exercising hardened code or bouncing
off the first length check forever. Coverage says the code *ran*, not that the oracle would have
fired if something went wrong. So I borrowed the idea behind
[Magma](https://hexhive.epfl.ch/magma/): take a real bug that's {=ward: public and already
fixed=}, revert the fix on my pinned version, and check that the harness finds it again. (Reverting
a public fix reveals nothing new, which is why I can show it.)

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

Both got caught. So when the SNP harnesses run clean, I know they can catch a heap overflow and a
logic bug there, because they did. It's a small sample though: both bugs are in SNP, and nothing
is seeded for the handshake, peer-to-peer or NAT traversal harnesses.

With some evidence that a clean run means something, the question went back to the code the
harnesses still weren't reaching, the 23 SNP functions that stayed dark all night. Reaching them
needed a different kind of harness: [priming state before the fuzzer gets a
turn](/posts/fuzzing-stateful-code/).
