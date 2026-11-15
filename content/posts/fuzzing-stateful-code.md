+++
title = 'Fuzzing Stateful Code: Prime The State, Then Attack It'
date = 2026-11-15T10:40:00-06:00
draft = false
number = 8
description = 'A lot of protocol code only runs once a connection already holds state. How my GameNetworkingSockets harnesses build that state first, and keep crashes reproducible anyway.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'cpp', 'Security']
+++

A lot of the interesting code in a network library only runs when a connection already holds
state: packets in flight, a second connection to collide with. A harness that feeds bytes to a
fresh connection never gets there. What reached that code in GameNetworkingSockets was to
{=point: prime real state first, then feed it hostile input=}, and I think it's the most reusable
thing I took from the project.

## The Code That Never Ran

A third overnight campaign, aimed only at the SNP harnesses, came back flat too. A coverage
report showed why: even with three harnesses on that layer, {=crimson: 23 of its 62 functions had
never run=}. The biggest reachable chunk was the sender's side of acknowledgments. When a peer
acks or nacks packets you sent, GNS walks a map of in-flight packets, erases the acked ones and
queues the nacked ones for retransmit. That's {=ghostly: iterator-and-erase code=} driven by fields
the peer chooses, exactly where a use-after-free could hide.

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
with 12 to 14 instances produced zero crashes, and so did a 45-minute run under the assert
oracle (21.7 million executions) once I'd fixed a harness bug that had produced 439 fake ones.

The costs: the primed state is one fixed shape (24 equal packets on one lane), there's no real
timing (retransmits only happen when the fuzzer nacks), and it's slow, at 130 to 240
executions a second.

Those 439 fake crashes weren't the only time I fooled myself. All three are in
[the next post](/posts/my-early-crashes-were-my-own-harness/).
