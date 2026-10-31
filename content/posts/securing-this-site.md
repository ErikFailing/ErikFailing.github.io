+++
title = 'Securing a Static Site'
date = 2026-10-30
draft = true
description = 'The security changes I made to this site, ordered by what they actually stop, from email spoofing down to certificate mis-issuance.'
tags = ['security', 'github-actions', 'dns', 'web']
+++

A static site on GitHub Pages [doesn't have much to attack](=ward): no logins, no forms, no cookies, no
database. But "not much" isn't nothing, so I went through the whole setup (the domain, the build
pipeline and the browser side) and fixed what was worth fixing. Below are the changes in severity
order, what attack each one stops, and the couple of things I decided weren't worth it.

| # | Change | Attack it stops | Severity before |
|---|---|---|---|
| 1 | SPF + DMARC records | Anyone sending email "from" my domain | Medium |
| 2 | Hardened build pipeline | A tampered tool or compromised step changing the live site | Medium (unlikely, high impact) |
| 3 | Content-Security-Policy | Injected scripts running on my pages | Low to Medium |
| 4 | HSTS | First-visit interception on hostile Wi-Fi | Low (**TBD**) |
| 5 | CAA records | A certificate for my domain issued by the wrong authority | Low |

## Email Spoofing: SPF And DMARC

This was the biggest open gap, and honestly not one I expected going in. I don't send any email
from erikfailing.com, so I never thought about it, but that's exactly the problem. With no email
records at all, nothing told receiving mail servers that mail "from" my domain was fake. [Anyone
could send a message as `erik@erikfailing.com` to a recruiter or a colleague](=point), and the receiving
server had no published policy saying to reject it.

For a domain that never sends mail, the fix is [two DNS records](=ward) that say "nothing is allowed to
send as me, and reject anything that tries":

```text
erikfailing.com         TXT  "v=spf1 -all"
_dmarc.erikfailing.com  TXT  "v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s;"
```

SPF with `-all` lists zero allowed senders, and DMARC with `p=reject` tells every receiver that
checks (Gmail, Outlook, Yahoo, etc...) to reject mail that fails. Since I don't send mail from
this domain, there's nothing for these records to break. Gmail already spam-folders a lot of
unauthenticated mail on its own, but that's Gmail's call; these records make it [my explicit
policy everywhere](=ward).

## The Build Pipeline

I think this is the most interesting one, because it's [the only path to something actually bad](=point).
Anyone who can change what the build produces controls the live site, and no browser header can
stop that, since they'd just remove the header too. [Supply chain attacks on CI](=iron) are real: in March
2025, the popular `tj-actions/changed-files` GitHub Action had its version tags repointed to
malicious code, and every workflow using it ran that code on its next build.

So I tightened the [GitHub Actions](=flow) workflow in a few ways:

- **Removed tools I wasn't using.** The workflow I started from (Hugo's official one) downloaded
  Dart Sass on every build and put it on the PATH, without verifying it. My site doesn't use Sass
  at all, so that was a free download of [attack surface](=crimson). Go and Node steps went too.
- **Verified the Hugo download.** The workflow now checks Hugo's tarball against a [SHA-256](=arcane) hash
  from the release's checksums file, written into the workflow itself. If the download ever
  doesn't match, the build fails before Hugo is even unpacked:

```yaml
echo "${HUGO_SHA256}  ${{ runner.temp }}/hugo_${HUGO_VERSION}_linux-amd64.tar.gz" | sha256sum --check --strict
```

- **[Split permissions by job.](=ward)** Before, the whole workflow had the right to publish the site,
  including the build job where Hugo and the theme's code run. Now the build job can only read the
  repo, and only the small deploy job (which just runs GitHub's own deploy action) can publish.
- **Don't leave the token lying around.** `actions/checkout` keeps the job's GitHub token on disk
  by default, [where every later step can read it](=crimson). Nothing after checkout needs it, so
  `persist-credentials: false` removes it.
- **[Dependabot](=flow) for updates.** It opens a pull request when the actions or the theme have updates,
  so nothing goes stale and nothing changes without me reviewing it.

I didn't pin actions to [commit SHAs](=iron). All of them are GitHub's own, and pinning would mean an
update pull request for every minor release. That's a trade-off I'm fine with for now.

## Content-Security-Policy

A [CSP](=ward) tells the browser where scripts, styles, fonts and images are allowed to come from. Mine
only allows the site itself:

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self';
connect-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'none'
```

With no user input, there's no classic [XSS](=toxic) path here. What the CSP covers is content-level
injection: a bad embed pasted into a post, or a malicious contribution that adds a script tag.
Those get blocked, along with any inline script or third-party resource.

Two catches made this more work than a one-liner:

- **GitHub Pages can't send custom headers,** so the CSP lives in a `<meta>` tag. That works for
  most directives, but not `frame-ancestors` ([clickjacking](=ghostly) protection), and not reporting.
- **No `'unsafe-inline'`** meant cleaning up the theme first. PaperMod had three inline scripts,
  which I moved into one self-hosted JS file with a [subresource integrity](=arcane) hash. Hugo's syntax
  highlighting wrote colors as inline `style=""` attributes (75 of them on one post), so I
  switched it to CSS classes.

To be honest about its limits: anyone who controls the build (point 2) can just edit the meta tag,
so [the CSP is defense in depth, not a wall](=point). I tested it by loading every page in headless Chrome
with zero violations, and with a positive control page to make sure violations were actually
being caught.

## HSTS (TBD)

[HSTS](=ward) tells browsers "only ever use HTTPS for this domain." Without it, the very first request to
`http://erikfailing.com` (say, someone typing the address on hotel Wi-Fi) goes out unencrypted
before GitHub's redirect to HTTPS. An attacker on that network can answer it themselves with a
fake copy of the site, a [phishing](=crimson) link, or a cryptominer. Hotspot and ISP script injection has
happened for real (Comcast's Wi-Fi hotspots injected ads into pages back in 2014). Browsers trying
HTTPS first by default shrinks this gap, but doesn't close it.

GitHub Pages can't send custom headers, and HSTS can't be set from a meta tag. My first support
ticket asking GitHub to enable it got [auto-closed](=glitch) because I was on the free plan, so I upgraded to
Pro and reopened it lol.

**TBD:** waiting on GitHub Support.

## CAA Records

Any of the hundreds of certificate authorities browsers trust can issue an HTTPS certificate for
any domain, as long as the requester passes that authority's check. [A CAA record limits it to the
ones I name](=point). GitHub Pages gets its certificates from [Let's Encrypt](=letsencrypt), so that's the only one:

```text
erikfailing.com  CAA  0 issue "letsencrypt.org"
erikfailing.com  CAA  0 issuewild ";"
```

The second line blocks [wildcard certificates](=crimson) entirely, since I don't need one. This stops someone
getting a valid certificate for my domain from a sloppier authority, which they could use to
impersonate the site to someone on their network. It's rare, but it's two DNS records. The one
thing to remember: if GitHub ever switches certificate authorities, renewals would fail until I
update this.

## What I Didn't Bother With

The scanner ([Mozilla HTTP Observatory](=trophy)) took the site from a D (30) to a C (55), which is the
ceiling for meta tags on GitHub Pages. Getting to an A would mean putting [Cloudflare](=cloudflare) in front of
GitHub Pages or moving hosts, and I think that's not worth it, because the remaining headers
protect almost nothing on this site:

- **Clickjacking protection:** there are no buttons that do anything sensitive to trick someone
  into clicking.
- **`X-Content-Type-Options`:** all content is mine, so there's nothing to sniff.
- **`Permissions-Policy`, COOP/CORP:** no camera, mic, location, secrets, or third-party content
  to protect.

A few things were already in good shape too: [DNSSEC](=ward) was on, GitHub's domain verification prevents
someone else claiming the domain on Pages, and there are no wildcard DNS records that could leave
a subdomain open to takeover.

So overall, I think the honest summary is that [the browser headers were the least important part
of this](=point). The real risks for a static site are the accounts and pipeline around it, and the email
records I didn't know were missing.
