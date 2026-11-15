+++
title = 'Structure-Aware Fuzzing With libprotobuf-mutator: Gated vs Ungated'
date = 2026-11-15T10:50:00-06:00
draft = false
number = 9
description = 'Mutating real protobuf messages instead of raw bytes barely helped on one GameNetworkingSockets surface and helped a lot on another. The difference was what stood in front of the parser.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'libprotobuf-mutator', 'Security']
+++

GameNetworkingSockets uses protobuf for its handshake, signaling and stats messages, and {=static: a
raw-byte fuzzer is bad at protobuf=}. So I wired in libprotobuf-mutator, which mutates a real
message tree instead of bytes. It barely moved coverage on the surface I added it for, and gave
me the biggest jumps of the project on two others. The difference was {=point: whether a gate stood
between the parser and the interesting code=}.

## Why Raw Bytes Struggle

My first crypto handshake harness fed the handshake two fuzzed blobs: a signed certificate and
signed session crypto info. Both are protobufs with more protobufs nested inside. Flip a byte in
one and you usually break a length prefix or a field tag, the parse fails, and the input is
rejected in the first few lines. The fuzzer spent its time {=static: rediscovering how to be valid
protobuf=} instead of testing what the handshake does with the fields.

[libprotobuf-mutator](https://github.com/google/libprotobuf-mutator) (LPM) fixes that at the
source. The harness declares which message type it wants, and LPM hands it {=iron: a parsed, valid
message with mutated fields=}: a changed integer, a longer string, a repeated field with an extra
entry. Here's the inline-stats harness, trimmed:

```cpp
#include "src/libfuzzer/libfuzzer_macro.h"   // libprotobuf-mutator

// LPM mutates and hands us a structurally valid (field-mutated) inline-stats message.
DEFINE_BINARY_PROTO_FUZZER( const CMsgSteamSockets_UDP_Stats &msgStats )
{
    // 1: Fresh connected pair for this input, so a crash reproduces from its file.
    if ( !BuildConnectedPair() )
        return;

    // 2: Build a real UDP data packet carrying the fuzzed stats: the header with the
    //    protobuf-blob flag set, then the varint-prefixed blob, then an empty SNP chunk.
    const std::string blob = msgStats.SerializeAsString();
    // ...

    // 3: Deliver it through the real receive path.
    CConnectionTransportUDP::PacketReceived( info, pTransport );
}
```

I built LPM into the target's Docker image against the system protobuf, pinned to a commit, and
linked it into every harness. A harness that uses the macro gets structure-aware mutation, and
the others don't notice it's there.

## A Gated Surface: The Certificate

The first LPM harness mutated the certificate message and ran the same handshake as the raw
one. Every input was now a well-formed certificate with mutated fields, at about 3,000
executions a second. Total coverage went up {=glitch: about half a point=}, and the key parser I was
aiming at didn't move at all.

The reason is that {=point: the handshake is gated=}. Before it parses the key, it checks that the
certificate's identity makes sense and that the certificate is valid for this connection. A
mutated certificate fails those checks nearly every time, so it gets rejected before reaching
anything deep. LPM got me through the *parser*, but the parser was never the hard part. The
checks behind it were.

## An Ungated Surface: Inline Stats

Then I pointed the same tool at a message with nothing in front of it. A connected peer can
attach a stats protobuf to any data packet by setting one flag. The receiver parses it and
folds the peer's reported numbers into the connection. Nothing gates the message
itself, so {=crimson: every mutated field reaches the code that uses it=}.

That one harness took total line coverage from 28.9% to 31.8%, {=trophy: the biggest jump of any
harness up to that point=}. The P2P signaling harness (also LPM, also ungated, about 1,900 lines
of rendezvous handling that had sat at 0%) beat it right after, going from 31.8% to 36.9%.

So the rule I'd give is:

- **Ungated protobuf path:** LPM is exactly the right tool, and probably the cheapest coverage
  you'll ever get.
- **Gated protobuf path:** {=point: LPM is necessary and not sufficient=}. Something still has to
  get you through the gate.

## Getting Through The Gate

For the handshake, the gate that matters is a signature. The session crypto info is signed, and
the signature is checked against the public key inside the certificate. The open-source build has
no certificate authority behind it, so by default it accepts a certificate without a CA signature.
That makes sense (Steam's authentication service isn't part of the open-source library), and it
means {=arcane: the only signature left to satisfy=} is one made with a key the certificate itself
names.

So the harness holds {=arcane: its own ed25519 key=}. It swaps the public half into a real captured
certificate, lets LPM mutate the crypto info (the key-exchange key, the cipher list), signs the
result with the private half the same way GNS does, and runs the handshake. The signature
verifies, and execution finally reaches the key exchange and cipher negotiation with
attacker-shaped fields. It's the same idea as forging the STUN integrity check in
[the threat model post](/posts/threat-model-per-harness/): {=point: when the gate is a check you can
honestly satisfy, satisfy it in the harness=}.

One more gate hid behind that one. The handshake rejects crypto info whose protocol version is
below a minimum, and {=static: the mutator is free to change or drop that field=}. The harness
sets that field (and the key type) to the current values after mutation, so every input gets
through. That has a cost I only noticed later: pinning the current version means the branches
for older, still-accepted versions never run, so letting the fuzzer pick any accepted version
is on my list.

## Two Mistakes Worth Admitting

1) **My seeds weren't loading.** LPM has two macros. `DEFINE_PROTO_FUZZER` reads its corpus as
   text-format protobuf, and `DEFINE_BINARY_PROTO_FUZZER` reads serialized binary. I wrote binary
   seeds and used the text macro, so every seed failed to parse and five harnesses were quietly
   rebuilding a valid message from nothing. Switching macros {=trophy: revived three of them=}
   that had been starved the whole time.
2) **I assumed coverage went up.** Both handshake harnesses {=glitch: looked right and ran
   clean=}. Only the coverage build showed they'd added about 0.3 and 0.5 points. That's the whole
   argument of [the coverage post](/posts/low-coverage-is-not-opportunity/).

## The Same Idea Without Protobuf

The same idea works without protobuf. The SNP reliability layer has its own hand-rolled wire
format, so there's no message type to hand LPM. One of my SNP harnesses does the equivalent by
hand: it reads typed fields from the fuzzer input and assembles well-formed frames from them. It
also reads live connection state, because some fields only matter relative to it. An ack is
ignored unless it names a packet number below the real next-send number, so the harness builds
that field as {=arcane: the live value plus a fuzzed delta=}.

I think of it as the same trade either way. A raw-byte harness finds the framing bugs, and that's
where CVE-2020-6016 and CVE-2020-6017 were, so I kept those harnesses. A structure-aware one
spends its time on what the code does with valid-looking fields. {=point: They don't replace each
other=}, which is why the SNP layer ended up with four harnesses and not one.