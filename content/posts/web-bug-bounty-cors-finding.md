+++
date = '2026-11-26T09:20:00-06:00'
draft = false
title = "Testing Without Credentials, And Why My CORS Finding Wasn't A Finding"
description = 'The no-credential checklist I ran against a bug bounty program, what each clean result actually proves, and a CORS misconfiguration across a shared gateway that turned out to expose nothing, with a local lab that shows why.'
project = 'web-bug-bounty'
tags = ['Bug Bounty', 'CORS', 'OAuth', 'Web', 'Security', 'Python']
+++

With the target list down to eighteen apps, I worked through everything I could test without an
account. Every check held. The one thing that didn't was {=ghostly: a CORS misconfiguration=}
across a shared gateway, and I drafted a report for it before working out that it exposed
nothing. This post is the checklist, the finding, why it wasn't one, and a small local lab
that shows the difference.

## The No-Credential Checklist

Each of these came back clean. A clean result is only worth something if you know what it rules
out, so I've noted what each one proved:

- **Subdomain takeover.** A DNS pass over every in-scope name turned up 14 dangling CNAMEs (DNS
  aliases pointing at names that no longer exist), all pointing at cloud load balancer names the
  provider won't hand out again, so none were claimable.
- **Open redirect.** I sent the login page's return-URL parameter an off-site canary on all 228
  live login hosts, without following redirects, and checked the `Location` header. None
  redirected off-site.
- **Pre-auth SSRF (server-side request forgery).** One app had two routes that make outbound
  connections. Both returned 401 for a
  real ID and a made-up one alike, which means {=ward: auth runs before the handler=}, so the code
  that dials out never runs for an anonymous caller.
- **Login attacks on a local-password app.** Every username, real-looking or not, got an identical
  `401 Invalid credentials`, so no user enumeration. A small, lockout-aware default-credentials
  check got 401 every time. There was no signup and no password reset to abuse.
- **Default credentials on the admin SSO (single sign-on).** A separate small, lockout-aware
  default-cred check (admin:admin and a few obvious pairs) against the identity provider's admin
  login. All rejected, but one username came back with a server error (HTTP 500) where an unknown
  username got the clean `invalid credentials`, which is {=glitch: technically a username-enumeration
  oracle=}: the error difference lets me tell a real account from a fake one. I didn't chase it. A
  username-enumeration oracle on its own isn't worth much, and without some other weakness to chain
  it into, pushing on it further (enumerating real accounts, poking to turn it into more) would be
  a waste of time and outside the rules of engagement anyway. So I wrote it down and moved on. (And
  no, you can't turn that into guessing the password by timing the responses: a login
  runs the guess through a slow hashing function and compares in constant time, so the response time
  doesn't depend on how close the guess is. There's nothing to measure, before network jitter even
  enters.)
- **OIDC (OpenID Connect) redirect validation and PKCE.** `oidc-probe.sh` sends eight
  `redirect_uri` bypass tricks (an extra path segment, path traversal, a scheme downgrade, the userinfo `@` trick, a
  protocol-relative `//`, two substring-confusion tricks and a trailing slash) and compares each
  answer to two controls: the real redirect URI and one never registered anywhere. All eight were
  rejected. Leaving out the PKCE (Proof Key for Code Exchange) parameters got a spec-compliant
  `invalid_request` error back. Across two runs, every trick got a clean rejection.
- **Token forgery.** A 15-row battery against an API method that requires a token: no header, a
  malformed token, `alg: none`, RS256 (RSA-signed) with an empty or bad signature, a swapped
  `kid`, and HS256 (HMAC-signed) tokens using secrets derived from the identity provider's public
  key (algorithm confusion). Every row that answered (14 of 15) got a 401. The error messages
  showed the validator accepts {=ward: exactly one algorithm=}, so the RS256 and `none` tricks
  never got past the first check.
- **Trusted-header spoofing.** Forging a token was a wall, so the other direction is to skip the
  token entirely and see if anything behind the gateway trusts an identity header it should have
  stripped. gRPC-Web passes request headers through as gRPC metadata, so I sent a batch of spoofed
  identity headers (`x-forwarded-user`, `x-remote-user`, and friends) carrying a {=crimson: made-up
  canary identity and no token=}, plus a couple of alternate token locations (a cookie, a different
  metadata key). Every one got a clean rejection. One method answered with different wording than
  the rest (`no credentials present` from the service itself, instead of the gateway's `missing auth
  header`), which told me it reaches the backend's own check rather than stopping at the edge, but it
  still wanted a real credential.
- **Known CVEs.** Targeted nuclei templates for the stack I'd actually fingerprinted, across all 18
  apps. Zero matches.

## The Finding That Looked Real

The CORS (Cross-Origin Resource Sharing) check was `cors-probe.sh`: four `Origin` headers per host
(none, an arbitrary attacker origin, `null`, and a subdomain look-alike), then a check of whether
the response reflects the origin back with `Access-Control-Allow-Credentials: true`. One host did,
for every origin I tried. That's the classic dangerous combination: {=crimson: any website can make
a credentialed request and read the answer=}.

I didn't want to report a header reading, so I built `cors-poc.sh` to prove it in a real browser.
It starts a tiny local web server on its own port, so the browser sees a genuinely different
origin, then runs `fetch(target, {credentials: "include"})` from that page with Playwright. The
browser decides whether the script may read the response, the same check a real attacker's page
faces. It could read it, and the same request through the gateway to a real backend API method
came back readable too.

Then I sized it across every host serving the same login page. Most of them reflected the same
way, and the browser proof read a backend response on every new one I ran it against.

At that point I had a working proof of concept, a gateway-wide blast radius and a drafted report.

## Why It Wasn't A Finding

Before submitting, I went back over the impact chain, and it had a hole in the middle.
`credentials: "include"` sends cookies, HTTP authentication and TLS client certificates. It doesn't
send an `Authorization` header. This app authenticated with {=point: a bearer token in a request
header=}, which the app's own JavaScript adds on the app's own origin. An attacker's page can't add
the victim's token, because it doesn't have it.

So a logged-in victim's browser would make the cross-origin request with no token, and get the
same 401 anyone gets. The only thing an attacker page could read was content that's public anyway
(login-page settings and identity provider metadata, the same things any visitor gets). The
mechanism was real and gateway-wide, but no confidentiality boundary was crossed.

There was one way the finding could still matter: a session cookie that authenticates on its own
and is sendable cross-site (`SameSite=None; Secure`). So I built `cookie-probe.sh` to look for one.
It sends a real browser User-Agent, since these hosts gave non-browser clients a placeholder page,
and doesn't follow redirects, so a cookie on any response counts. Across every reflecting host,
{=trophy: zero `Set-Cookie` headers of any kind=}, on redirects and normal responses alike. It checks plain GETs only, so a cookie set only after a
completed login wouldn't show up.

The finding went down to informational, and I didn't submit it.

## A Local Lab That Shows Both Cases

This is the whole thing in about 60 lines of Python. It runs an "API" on port 8001 with the same
misconfiguration (reflect any `Origin`, allow credentials) and two protected endpoints, one that
authenticates with a cookie and one that wants a bearer token. An "attacker" page on port 8002
tries to read both with `credentials: "include"`.

```python
#!/usr/bin/env python3
# A minimal CORS lab: an "API" on 127.0.0.1:8001 that reflects any Origin with credentials allowed,
# and an "attacker" page on 127.0.0.1:8002 that tries to read it with credentials: "include".
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading

SECRET = '{"account": "victim", "balance": 1337}'


class Api(BaseHTTPRequestHandler):
    def cors(self):
        # The misconfiguration: echo whatever Origin asked, and allow credentials.
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Credentials", "true")

    def reply(self, code, body, extra=()):
        self.send_response(code)
        self.cors()
        for name, value in extra:
            self.send_header(name, value)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        if self.path == "/login":
            # The victim logs in: a session cookie for cookie auth.
            self.reply(200, '{"logged_in": true}', [("Set-Cookie", "session=abc123; Path=/; HttpOnly")])
        elif self.path == "/cookie-auth":
            ok = "session=abc123" in self.headers.get("Cookie", "")
            self.reply(200 if ok else 401, SECRET if ok else '{"error": "no session cookie"}')
        elif self.path == "/bearer-auth":
            ok = self.headers.get("Authorization", "") == "Bearer abc123"
            self.reply(200 if ok else 401, SECRET if ok else '{"error": "missing auth header"}')
        else:
            self.reply(404, '{"error": "not found"}')

    def log_message(self, *args):
        pass


ATTACKER_PAGE = """<!doctype html><pre id="out"></pre><script>
const out = document.getElementById("out");
for (const path of ["/cookie-auth", "/bearer-auth"]) {
  fetch("http://127.0.0.1:8001" + path, { credentials: "include" })
    .then(r => r.text().then(t => out.textContent += path + ": " + r.status + " " + t + "\\n"))
    .catch(e => out.textContent += path + ": blocked (" + e + ")\\n");
}
</script>"""


class Attacker(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(ATTACKER_PAGE.encode())

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    api = ThreadingHTTPServer(("127.0.0.1", 8001), Api)
    threading.Thread(target=api.serve_forever, daemon=True).start()
    print("API on http://127.0.0.1:8001, attacker page on http://127.0.0.1:8002")
    ThreadingHTTPServer(("127.0.0.1", 8002), Attacker).serve_forever()
```

Save it as `cors_lab.py`, then:

```bash
python3 cors_lab.py
```

In a browser, open `http://127.0.0.1:8001/login` first (the victim logging in), then
`http://127.0.0.1:8002/` (the victim visiting the attacker's page). With Python 3.12 and Chrome
157, the page shows:

```text
/cookie-auth: 200 {"account": "victim", "balance": 1337}
/bearer-auth: 401 {"error": "missing auth header"}
```

Same misconfiguration, opposite outcomes. With cookie auth, the browser attaches the victim's
session and the attacker page reads their data. With bearer auth, there's nothing for the browser
to attach. One caveat: both lab origins are on `127.0.0.1`, so they count as the same *site*, and a
default cookie rides along. On the real internet the attacker's site is a different site, so the
cookie would also need `SameSite=None; Secure`, which is exactly what `cookie-probe.sh` looked for.

## What I Took From It

I think the lesson is to {=point: prove the impact chain end to end before calling it a finding=}.
A real browser, a real backend and a gateway-wide blast radius proved the mechanism. What decides
whether anything leaks is what the victim's browser actually sends.
