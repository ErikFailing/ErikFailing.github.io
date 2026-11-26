+++
title = 'This Site'
description = 'erikfailing.com: a static Hugo site with a hand-built color accent system, hardened the way I would harden anything else I ship.'
date = 2026-10-30T17:45:00-05:00
draft = false
number = 1
aliases = ['/series/building-this-site/']
status = 'Live'
role = 'Solo'
year = 2026
tags = ['Hugo', 'GitHub Actions', 'Web', 'Security', 'Design']
weight = 20
accent = 'arcane'
pattern = 'grid'
[[links]]
  name = 'Source on GitHub'
  url = 'https://github.com/ErikFailing/ErikFailing.github.io'
+++

This site is a static {=hugo: Hugo=} site on the PaperMod theme, built and deployed by
{=flow: GitHub Actions=} to GitHub Pages, with my own domain pointed at it. There's no server to
patch, no database and no hosting bill, so the attack surface is basically a folder of HTML
files.

## What I built

- **The site itself.** Hugo for a single binary and fast builds, PaperMod pulled in as a Git
  submodule so a theme update never lands by surprise, and every customization kept in my own
  layouts and CSS so the theme's files stay untouched.
- **The color accents.** The colored phrases in posts are placed by hand with a small inline
  marker, after two automatic versions that colored words instead of ideas. Every color passes
  {=clarity: WCAG AAA contrast=} on the dark background, and a misspelled style fails the build.
- **The hardening.** SPF and DMARC records so nobody can send mail as my domain, a build pipeline
  that verifies its Hugo download and gives the build job no right to publish, a strict
  {=ward: Content-Security-Policy=} with no inline scripts or styles, HSTS with preloading, and CAA
  records.

## Results

- Mozilla HTTP Observatory went from a D (30) to a {=trophy: B (75)=}, which is about the ceiling
  for a site on GitHub Pages without putting another service in front of it.
- The biggest real gap turned out to be email spoofing, on a domain that never sends email.
