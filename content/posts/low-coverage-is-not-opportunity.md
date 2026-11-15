+++
title = "Low Coverage Isn't The Same As Opportunity"
date = 2026-11-15T10:20:00-06:00
draft = false
number = 6
description = 'Using coverage to pick fuzzing targets in GameNetworkingSockets: the harnesses that barely moved the number, the ones that jumped it, and why the difference was reachability and gates.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'libprotobuf-mutator', 'Security']
aliases = ['/posts/structure-aware-fuzzing-protobuf/']
+++

With five harnesses running, I picked what to build next by measuring coverage. It took a few
harnesses to learn that {=point: a big coverage gap isn't automatically a target=}: some uncovered
code can't be reached by an attacker, and some sits behind a gate that mutation alone won't get
through. This post is the six harnesses that taught me that.

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

- **The happy path was already covered.** My SNP harnesses set up a real connection for every
  input, which runs a real handshake.
- **Raw bytes die at the protobuf parser.** Flip a byte in a nested protobuf and the parse
  usually fails, so the fuzzer reached the rejection paths and not much else.

The fix for the second one is [libprotobuf-mutator](https://github.com/google/libprotobuf-mutator)
(LPM). The harness declares a message type, and LPM hands it {=protobuf: a parsed, valid message with
mutated fields=}:

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
its own config. The part an attacker reaches is a length check the real handshake already
covered.

Later, the certificate chain validator was the same story. I built a harness with its own
certificate authority, and its startup self-check failed: this build hardcodes Valve's root key
and refuses any other. That's a dead end for my harness, and also why the code isn't much of a
target. {=crimson: An attacker has the same problem I do=}.

Now every gap gets sorted before I spend time on it:

- **Reachable:** a remote peer or a spoofed server can push bytes into it. Worth a harness.
- **Local:** sender-side serialization, lifecycle and API code, local crypto setup. Skip.
- **Blocked:** gated by something I can't forge (the hardcoded root key), or not compiled in.

I could push the number up by fuzzing key-file parsers, and it would look great on a chart lol.

## Gated vs Ungated

The certificate harness had a second problem: {=point: the handshake is gated=}. Before it parses
the key, it checks the certificate's identity and validity, and a mutated certificate fails
those nearly every time. LPM got me through the parser, but the checks behind it were the hard
part.

Then I pointed LPM at messages with nothing in front of them:

| Harness | What it reached | Total line coverage |
|---|---|---|
| Inline stats | A protobuf any connected peer can attach to a data packet | 28.9% to 31.8% |
| P2P signaling | About 1,900 lines of rendezvous handling that sat at 0% | 31.8% to 36.9% |
| Real-crypto data path | AES-256-GCM decrypt, which the NULL-cipher harnesses skip | up to 37.6% |

Same tool, {=trophy: the biggest jumps of the project=}. On an ungated protobuf path every mutated
field reaches the code that uses it. On a gated one, LPM is necessary and not sufficient.

## Getting Through The Gate

I came back to the handshake a little later. The gate that matters is a signature: the session
crypto info is signed, and checked against the public key in the certificate. The open-source
build has no certificate authority behind it, so by default it accepts a certificate without a
CA signature. That leaves {=arcane: one signature to satisfy=}, made with a key the certificate
itself names.

So the harness holds its own ed25519 key. It swaps the public half into a captured certificate,
lets LPM mutate the crypto info, signs the result the way GNS does, and runs the handshake.
Execution finally reaches the key exchange with attacker-shaped fields. When the gate is a
check you can honestly satisfy, satisfy it in the harness.

Two mistakes from this stretch:

1) **My seeds weren't loading.** `DEFINE_PROTO_FUZZER` reads text-format protobuf and
   `DEFINE_BINARY_PROTO_FUZZER` reads binary. I wrote binary seeds and used the text macro, so
   five harnesses were {=glitch: quietly starting from nothing=}.
2) **I pinned the protocol version.** The handshake rejects versions below a minimum, so the
   harness forces the current one. That gets every input through, and hides the branches for
   older versions that are still accepted. Letting the fuzzer pick is on my list.

Before those last signing-key harnesses, the count stood at eleven, and none had run for
long. Next: [leaving them on overnight](/posts/overnight-fuzzing-campaigns/).
