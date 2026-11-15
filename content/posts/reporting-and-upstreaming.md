+++
title = 'Reporting To Valve And Offering The Harnesses Upstream'
date = 2026-11-15T11:50:00-06:00
draft = true   # Unfinished on purpose: the story isn't over. Publish after the fix ships and the maintainers reply.
number = 15
description = 'How I sorted the GameNetworkingSockets findings by where each belonged, what a duplicate report taught me, and how I asked before sending a pull request.'
series = ['Fuzzing GameNetworkingSockets']
tags = ['Fuzzing', 'Disclosure', 'Valve', 'Security']
+++

TODO: This post stays a draft until two things happen: Valve ships a fix for the finding I
reported, and the maintainers reply about the harnesses. Everything below is what can be said
today. Fill in the TODO sections and rewrite this opening summary before publishing.

The fuzzing produced three kinds of output: a memory-safety finding, a few undefined-behavior
findings, and the harnesses themselves. Each one belonged in a different place. This post is how
I sorted them, what happened when I reported, and how I asked the project before sending code.

## Sorting Findings By Where They Belong

GameNetworkingSockets'
[SECURITY.md](https://github.com/ValveSoftware/GameNetworkingSockets/blob/master/SECURITY.md)
is clear about the first one: if you think you've found a vulnerability, don't file a public
issue or pull request, {=trophy: report it through Valve's HackerOne program=}. So that's the split
I used:

- **The memory-safety finding** went to HackerOne, privately.
- **The undefined-behavior findings** only show up under UBSan and corrupt no memory. I think
  the right weight for those is a hardening fix upstream, not a vulnerability report.
- **The harnesses** hold no bug and no crashing input, so how to contribute them can be
  discussed in public.

## Checking For Duplicates, And Why I Couldn't

Before reporting anything I re-ran every finding against a fresh build, confirmed that
upstream master was still the exact commit I'd been fuzzing, and searched the GNS issue tracker
and the CVE databases for anything matching. Nothing did.

I filed the report on November 12, 2026, and it was closed the same day as {=glitch: a duplicate of
an earlier private report=}. So the bug was real, and someone else had found it first.

I think the lesson is about what a duplicate check can and can't do. Reports on HackerOne are
private unless they've been disclosed, so a researcher only sees their own reports and the
publicly disclosed ones. My search of public sources was done properly, and it still couldn't have
found this. {=point: The vendor's own triage is the only real duplicate check=} when reports are
private, and the only way to run it is to file.

TODO: Timeline table (found, reported, closed as duplicate, fixed, published), once there is a
fix date.

## Asking Before Sending A Pull Request

For the harnesses, the first contact was a question, not a pull request. The maintainer's
interest in fuzzing was in
[issue #410](https://github.com/ValveSoftware/GameNetworkingSockets/issues/410), which is
closed and was a conversation with someone else, so I opened
[a new issue](https://github.com/ValveSoftware/GameNetworkingSockets/issues/475) that points
back to it. It says what I have, and asks three things:

1) Where should fuzz targets live in the tree, and how should they hook into the build?
2) Should they be shaped for OSS-Fuzz, or just be runnable locally?
3) Are there conventions to follow for entry points, seed corpora and dictionaries?

It names no crash and no finding, and says anything found through the harnesses will be
reported privately. I'd rather {=flow: match the project's structure=} than hand over a
several-thousand-line pull request shaped the way I happened to build things.

TODO: The maintainers' reply, and how the harnesses changed to fit what they asked for.

TODO: Link the pull request(s) once they exist.

## Why The Code Isn't Public Yet

A fuzzing harness that reaches an unfixed bug is a signpost. Anyone who builds it and runs it
finds the same bug I did. So {=ward: nothing that points at the unfixed finding goes public=}
before the fix does. The simplest way to be sure of that is to keep the whole suite private for
now, and work out with the maintainers what lands upstream and when.

TODO: After the fix ships: what was held back and why, the root cause, the impact stated
precisely, and the fix itself, with credit to the maintainers and to the earlier reporter if
they're named publicly.

## What I'd Take From It

TODO: Write this once the story has an ending.
