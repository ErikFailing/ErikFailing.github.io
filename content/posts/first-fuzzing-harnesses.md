+++
title = 'The First Harnesses: Two Parsers, Then A Real Connection'
date = 2026-11-15T10:10:00-06:00
draft = false
number = 5
description = 'The first five GameNetworkingSockets harnesses, from a parser that takes a buffer to a full in-process connection, and the rule that every crash has to reproduce from one file.'
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'cpp', 'libFuzzer', 'Security']
+++

The first five harnesses went in order of how much setup they need: two stateless parsers, the
handler for packets from unknown hosts, then {=static: a real in-process connection=} to reach the
reliability layer. Along the way I settled on the rule every later harness follows: a crash has
to reproduce from its single file.

## Start With The Cheapest Thing

The parsers for STUN and ICE (the NAT traversal protocols from the last post) are {=crimson: the
first code a packet touches=} during NAT traversal, and they're easy targets: bytes in, result
out. The one obstacle is that both are file-local inside a GNS source file. I didn't want to patch
GNS, so the harness includes the whole `.cpp`. Here's the ICE candidate harness, minus a few
standard includes:
```cpp
#include "steamnetworkingsockets_ice_client.cpp"

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

Its one seed is a candidate line I wrote by hand
(`candidate:1 1 udp 2130706431 192.168.1.20 27015 typ host`). That's a rule I kept for every
harness: {=ward: seeds are written, never harvested from crashes=}, so a seeds folder can never
contain an unfixed bug. Both parsers ran at 100,000 to 200,000 executions a second.

## Standing The Library Up

Next is the handler for UDP packets from a host GNS has never heard of. That needs a listen
socket, and GNS normally services sockets on a background thread, where a fuzzer can't control
when things run. GNS exports a {=arcane: manual-poll mode=} that no public header declares. Turn
it on before initializing and the service thread never starts.

The layer with the history is SNP, GNS's reliability layer, which only runs on an established
connection, where data packets are normally encrypted with AES-GCM. GNS also has a NULL cipher,
and two connections in the same process can negotiate it. So the harness makes a real client and
server over loopback with encryption off. Three decisions here carried into every connection
harness after it:

- **Inject whole packets.** Calling the decoder directly skips setup and reads uninitialized
  state, so each input goes in as a complete UDP packet through the real receive function.
- **Rebuild the connection for every input.** That drops the speed to about 500 executions a
  second, but nothing carries over between inputs.
- **Destroy connections the hard way.** A normal close leaves a connection lingering on timers
  that never advance in a tight loop, so every input leaked a socket until the run died with
  {=glitch: "too many open files"=}.

## One Packet Isn't Enough

The logic bugs in #409 and #410 live in what the receiver remembers *between* packets: which
packet numbers arrived, where the gaps are. So a second SNP harness treats one input as a
sequence of packets, each with a signed sequence-number delta, so the fuzzer can
{=static: open gaps, fill them out of order, and send duplicates=}.

The connection has to be rebuilt between inputs, though. If it stays alive, a crash depends on
everything the campaign sent before, and the saved file reproduces nothing. So state builds up
within an input and resets between them, because {=point: a crash I can't
reproduce is a crash I can't report=}.

## A Second Oracle

Bugs like #410 corrupt no memory, so {=ghostly: ASan and UBSan can't see them=} (those are the
sanitizers for memory errors and undefined behavior). What notices is GNS itself: it's full of
internal asserts that, in a normal build, log and carry on. So the stateful harnesses share a hook
with two modes. By default asserts are logged and skipped, like a release build. With an
environment variable set, every assert is a crash:
```bash
GNS_FUZZ_ASSERT_FATAL=1 ./gns-snp-sequence-harness corpus/
```

It's noisier, since some asserts fire on malformed input by design. One of them has a comment
from the author right next to it saying they're not sure it's even possible lol. Once I've read
one and decided it's harmless, it goes on a whitelist keyed by file and line.

That made five harnesses. What I didn't know was how much of the library they reached, which is
[the next post](/posts/low-coverage-is-not-opportunity/).
