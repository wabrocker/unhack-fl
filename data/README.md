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

All 67 Florida counties. **Populated 2026-08-04** from the state's own
county-info export, `qrycountyinfo_excel.xls`, linked from
dos.fl.gov/elections/contacts/supervisor-of-elections/ (the file itself was
last saved by the state on 2026-08-03).

Populated per county: `supervisor`, `soe_url`, `soe_phone`, `soe_email`,
`soe_address` — zero nulls. Each record carries `source` and `verified`.

`poll_worker_url` was populated **2026-08-05** for **59 of 67** counties
by `scripts/find_pollworker_urls.py`, which reads each county's own SOE
site — and its sitemap — for a poll-worker or election-worker page, then
confirms the URL resolves. **Never constructed from the SOE domain**;
there is no common scheme, and a guessed link that lands on the wrong page
is the failure this project cannot survive.

The eight nulls are deliberate: Baker and Flagler block automated
requests, and Gilchrist, Glades, Hardee, Holmes, Lafayette and Liberty
publish no page a crawl could find — several small counties take
applications by phone. Null renders as "we couldn't find one, ask the
office", never a guess.

Re-run the script before each election cycle; county sites reorganise.

A spot check of 12 random county sites found no dead links (9 × 200/202;
3 × 403, which is bot-blocking of bare `curl`, not a broken site). Re-verify before each election cycle: offices move,
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
