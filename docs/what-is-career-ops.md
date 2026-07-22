---
title: What is career-ops
description: Introducing career-ops, the open source career management tool.
---

career-ops is an open-source job-search system that runs inside your AI coding assistant. You give it a job posting URL or raw text and it reads the description, scores the role against your background across six dimensions, generates a tailored PDF resume citing specific lines of your CV, and logs everything to a local application tracker — all in one command, without spreadsheets, without an account, and without your data leaving your machine.

career-ops was built by [Santiago Fernández de Valderrama](https://santifer.io/about) to manage a real AI-era job search in early 2026: 740 listings evaluated against an explicit rubric, one Head of Applied AI role landed at Zinkee. He open-sourced it under MIT once he no longer needed it, so anyone running a structured job search can use the same system for free, on their own machine, with the AI model they already pay for.

## Philosophy

### Open source, seriously

career-ops has no paid tier, no waitlist, no account, and no telemetry. You clone the repo, fill in a YAML config, drop your CV in markdown, and run the system locally with whichever AI coding CLI you already use. Your CV, your profile, and your application history never leave your machine unless you push them somewhere yourself.

The project grows through community contributions reviewed in the open: when someone adds a company portal scraper, improves the scoring rubric, or fixes a bug, that improvement ships to everyone in the next release. That is the whole business model — there is no upsell, no enterprise tier, no data sale planned. The system is MIT-licensed forever; even if the maintainer stops shipping, the rubric, the prompts, and the scrapers stay yours to fork, audit, and run.

> **Want to contribute?**
> Read the [contributing guide](https://github.com/santifer/career-ops/blob/main/CONTRIBUTING.md) before opening a pull request. The short version: open an issue first to discuss the change, then submit your PR. The maintainers review quickly.

### AI-native and agnostic

career-ops does not ship its own AI model. It runs as a set of slash commands and prompt files inside whichever AI coding CLI you already trust: Claude Code, Codex, OpenCode, Gemini CLI, Qwen CLI, or GitHub Copilot. The AI does the reasoning; career-ops supplies the structure, the scoring rubric, the company-portal scrapers, and the data contract that keeps your files yours.

This architecture means you are not locked into one provider's roadmap or pricing — when a better model ships, you switch your CLI and career-ops runs on top of it unchanged. The same six-dimension rubric produces comparable reasoning whether you point it at a Claude, OpenAI, Gemini, or Qwen model — pick the engine that fits your cost, quality, and privacy profile, and swap freely as the landscape evolves.

## When to use career-ops

career-ops is the right tool when you are running an active, structured job search — not casually browsing. It works best for candidates who:

- have a CV they are happy with and want to tailor per application without rewriting it manually each time,
- are tracking multiple applications and want a single source of truth instead of a sprawling spreadsheet,
- want to apply only to roles that actually fit rather than everything vaguely relevant, and
- are comfortable running commands in a terminal even if they do not write code professionally.

career-ops is probably not what you need if you are sending one or two applications and are done. The setup — cloning the repo, configuring your profile, adding your CV — takes about fifteen minutes, an investment that only pays off once you are evaluating more than a handful of roles.

## What it is not

career-ops is a **filter**, not an amplifier. Most AI job-search tools optimise for volume — apply faster, apply to more. career-ops is designed to do the opposite: say no often, surface higher-conviction matches, and deliver applications that respect both your time and the recruiter's.

Here is what the system will never do, by design:

### Not an auto-applier

The system evaluates, scores, generates, and tracks — but every submission is your decision. Nothing goes anywhere without your explicit approval. The agent stops before the final "Submit" button every time. This is not a safety caveat bolted on after launch — it is the core architectural constraint. The 4.0/5.0 scoring threshold actively recommends *against* applying to most roles the system evaluates.

If you are looking for a tool that clicks Apply while you sleep, career-ops is the wrong tool. See [career-ops vs LazyApply](/compare/career-ops-vs-lazyapply) and [career-ops vs JobHire.AI](/compare/career-ops-vs-jobhire) for the full philosophical contrast.

### Not a resume creator

You bring the CV you already have in `cv.md`. career-ops reads it, matches it against each job description, and generates a *tailored version* citing specific lines of your experience — but it does not write your resume from scratch. More importantly, it does not invent experience, metrics, or qualifications that are not already in your file. If a skill is not in your CV or your article digest, the agent will not claim it.

The source CV is never overwritten; personalised outputs go to a separate `output/` folder.

### Not a hosted SaaS

There is no account, no cloud, no telemetry. career-ops runs on your machine, inside the AI coding CLI you already trust. Your CV, your profile, and your application history never leave your disk unless you push them somewhere yourself. The only network traffic is whatever your configured CLI sends to its LLM provider — and even that can be eliminated once local-model support ships ([PR #561](https://github.com/santifer/career-ops/pull/561)).

### Not a content factory

career-ops does not write LinkedIn posts, optimise your profile headline, draft cold emails at scale, or generate "thought leadership." It does not use anti-bot fingerprint masking to evade detection ([PR #235 — rejected by design](https://github.com/santifer/career-ops/pull/235)), and it does not scrape LinkedIn ([#238 — approved in concept but not shipped](https://github.com/santifer/career-ops/issues/238)). It is a pipeline for evaluating and applying to jobs — one good application at a time.

### Your data is sovereign

The boundary between system code (which updates with each release) and user data (which never gets overwritten) is enforced by [`DATA_CONTRACT.md`](https://github.com/santifer/career-ops/blob/main/DATA_CONTRACT.md) in the repository. Your CV, your profile, your tracker, and your reports are yours — career-ops reads them but will never silently rewrite or delete them, across any release. Even if the maintainer stops shipping, the rubric, the prompts, and the scrapers stay yours to fork, audit, and run.

There is no data sale, no analytics pipeline, no telemetry endpoint. The whole project is MIT, free, local-data. That is the model. There is no other.
