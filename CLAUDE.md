# unhack-fl — instructions for Claude

A Florida civic tool. Read README.md first — the two non-negotiables and
the assisted-not-authored rule there are binding on code, not just prose.

## Hard rules

- **Never fabricate a statute, deadline, county office, URL, phone number,
  or eligibility requirement.** If it isn't in `data/` with a cited
  source, the answer is "I don't have that — here's the official page."
  This project's entire credibility rests on this. A confident wrong
  deadline is worse than no tool.
- **No API keys in the browser, ever.** All Anthropic calls go through
  `api/`. The frontend calls our own endpoint.
- **The AI never generates the user's position.** It asks what they want
  to say or know, and structures what they supply. See README.
- **Draft, never send.** No feature may transmit on the user's behalf.
- **Never route completed voter-registration forms through this project.**
  Collecting third parties' registration forms can make an organization a
  3PVRO under Florida law (SB 7050), with per-application penalties. Out
  of scope by design, not oversight.
- **Florida only.** Outside FL, decline rather than guess.

## Conventions

- Static frontend, no build step — plain HTML/CSS/JS in `web/`. Keep it
  that way until something genuinely requires otherwise.
- Data in `data/*.json`, each record carrying its `source` and
  `verified` date. Unsourced fields stay `null`.
- Secrets in `.env`, gitignored. Never commit a key; never log request or
  response bodies.
- Plain, jargon-free copy. The reader is a citizen, not a lawyer.

## Design context lives in the vault

Bill's second brain is at `~/projects/claude/claudeObsidian` (see its own
CLAUDE.md). This repo owns *what to build*; the vault owns *why*.

- `3-MOCs/MOC - Unhacking Democracy.md` — project hub, scope, features
- `5-Reference/Florida civic action catalog (v1 draft).md` — the action
  research, tiering, and the 3PVRO warning
- `2-Notes/AI should assist civic action, not author it.md` — the rule
  above, with its full argument

When a design call feels wrong, the durable fix is a note in the vault,
not a longer prompt. Never write code state into the vault.
