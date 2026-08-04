# data/ — sourcing rules

Every factual field a user sees comes from here, and every record carries
where it came from and when it was checked.

## The rule

**Unsourced fields stay `null`.** They are never filled in from memory,
inference, or a plausible-looking pattern. County election office URLs in
particular follow no predictable scheme — guessing one that 404s, or
worse, resolves to the wrong office, is precisely the failure this project
cannot survive.

When a field is `null`, the UI says so and links the official directory
rather than inventing an answer.

## `fl-counties.json`

All 67 Florida counties. Names are stable public record and are populated.
Everything else is `null` pending a sourcing pass:

| field | source to use |
|---|---|
| `soe_name`, `soe_url`, `soe_phone` | Florida Division of Elections county Supervisor of Elections directory (dos.fl.gov) |
| `poll_worker_url` | the individual county SOE site — each publishes its own poll-worker page |

Set `source` to the URL the value came from and `verified` to the date
checked, per record. Re-verify before each election cycle: offices move,
and Florida election statutes have changed repeatedly in recent years.

## Statutes

Cite chapter and section, link the official text at
`flsenate.gov/Laws/Statutes`, and record the year of the version consulted
— not a paraphrase from memory. Relevant so far:

- **Ch. 119** — public records. No express response deadline; agencies get
  a "reasonable time" to retrieve, review, and redact.
- **Ch. 286** — open meetings (Sunshine Law); §286.0114 concerns the right
  to be heard.
- **Art. I, §24, Fla. Const.** — constitutional right of access.
- **Poll workers** — eligibility, mandatory pre-election training from a
  statewide curriculum, county-set pay.

Details for each still need verification against current text before they
reach a user.
