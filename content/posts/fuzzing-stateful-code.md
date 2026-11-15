+++
title = 'Fuzzing Stateful Code: Prime The State, Then Attack It'
date = 2026-11-15T10:40:00-06:00
draft = false
number = 8
description = 'A lot of protocol code only runs once a connection already holds state. How my GameNetworkingSockets harnesses build that state first, and keep crashes reproducible anyway.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'Security']
+++

A lot of the interesting code in a network library only runs when a connection already holds
state: packets in flight, a half-open handshake, a second connection to collide with. A harness
that feeds bytes to a fresh connection never gets there. The pattern that reached that code in
GameNetworkingSockets was to {=point: prime real state first, then feed it hostile input=}, and I
think it's the most reusable thing I took from the project.

## The Rule Everything Else Follows

Before the pattern, one rule: every input has to be self-contained. My stateful harnesses stand
up a real in-process connection over loopback, and they {=ward: rebuild it for every single input=}.

That's expensive. The stateless parsers run at 40,000 to 100,000 executions a second, and the
connection harnesses run at about 500. But an earlier version of my multi-packet harness kept
one connection alive across inputs to go faster, and its crashes depended on everything the
campaign had sent before. They didn't reproduce from the saved file, and {=point: a crash I can't
reproduce is a crash I can't report=}. So the rebuild stays.

Getting a rebuild loop to work at all took some digging in GNS:

- **No background thread.** GNS normally services connections on its own thread. It exports a
  manual-poll mode (declared in no public header) that stops that thread from ever starting, so
  {=ward: the harness decides exactly when the library runs=}.
- **Force-destroyed connections.** A normal close leaves the connection lingering on wall-clock
  timers that never advance in a tight fuzzing loop, so every input leaked a UDP socket and the
  run died with {=glitch: "too many open files"=}. The harness runs the same destroy sequence GNS's service
  thread runs, and memory stays flat.
- **Real entry points.** Inputs go in as whole UDP packets through the real receive function,
  not by calling the decoder directly. That way every bit of state is initialized the way a
  real packet would leave it.

## The Code That Never Ran

Even with three harnesses on the SNP reliability layer, a coverage report showed {=crimson: 23 of its 62
functions had never run=}. The biggest reachable chunk was the sender's side of acknowledgments.
When a peer acks or nacks packets you sent, GNS walks a map of in-flight packets, erases the
acked ones, releases their data, and queues the nacked ones for retransmit. That's
{=ghostly: iterator-and-erase code=} driven by fields the peer chooses, which is exactly the kind of
place a use-after-free could hide.

My harnesses never reached it because they only ever received. The connection being fuzzed had
barely sent anything, so {=iron: its in-flight map was empty=} and every fuzzed ack had nothing to
acknowledge. The problem was the connection's state, and no amount of mutating the input can
change that.

## Priming In-Flight Packets

So the new harness sets the state up itself, {=ward: with the library's own API=}, before the fuzzer gets
a turn:

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

1) **Destroying the client.** If the other end stays alive it acks everything, and the map
   drains before the fuzzer touches it. With the client gone, the packets sit unacknowledged
   forever, and the fuzzer's acks are {=static: the only thing changing the map=}. That's also what
   keeps a crash reproducible from one file.
2) **Opening the send-rate window.** At the default send rate only about two packets go in
   flight. With no acks coming back, the congestion window never opens, so the rest of the burst
   sits in the send queue. Setting the minimum and maximum send rate very high takes rate out of the
   picture, and all 24 messages (each 1,100 bytes, so each gets its own packet) go in flight.
3) **A startup self-check.** The harness prints how many packets it actually primed. If that
   ever reads 0, {=glitch: the whole surface is inert=} and the fuzzer would happily run for hours covering
   nothing.

After that, each input is a sequence of ack frames. The harness builds them from typed fuzzer
fields and reads the connection's live next-send number, so the acks land on packet numbers
that are really in flight instead of being thrown out by the first range check.

## Same Pattern, Different State

The second place this paid off was peer-to-peer connections. GNS has a symmetric mode where {=flow: two
peers can dial each other at the same time=}. When that happens, one side finds its own outbound
connection to that peer, runs a tiebreak, and may switch its existing connection from client to
server. A coverage report showed that role-change function completely uncovered, even with two
P2P harnesses already running, because {=crimson: nothing existed to collide with=}.

The harness for it does the same three moves:

- **Prime:** open a real outbound symmetric connection to a fixed peer identity.
- **Read live state:** look up the virtual ports the library assigned to that connection.
- **Attack:** take the fuzzer's mutated connect request and set its identity and ports to
  match, so the collision happens on every input instead of basically never.

Everything else in the request (the certificate, the crypto info, the ICE candidates) stays as
the fuzzer mutated it. The role-change function went {=trophy: from 0% to about 54% covered=}.

## What It Found, And What It Costs

On the ack accounting: nothing, and I think that's a real result. About 2.5 hours under ASan
with 12 to 14 instances produced zero crashes. So did a 45-minute run under the assert oracle
(21.7 million executions), once I'd fixed a bug in my own harness that had produced 439 fake
ones. That story is in [the triage post](/posts/my-early-crashes-were-my-own-harness/). The
corpus grew from 24 seeds to about 3,200 inputs, so the fuzzer was definitely exploring the
accounting. It just {=trophy: held up=}.

The trade-offs are worth being plain about:

- **The primed state is one fixed shape.** Always 24 equal-size packets on one lane. Different
  sizes, partial sends or multiple lanes would give different in-flight layouts, and I haven't
  fuzzed those.
- **No real timing.** With the client gone, retransmits only happen when the fuzzer nacks
  something, never from a timer expiring.
- **It's slow.** Priming on every input puts this harness at 130 to 240 executions a second,
  among the slowest in the suite.

Overall, I think {=point: the recipe carries to any stateful target=}: find the code that only runs with
state, build that state through the real API, freeze it so only the fuzzer changes it, check at
startup that the priming worked, and rebuild it for every input.
