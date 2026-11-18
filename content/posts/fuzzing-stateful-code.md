+++
title = 'Reaching Deeper, And The Crashes That Were My Own'
date = 2026-11-15T10:40:00-06:00
draft = false
description = "Priming real connection state before the fuzzer gets a turn, to reach GameNetworkingSockets code a fresh connection never runs, and the three times a 'finding' turned out to be my own harness."
project = 'gamenetworkingsockets-fuzzing'
tags = ['Fuzzing', 'cpp', 'Triage', 'Sanitizers', 'Security']
aliases = ['/posts/my-early-crashes-were-my-own-harness/']
+++

A lot of the interesting code in a network library only runs when a connection already holds
state: packets in flight, a second connection to collide with. A harness that feeds bytes to a
fresh connection never gets there. What reached that code in GameNetworkingSockets was to
{=point: prime real state first, then feed it hostile input=}, and I think it's the most reusable
thing I took from the project. It's also where I had to get strict about telling a real crash from
a crash I'd caused myself.

## The Code That Never Ran

A third overnight campaign, aimed only at the harnesses for SNP (GNS's reliability layer), came
back flat too. A coverage report showed why: even with three harnesses on that layer, {=crimson:
23 of its 62 functions had never run=}. The biggest reachable chunk was the sender's side of
acknowledgments. When a peer acks or nacks packets you sent (confirms them, or reports them
missing), GNS walks a map of in-flight packets, erases the acked ones and queues the nacked ones
for retransmit. That's {=ghostly: iterator-and-erase code=} driven by fields the peer chooses,
exactly where a use-after-free could hide.

My harnesses never reached it because they only ever received. The connection being fuzzed had
barely sent anything, so its in-flight map was empty and every fuzzed ack had nothing to
acknowledge. No amount of mutating the input changes that.

## Priming In-Flight Packets

So the new harness sets the state up itself, {=ward: with the library's own API=}, before the
fuzzer gets a turn. The core of it, trimmed:

```cpp
static int PrimeInFlight()
{
    // 1: Drop the client so its side never acks the server's sends back out of the in-flight map.
    {
        SteamNetworkingGlobalLock lock( "fuzz-prime-dropclient" );
        ForceDestroyConnection( g_hClient );
        CSteamNetworkConnectionBase::ProcessDeletionList();
        ProcessPendingDestroyClosedRawUDPSockets();
    }

    // 2: Send reliable NoNagle messages and poll once each, so each leaves the send queue as its
    //    own in-flight packet.
    std::vector<char> msg( k_cbPrimeMsg, 'A' );
    for ( int i = 0; i < k_nPrimeInFlight; ++i )
    {
        SteamNetworkingSockets()->SendMessageToConnection( g_hServer, msg.data(),
            (uint32)msg.size(), k_nSteamNetworkingSend_Reliable | k_nSteamNetworkingSend_NoNagle,
            nullptr );
        SteamNetworkingSockets_Poll( 0 );
        SteamNetworkingSockets()->RunCallbacks();
    }
    // ... a few more poll passes, then count what's actually in the in-flight map ...
}
```

Three details made it work:

1) **Destroying the client.** If the other end stays alive it acks everything and the map drains.
   With it gone, the fuzzer's acks are {=static: the only thing changing the map=}, which also
   keeps a crash reproducible from one file.
2) **Opening the send-rate window.** At the default rate only about two packets go in flight,
   because with no acks coming back the congestion window never opens. Setting the send rate
   very high puts all 24 messages in flight.
3) **A startup self-check.** The harness prints how many packets it primed. If that ever reads
   0, {=glitch: the whole surface is inert=} and the fuzzer would run for hours covering nothing.

After that, each input is a sequence of ack frames, built from typed fuzzer fields and the
connection's live next-send number, so the acks land on packets that are really in flight.

## Same Pattern, Different State

The second place this paid off was peer-to-peer connections. GNS has a symmetric mode where
{=flow: two peers can dial each other at once=}. When that happens, one side finds its own outbound
connection to that peer, runs a tiebreak, and may switch it from client to server. That
role-change function was completely uncovered, because nothing existed to collide with.

The harness opens a real outbound connection, reads the virtual ports the library assigned,
and sets the fuzzer's mutated connect request to match, so the collision happens on every
input. The role-change function went {=trophy: from 0% to about 54% covered=}.

## What It Found, And What It Costs

On the ack accounting: nothing, and I think that's a real result. About 2.5 hours under ASan
(AddressSanitizer) with 12 to 14 instances produced zero crashes, and so did a 45-minute run under
the assert oracle (21.7 million executions).

The costs: the primed state is one fixed shape (24 equal packets on one lane), there's no real
timing (retransmits only happen when the fuzzer nacks), and it's slow, at 130 to 240
executions a second.

That clean assert-oracle run came with an asterisk, though. The first time I ran it, it saved
439 crashes, and for a few minutes I thought I had something. Every one was my own harness. That
was the third time on this project a "finding" turned out to be me, so it's worth going through
all three, because {=point: nothing goes to a vendor until I understand its root cause=}. If
Valve's engineer spends an hour discovering my harness built an impossible situation, they'll
read my next report more skeptically.

## Uninitialized Memory On The Wire

With coverage flat, one way to find something new is a new oracle. MemorySanitizer (MSan) catches
reads of uninitialized memory, which ASan and UBSan can't see, so I added a build with it. Its
first real report said GNS was sending {=glitch: uninitialized memory in a handshake packet=}: 128
of the 217 bytes in a connect request. It looked like a textbook information leak. It was
deterministic, it reproduced with encryption on and off, and the function that sends the packet
doesn't zero its buffer first.

So I recorded it as a confirmed finding. That lasted less than a day, until I traced where the
128 bytes came from:

- 32 bytes: the certificate's public key
- 32 bytes: the ephemeral key-exchange key
- 64 bytes: the signature over the session crypto info

{=trophy: 32 + 32 + 64 = 128=}, with nothing left over. All three are generated by
{=arcane: OpenSSL=}, which my MSan build hadn't instrumented. MSan can only track memory written by
code it compiled, so anything an uninstrumented library writes looks uninitialized, even a
freshly generated key. When I told MSan to treat just those three outputs as initialized, the
packet went out with zero flagged bytes.

My "confirmations" never tested the right thing. Encrypted mode generates its keys with OpenSSL
too, so of course it reproduced there. The real fix was the expensive one I'd been putting off:
build OpenSSL from source under MSan, so {=iron: the whole dependency stack is instrumented=}.

## A Crash In My Own Stand-In

One of the stateful harnesses crashed on a null socket, and the null came from my harness's
stand-in for the network, not from anything the library did with attacker bytes. It's the most
common kind: a harness fakes the parts around the code it's testing, and
{=ghostly: every fake is a place to manufacture a crash=} no attacker could cause.

## 439 Crashes, One Bug, Mine

Back to the ack harness. Under the assert oracle it {=static: saved 439 crashes in one run=}, and
every one was the same assert: the time between sending a packet and receiving its ack was
negative. The cause was two clocks. The harness primed its in-flight packets using the library's
real clock, then delivered the fuzzed acks stamped with a fixed logical clock that was *earlier*.
So GNS was handed acks for packets that, by its own clock, hadn't been sent yet, and its assert
correctly said that's impossible. What I checked before believing that:

1) Replayed 8 of the 439 inputs. All 8 hit the identical assert.
2) Fixed the harness to stamp acks with the real clock.
3) Replayed the same 8 inputs: {=trophy: 0 of 8 crashed=}.
4) Re-ran the campaign: 45 minutes, 21.7 million executions, zero assert crashes.

So that surface held up under both oracles, and the 439 were me lol.

## What I Check Now

- **Does it reproduce from the one file, in a fresh process?** If not, it's a lead at best.
- **Whose code is at the top of the stack?** The target's, mine, or a library the sanitizer
  can't see into?
- **Could the setup happen in the real world?** An ack from the future can't.
- **Does the explanation account for everything?** 128 bytes that split exactly into 32 + 32 +
  64 is an explanation. "It's probably a leak" wasn't.
- **Could the experiment have come out differently if I were wrong?** My encrypted-mode test
  couldn't have, so it proved nothing.

The last piece of work was going back over every harness and writing down what it actually
reaches, which caught two harnesses doing less than I thought: [threat models, and the
results](/posts/gns-fuzzing-results/).
