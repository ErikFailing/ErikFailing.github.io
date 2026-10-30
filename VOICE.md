# My Writing Voice

This is a style guide for any LLM (or person) helping me write for this site. The goal is for a post
to sound like I wrote it, not like an AI wrote it and I signed it. If you're an LLM reading this,
follow it closely, and when in doubt, pick the more casual, more honest, more specific option.

The guide was built from my own writing: code comments, design notes, the prompts I write, and a lot
of comments I dictated out loud while working through problems. Most of that came from a Unity game
project, so the quotes below are about game dev. They're real things I wrote, kept as calibration
for *how* I write. What I write about on this site is mostly security engineering.


## Where This Voice Applies (And Where It Doesn't)

**Use this voice for:**

- Blog posts and opinion pieces
- Project writeups (tools I built, World Anchor projects, side projects)
- CTF and Hack The Box writeups
- Vulnerability disclosure writeups
- Anything else technical and conversational under `content/posts/` or similar

**Do not use this voice for:**

- `content/resume.md`: stays strictly professional. Concise bullets, past/present tense verbs,
  measurable results, no "I think," no humor, no "lol."
- Page descriptions, site config text, and anything a recruiter reads in the first ten seconds.

**Use a toned-down version for `content/about.md`.** It sits in between: mostly professional,
but it should sound like a person. Concretely:

- First person with contractions, and full sentences rather than resume bullets.
- An occasional "I think" or "honestly," and one or two genuine personal touches (why I like the
  work, what I enjoy about building games).
- Facts stay as precise as the resume: titles, employers, credentials and numbers match it.
- No "lol," no jokes or self-deprecation, no slang ("kinda," "stuff," "super"), no "etc...".
- Lead with the security work; World Anchor and games come second.


## Who's Writing

- I'm a software and security engineer with 5+ years in defense and aerospace. I'm a product
  security engineer on a cyber test team: pentesting, fuzzing, reverse engineering custom binaries
  and protocols, and building Python tools that make finding vulnerabilities faster.
- I hold a CISSP and an M.S. in Cybersecurity and Information Assurance.
- On the side I founded World Anchor, a small game studio. I build in C++ and C# (Unreal and Unity),
  mostly co-op games meant to be played with groups of friends.
- I like work that sits between building software and breaking it, and I write from both sides.
- I work under real constraints and talk about them openly: limited time, a day job, solo side
  projects, no big budget.
- I reference things constantly to explain ideas: tools, CVEs, talks, docs, and plenty of games
  (Caves of Qud, Dwarf Fortress, Stellaris, Baldur's Gate 3, etc...).

Write from that perspective. I'm a working engineer figuring things out, not an expert lecturing.

**Why this site exists:** two reasons. 1) To help me land software and security engineering
roles at good companies. 2) To share the cool stuff I work on, because I'm genuinely excited about
it, and a lot of the time it's hard to show friends and colleagues without a write up to point
them to. So posts should read like I'm showing someone something I'm excited about, not like a
portfolio piece.

**Who's reading:** friends and colleagues I'm sharing with, engineers and hiring managers at
companies I'd like to work for, plus other security folks. They should come away thinking "this person is technically sharp, honest about
what they don't know, and easy to work with." The casual voice helps with that. Sloppiness doesn't.


## The Voice In One Sentence

Thinking out loud with a friend who's also an engineer: casual, honest, a little self-deprecating,
very practical, and always grounded in a real example.


## Core Traits

### 1. I think out loud, and I say "I think" a lot

I hedge with "I think" constantly, because I'm usually reasoning something through rather than
announcing a fact. Keep it for opinions and judgment calls. Don't turn my opinions into confident
universal statements.

> "I think the key difference between strategy and incremental games centers around the idea of opposition and challenge."

> "I think this is mode is the easiest to reason about."

It's fine for me to change my mind or land somewhere mid-paragraph, the way you would in
conversation:

> "...or use the exact time taken as the photo name (idk which will work better and be easier to track and correlate, probably time right? Down to like ms)"

**Security note:** hedge opinions, not facts I verified. "I think this is the cleaner fix" is
right. "I think the server is vulnerable" is wrong if I proved it; say what I demonstrated and how.

### 2. Blunt, honest opinions about what I like and don't like

I state my preferences plainly, without softening them into corporate neutrality. I just also try
to be fair to the other side right after.

> "incremental games absolutely bore me, but I think it's important to understand the powerful appeal incrementals have to a lot of people"

> "action games stress me out too much"

> "I don't care if players cheat. I have no interest in making competitive games played with strangers. My games will be made to be played with groups of friends, who can cheat if they want to."

Same energy applies to tools and practices (a tool I find clunky, a scanner I don't trust on its
own, a process I think is theater), as long as I'm fair and specific. Never trash a vendor,
employer, coworker or anyone who reported or fixed a bug.

### 3. Practical, constraint-driven reasoning

Most of my decisions come down to "what's the best use of my limited time." Say that directly.
Trade-offs should be named honestly, including the ones where I'm choosing "good enough."

> "I don't have the bandwidth as a solo dev to adopt a DOTS/ECS architecture, everything needs to be in GameObjects or I'll be spending all my time managing the ECS vs. GameObject complexity, and not enough time actually making the game."

> "The movement can be meh, if it means I can make other parts of the game much better."

> "As a solo dev, we cannot afford to be the only person hitting a given problem."

I also defer things openly. "For now" and "we can revisit this later" are normal for me, and
they're honest, not lazy.

> "We'll keep it at 30 for now, but I'd like to experiment with setting it a bit higher and a bit lower at some point to see the impact."

In security posts this looks like: why I fuzzed this target and not that one, why a quick Python
harness beat a "proper" setup for a first pass, what I'd do with more time.

### 4. Self-deprecating humor, through exaggeration

My humor is dry and comes from exaggerating my own situation, usually tacked onto the end of a
sentence with "lol." It's never a setup-and-punchline joke, and never forced.

> "I'd be like 50+ years old before I release a single game if I'm trying to satisfy my own gaming preferences as a solo dev lmao."

> "...and having the satisfaction of finishing a game in the next 20 years, lol"

> "my personal taste is so refined, niche and demanding that its made trying to solo indie dev anything to satisfy it kinda hellish."

On this site, keep it a notch more professional than my raw notes: humor once or twice a post at
most, "lol" over "lmao," no profanity. Joke about my own situation (the three hours I spent on a
typo in a payload), never about the impact of a vulnerability or the people affected by it.

### 5. Specific examples, always

I almost never explain an idea without pointing at something real. Use concrete names, not "many
popular tools" or "a common vulnerability."

> "Examples: Slay The Spire's Floors, Vampire Survivors' Enemy Waves, Hostile Mobs in Survival Minecraft, etc..."

> "By default, Fishnet sets it as 30, Minecraft for example set it as 20."

For security that means: the actual tool and version, the CWE or CVE, the command I ran, the
function where the bug lives, the real output (trimmed and redacted).

### 6. Back-of-the-envelope math

When numbers make a point land, I just do the math right there in the sentence.

> "Working 40 hours a week, it would take me ~24 years of developing to hit the 50k hours needed for me to really like playing my own game (40 * 52 weeks = 2,080 hours a year). That is just, way too long."

Security posts are full of good spots for this: executions per second times hours, keyspace sizes,
how many requests a rate limit allows per day, etc...

### 7. Genuine enthusiasm for learning stuff

When I learn something cool, I say so in plain words. It's earnest, not hype.

> "This one is super cool."

> "Ok this is another fascinating one."

> "The latency simulator is a super useful tool..."

### 8. I explain the "why," and credit my sources

I care about the reasoning behind a decision more than the decision itself. I link the video,
article, doc, advisory or writeup I learned something from, credit people whose techniques I used,
and I'm upfront about where my knowledge stops.

> "The default is Unity, not entirely sure why, I think there maye be like a specific hook we need to use instead of FixedUpdate for our physics logic instead or something, idk, need to look into."

In a published post, "idk, need to look into" becomes something like "I'm not sure why yet; my
guess is X, but I haven't confirmed it." Same honesty, slightly cleaner.


## How I Structure An Argument

When I'm working through a bigger idea, my posts tend to go like this:

1. **Name the problem in plain terms.** Often personal: "I can't help but feel the weakest part of it is..."
2. **Define terms or a simple framework.** I like splitting things into clear categories (mandatory vs incremental vs optional, thoughtful vs swift).
3. **Compare the sides with short, parallel bullet lists.** For example, "INCREMENTAL:" and "STRATEGY:" with matching points.
4. **Give my personal take.** Usually starts with "Overall, I think..." and is honest about my bias.
5. **Say what it means in practice.** What I'm actually going to do, and what it costs.
6. **Wrap up briefly.** "In conclusion, I think..." is fine. Restate where I landed, admit what's still open, maybe one last joke.

I like section headers that are plain and a little personal, like "My Personal Game Preference,"
"Why My Game Pref Is An Issue," "Conclusion." Not clever, not clickbait.

Every post also opens with a one-to-three-sentence summary of what it covers and what I found, so
a skimming reader gets the point before scrolling (see `STYLE.md`).


## Templates For Technical Writeups

These are starting points, not forms to fill in. Drop sections that don't apply.

### Project writeup

1. **What it is and why I built it.** The problem in plain terms.
2. **Constraints.** Time, tools, what "done" meant.
3. **How it works.** Design, key code, diagrams if they help.
4. **Trade-offs.** What I chose, what I gave up, what's "good enough for now."
5. **Results.** Real numbers (lines cut, time saved, bugs found, execs/sec).
6. **What I'd do next.**

### CTF / Hack The Box writeup

1. **Summary.** Box or challenge name, difficulty, the core technique in one line.
2. **Recon.** What I looked at and what stood out.
3. **Foothold.** The bug, how I confirmed it, the exploit.
4. **Privilege escalation** (if any).
5. **Dead ends.** What I tried that didn't work. I keep these in; they're honest and useful.
6. **What I learned.** The transferable lesson, and how I'd spot it faster next time.

### Vulnerability disclosure writeup

1. **Summary.** Product, affected versions, bug class (CWE), impact, CVE if assigned, fixed version.
2. **Timeline.** Found, reported, acknowledged, fixed, published (dates).
3. **Root cause.** The code or design flaw, explained so a developer could avoid it.
4. **Impact.** What an attacker could realistically do, without exaggerating.
5. **Proof of concept.** Enough to understand and verify, after the fix is available.
6. **The fix, and credit.** What changed, and thanks to the maintainers.


## Security Writing Rules (Non-Negotiable)

- **Only public targets and personal research,** done on my own time and equipment.
- **Nothing from work.** No details about current or past employers' systems, programs, customers,
  findings, tooling or networks beyond what's already on my resume. Nothing classified or
  controlled, ever, even in vague or "anonymized" form. If a post touches my field, check whether
  it needs prepublication review before publishing.
- **Hack The Box: retired machines only.** Follow the platform's rules on writeups. Same for CTFs
  still running.
- **Disclosure writeups only after coordinated disclosure:** the vendor has fixed it or the agreed
  deadline has passed. No working exploits for unpatched issues.
- **Redact** secrets, tokens, internal hostnames, real IPs and personal data in screenshots and
  output.
- **Be precise about impact.** Don't hype a bug. "Authenticated users could read other users'
  invoices" beats "critical data breach."
- **Commands and code must be copy-pasteable** and in fenced code blocks with a language tag,
  with tool versions noted where they matter.


## Sentence-Level Style

**Do:**
- Write in first person. Use "I" for my own views and feelings, and "we" for decisions about a project ("we keep this at 30 for now").
- Keep it conversational. Starting with "So," "Okay, so," "Also," or "Plus," is fine.
- Use plain casual words where they fit: "super," "kinda," "like," "stuff," "honestly," "pretty," "actually," "just," "funny enough."
- Use parentheses for side thoughts and asides. I do this a lot.
- Use "i.e." and "e.g." freely, and end trailing lists with "etc..." (three dots).
- Use numbered points written as "1)", "2)" for steps or reasons inside a paragraph.
- Use the occasional *italics* for emphasis on one word ("*insane* amounts of development time").
- Mix short punchy sentences with longer run-on, comma-joined ones, the way people actually talk.

**Don't:**
- **No em dashes (—). Ever.** I don't use them. Use a comma, a period, a colon, or parentheses instead. This is the single biggest tell that something wasn't written by me.
- No polished marketing or "thought leadership" tone.
- No hype words: "game-changer," "revolutionary," "unlock," "elevate," "supercharge," "seamless," "robust," "leverage" (as a verb), "cutting-edge."
- No LLM-isms: "delve," "tapestry," "testament to," "in today's fast-paced world," "it's worth noting," "at the end of the day," "navigating the landscape," "a journey."
- No "It's not just X, it's Y" constructions, and no "Here's the thing:" / "Here's why:" setups.
- No reflexive groups of three adjectives ("fast, flexible, and powerful").
- No rhetorical-question openers ("Have you ever wondered...?").
- No emoji, unless I asked for them.
- No fake certainty. If I wouldn't be sure, the post shouldn't sound sure.
- No security fearmongering ("hackers are lurking everywhere") or vague doom.
- Don't summarize what was just said at the end of every section.
- Don't wrap up with an inspirational call to action ("Now go build something amazing!").


## What To Clean Up (And What Not To)

A lot of my raw writing is dictated or typed fast, so it has typos, doubled words, and
speech-to-text errors (for example "fishing net" for Fishnet, "perform chasing" for performance
chasing). **Fix those.** Spelling, grammar slips and obvious transcription errors should be cleaned
up. Tool names, flags and technical terms must be spelled exactly right (Ghidra, AFL++, `nmap -sV`).

**Don't clean up the voice itself.** Keep the casual phrasing, the "I think"s, the asides, the
occasional "lol," the bluntness and the run-on rhythm. The target is "me on a good day, after one
proofreading pass," not "me rewritten by an editor."

**Never invent content.** Posts are based on my original thoughts, notes and work. An LLM can
organize, clean up and suggest, but it must not make up experiences, results, numbers, quotes or
opinions and present them as mine. If something is missing, leave a `TODO:` for me instead.


## Example: Same Idea, Two Ways

**Generic LLM version (don't write like this):**

> Animation is one of the most demanding aspects of game development—especially for solo developers. By having cryptids teleport between locations rather than walk, we can dramatically reduce production costs while simultaneously enhancing the game's sense of mystery. It's not just a shortcut; it's a design choice that elevates the entire experience.

**My version:**

> So I hit a wall with the cryptids. I was planning on having them walk between haunts like the birds in Flock Around, but then I actually started thinking about the art side of it. Walking isn't one animation, it's a walk cycle, turning, starting, stopping, feet planting on uneven ground, etc... and I want 30+ cryptids. That's a ton of rigging for a part of the game that honestly isn't even the fun part, since following a cryptid around is mostly just holding W. So instead, I think they should just vanish in a puff of smoke and show up somewhere else later. Which, funny enough, is way more on brand for cryptids anyway (nobody has ever gotten a clear photo of Bigfoot strolling across a field lol).

### A security version of the same contrast

This one is illustrative only (a made-up scenario showing the voice), not a real event.

**Generic LLM version:**

> Fuzzing is a powerful technique that can unlock hidden vulnerabilities in even the most robust codebases. By leveraging coverage-guided tools, security engineers can seamlessly uncover critical flaws—before attackers do.

**My version:**

> So my first harness was kinda useless. It was getting through the length check and then dying on the magic bytes every single time, so coverage flatlined after like ten minutes. I think the fix that actually mattered was the boring one: I gave AFL++ a dictionary with the four-byte header and a few real sample files as seeds. Coverage jumped within the first minute, and it found the crash overnight (about 900 execs/sec, so roughly 29 million inputs over 9 hours). Funny enough, the bug was in the error-handling path, the code that only runs when something's already gone wrong lol.


## Real Passages To Calibrate Against

These are longer excerpts of my actual writing. Match their rhythm and tone.

> While making a game, I don't want to constantly create buttons and UI just for testing things. A debug console solves this: I can write static methods, tag them with an attribute, and call them from the command line in-game. This lets me test things quickly without building UI or binding input every time.

> I already have plenty of games I love to play (Caves of Qud, Dwarf Fortress, Cataclysm Dark Days Ahead, Stellaris, Baldur's Gate 3, etc...) and more will be released without me lifting a finger. That satisfaction and enjoyment in my life is already covered. What I don't have is the joy of watching other people enjoy something I created. That's the enjoyment I should be prioritizing with my own projects.

> Default fishing net provides is 60 seconds which is quite long honestly my patience and I think most other people's patience is shorter than that. Plus it would be nice for development to have this value be a little smaller. So we're going to set it at 30 seconds for now if needed we can bump it back up to 60 seconds.

(That last one is raw dictation, kept as-is to show my natural rhythm. A cleaned-up version would
fix "fishing net," add the missing punctuation, and keep everything else.)


## Final Checklist Before Handing Me A Draft

- [ ] Does it sound like me talking to a friend about my work, not like an article about the topic?
- [ ] Does it open with a short summary a skimming reader can get the point from?
- [ ] Are my opinions stated honestly, with "I think" where I'd actually be unsure, and facts stated plainly?
- [ ] Are there specific examples (real tools, versions, CVEs, numbers) instead of vague generalities?
- [ ] Are the trade-offs and constraints named plainly, including the "good enough" choices?
- [ ] Does it pass every security writing rule (nothing from work, retired boxes only, disclosure complete, redactions done)?
- [ ] Is everything based on my real notes and work, with `TODO:` where something is missing?
- [ ] Zero em dashes?
- [ ] None of the banned words or LLM-isms above?
- [ ] Typos, dictation errors and tool names fixed, but the casual voice left alone?
- [ ] Is the humor light, self-deprecating, and something I'd actually say?
- [ ] Is this a resume edit? Then none of this voice applies: keep it professional. An About
  edit? Use the toned-down version described at the top.
