# Contributing

This is a civic tool, so the most valuable contributions are often not
code. Four kinds of help, roughly in order of how much they're worth right
now.

## 1. If you work in a records office or run elections

**You are the most useful person who could read this page.**

This tool exists to make the mail you receive easier to answer. We think a
request that names the custodian, describes specific records, and gives a
date range is less work to fulfil than a vague one — but you know that far
better than we do.

What would genuinely help:

- **Phrasing that works.** What wording makes a request searchable in your
  system? What phrasing causes you to write back asking for clarification?
- **What we get wrong.** If the generated letter asks for something in a
  way that creates work rather than saving it, say so and we'll change it.
- **What you wish requesters knew.** The thing you explain over and over.
- **Where the request should go.** If your office routinely receives
  misdirected requests, tell us and we'll fix the guidance.

Open an issue, or email the address in the site footer. You don't need a
GitHub account — a plain email is fine, and you're welcome to be anonymous
about which office you work for.

We are not trying to reduce, replace, or automate away public employees.
The premise is the opposite: your experience is the asset, and better
inbound requests let more of your time go to the work only you can do.

## 2. Verified topic starters

The "not sure what to ask for" picker in the records-request form shows a
generic template for every topic, and a specific verified office name
when we have one for your county. Most counties don't have one yet for
most topics — that's expected, and it's the easiest way to contribute.

If you've found the real office and program for a topic in your county —
say, who handles environmental land conservation, or public meeting
minutes — open an issue or a PR with:

- the county and topic
- the office name
- a suggested `want` description, in the same shape as the existing
  examples in `data/topic-starters.json`
- **a source URL** — the county's own page, ideally. We don't add an
  override without one; see `data/README.md`.

This is genuinely one of the highest-value contributions available. It
directly determines whether the next person from your county gets a real
answer or a generic template.

## 3. Corrections to county data

Everything factual comes from `data/fl-counties.json`, and every record
carries where it came from and when it was checked. County offices move,
websites get reorganised, and poll-worker pages come and go.

If something is wrong or dead, open an issue with the county name and what
you found. Include a source — the county's own site is ideal. See
[`data/README.md`](data/README.md) for the sourcing rules, the most
important of which is: **we never construct a URL from a pattern.** If we
can't source it, the field stays `null` and the interface says nothing
rather than guessing.

## 4. Testing in the real world

Did you use this to send an actual request? We'd like to know what
happened — how long the reply took, whether the office understood it,
whether anything in the letter caused friction. That feedback is worth
more than any amount of internal review.

## 5. Code

Plain HTML, CSS and JavaScript in `web/`, one dependency-free PHP file in
`api/`. No build step, no framework, no `node_modules`. Please keep it
that way unless something genuinely requires otherwise.

```bash
git clone https://github.com/wabrocker/unhack-fl.git
cd unhack-fl
php -S localhost:8781 -t .        # serves PHP; python's http.server won't
```

Then open http://localhost:8781/web/. The AI rewrite needs an API key (see
[`docs/DEPLOY.md`](docs/DEPLOY.md)); everything else works without one.

`./build.sh` produces the deployable `dist/`.

### Rules that aren't up for negotiation

Read [`CLAUDE.md`](CLAUDE.md) before changing behaviour. In short:

- **Never fabricate a statute, deadline, office, or URL.** If it isn't in
  `data/` with a source, the honest answer is "we don't have that."
- **The AI never supplies the user's position** — only structure and form.
- **Draft, never send.** Nothing may transmit on a user's behalf.
- **The records flow stays anonymous.** Chapter 119 lets anyone ask
  without identifying themselves; we won't be stricter than the statute.
- **Never claim verification we haven't performed.**
- **Florida only** until a second state has someone who will maintain it.

### Adding another state

Please talk to us first. Florida's model — 67 counties, one Supervisor of
Elections each — does not generalise. Michigan, for instance, runs
elections through 1,603 officials across counties, cities and townships,
and its FOIA sets a five-business-day deadline where Florida's Chapter 119
sets none. A state needs its own research and, more importantly, someone
local who will keep its data current.

## Conduct

The project's premise is that people on opposite sides both want their
side of the country to work. Argue about the substance; assume the person
across from you is acting in good faith. Partisan advocacy for candidates
or parties is out of scope here — not because it doesn't matter, but
because this tool only works if everyone can use it.
