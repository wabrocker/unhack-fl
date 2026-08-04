# unhack-fl

A civic tool for Florida. Enter your county, get two things you can
actually do this week:

1. **Become a poll worker** — eligibility, training, pay, and how to apply
   in *your* county.
2. **File a public records request** — a correctly-formed Chapter 119
   request, drafted from what you want to know.

Version 1 covers **Florida only**, and says so. Records law, poll-worker
eligibility, and deadlines are state- and county-specific; a national v1
would be either vague or confidently wrong.

## Why these two

Florida's transparency law is unusually strong and its voter-registration
law is unusually restrictive. So this leads with transparency, which is
both more available and more genuinely cross-partisan here. Poll working
is the anchor action: counties are chronically short-staffed, both parties
need workers, it's paid, and the ask is bounded.

## Two non-negotiables

1. **Cross-partisan by architecture.** Actions are weighted toward work
   with genuine support across parties — election staffing, transparency,
   anti-corruption — and away from candidate- or party-specific asks.
2. **Every claim links to a primary source.** The tool summarizes and
   never editorializes. Statutes and county pages are cited so the user
   can always check.

## The AI rule: assisted, not authored

The citizen supplies the substance; the AI supplies structure, facts, and
clarity. Never the reverse.

This is not a style preference. Mass AI-generated civic correspondence is
itself a hack — it exploits the rule that officials treat contact volume
as evidence of constituent opinion, by manufacturing volume without the
constituency. A project named for *unhacking* cannot ship the exploit it
exists to oppose.

Concretely:

- **Refuse to generate positions.** The tool asks what *you* want to know
  or say, and won't proceed until you answer.
- **Draft, never send.** You transmit, having read it.
- **No artificial variation.** Output is never randomized to evade
  form-letter detection.
- **Retrieval-grounded on anything factual.** Statutes and county details
  come from fetched sources, not model memory. A misstated deadline
  embarrasses the user and ends the project's credibility.
- **Jurisdiction-aware or silent.** Florida and its 67 counties only;
  outside that, the tool declines rather than guesses.

## Status

Scaffold. Nothing works yet.

## Layout

```
data/    Florida county reference data (see data/README.md on sourcing)
web/     static frontend — no build step
api/     server-side proxy; holds the Anthropic key, browser never does
docs/    decisions and sourcing notes
```

## License

MIT — see LICENSE. Open source from the first commit, both on principle
and because the funders and fiscal sponsors this project targets require
it.
