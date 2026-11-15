+++
title = 'The First Harnesses: Two Parsers, Then A Real Connection'
date = 2026-11-15T10:20:00-06:00
draft = false
number = 6
description = 'The first five GameNetworkingSockets harnesses, from a parser that takes a buffer to a full in-process connection, and the rule that every crash has to reproduce from one file.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'cpp', 'libFuzzer', 'Security']
+++

With the lab built, the first five harnesses went in order of how much setup they need: two
stateless parsers, then the handler for packets from unknown hosts, then {=static: a real in-process
connection=} to reach the reliability layer. This post is how each one works, what I got wrong
along the way, and the rule that shaped every harness after them.

## Start With The Cheapest Thing

The STUN and ICE candidate parsers are {=crimson: the first code a packet touches during NAT
traversal=}, and they're about as easy as fuzz targets get: bytes in, result out, no connection
behind them. The one obstacle is that both are file-local inside one GNS source file, so nothing
outside it can call them. I didn't want to patch GNS, so the harness {=cpp: includes the whole
`.cpp`=}. Here's the entire ICE candidate harness:
```cpp
#include <cstddef>
#include <cstdint>
#include <string>

#include "steamnetworkingsockets_ice_client.cpp"

// libFuzzer's entry point: one candidate line per call.
extern "C" int LLVMFuzzerTestOneInput( const uint8_t *data, size_t size )
{
    // 1: The parser takes a NUL-terminated C string and scans for the terminator itself.
    std::string candidate( reinterpret_cast<const char *>( data ), size );

    // 2: Parse it. The result is ignored on purpose: ASan and UBSan watch for the bugs.
    SteamNetworkingSocketsLib::RFC5245CandidateAttr attribute{};
    SteamNetworkingSocketsLib::ParseRFC5245CandidateAttribute( candidate.c_str(), &attribute );
    return 0;
}
```

It still links against the stock library, because the harness now defines that file's symbols
itself and {=iron: the linker never pulls the original object out of the archive=}. Its one seed
is a candidate line I wrote by hand:
```text
candidate:1 1 udp 2130706431 192.168.1.20 27015 typ host
```

That's a rule I kept for every harness: {=ward: seeds are written, never harvested from crashes=}. A
crashing input saved as a "seed" would be an unfixed bug sitting in a folder that's meant to be
publishable.

The STUN parser needed one more thing. It writes into its buffer and reads it as 32-bit words, so
handing it libFuzzer's read-only input would be undefined behavior of my own making. The harness
gives it an aligned, writable copy instead. Both parsers ran at {=trophy: 100,000 to 200,000
executions a second=}, which is the fast feedback loop I wanted on day one.

## The First Stateful One

Next up the stack is the handler for UDP packets from a host GNS has never heard of, the entry
point for {=crimson: anyone who can send it a packet=}. That needs a listen socket, which means
standing the library up for real, and my plan said that would be a problem: GNS services its
sockets on a background thread, and a fuzzer needs to control exactly when things run.

The plan was wrong, which was nice for once. GNS exports a {=arcane: manual-poll mode=} that no
public header declares. Turn it on before initializing and the service thread never starts, so
{=ward: the harness decides when the library runs=}. With that, the pre-login harness binds one
loopback socket and feeds each input straight to the handler, at about 80,000 executions a second.

## A Real Connection

The layer with the history is SNP, the reliability layer, and it only runs on an established
connection. My plan assumed every data packet would be gated behind AES-GCM, which a fuzzer can't
forge. That was wrong too: {=arcane: GNS has a NULL cipher=}, and a pair of connections in the
same process can legitimately negotiate it. So the harness makes a real client and server over
loopback with encryption off, and the fuzzer's bytes arrive at the decoder as plaintext.

A few decisions here ended up in every connection harness I wrote afterward:

- **Inject whole packets, not decoder calls.** Calling the decoder directly skips setup and reads
  state nothing initialized. So each input becomes {=flow: a complete UDP data packet=} handed to
  the connection's real receive function, and flows through routing, the sequence check and
  decryption on the way.
- **Rebuild the connection for every input.** That costs a lot of speed (about 500 executions a
  second, down from 100,000), but it means nothing carries over from earlier inputs.
- **Destroy connections the hard way.** A normal close leaves a connection lingering on timers
  that never advance in a tight loop, so every input leaked a socket and the run died with
  {=glitch: "too many open files"=}. The harness runs the same destroy sequence GNS's own service
  thread uses.

That harness reached about 3,300 edges of the decoder from my seeds.

## One Packet Isn't Enough

The logic bugs in issues #409 and #410 don't live in a single packet. They live in what the
receiver remembers between packets: which packet numbers have arrived, where the gaps are, how
far the reliable stream has gotten. A harness that sends one packet to a fresh connection can
never build that up.

So the second SNP harness treats one input as a sequence of packets. Each record carries a signed
sequence-number delta, a length and a chunk, which lets the fuzzer {=static: open gaps, fill them
in out of order, and send duplicates=}, all against one connection.

My first version of it kept that connection alive across inputs, and that was a mistake. Its
crashes depended on everything the campaign had sent before, so the saved file didn't reproduce
anything. I rebuilt it so state accumulates *within* an input and resets between them, and that
became the rule for the whole project: {=point: a crash has to reproduce from its single file=},
because a crash I can't reproduce is a crash I can't report.

I also made it a second harness instead of changing the first one. The test I settled on: if a
change keeps the old corpus meaningful and the speed in the same ballpark, improve in place.
{=iron: If it changes what the input means, split=}. The single-packet harness stayed fast and
kept its corpus, and the two cover the same decoder from different angles.

## A Second Oracle

Bugs like #410 have another property: they corrupt no memory, so {=ghostly: ASan and UBSan can't see
them=}. What notices is GNS itself. The library is full of internal asserts, and in a normal build
they log a message and carry on with a fallback.

So the stateful harnesses share a small hook with two modes. By default it treats those asserts
the way a release build does ({=ward: log once, keep going=}), which leaves the sanitizers as the
oracle. With an environment variable set, every assert becomes a crash:
```bash
GNS_FUZZ_ASSERT_FATAL=1 ./gns-snp-sequence-harness corpus/
```

It's noisier, because some asserts fire on malformed input by design. One of them has a comment
from the author right next to it saying they're not sure it's even possible lol. Once I've read
one and decided it's harmless, it goes on a whitelist so the run only stops for asserts I haven't
explained yet.

## Where That Left Things

That made five harnesses, and a decoder that was clearly getting exercised. What I didn't know
was how much of the library those five actually reached, or what the biggest thing I was missing
was. {=flow: Measuring that=} is [the next post](/posts/low-coverage-is-not-opportunity/).
