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

## `topic-starters.json`

Starting points for people who know what they care about but not what to
ask for — surfaced as a "not sure what to ask" picker inside the records
form. Two layers, same discipline as `fl-counties.json`:

- **`generic_guidance` / `generic_want_template`** — true in general
  across Florida counties, never names a specific office. Always shown.
- **`county_overrides`** — individually researched, sourced facts about
  one county's actual office and program. Shown instead of the generic
  layer when one exists for the selected county.

**Never add a `county_override` without a real source.** Each one needs
`county_slug` (matching `fl-counties.json`), `agency`, `want`, `source`
(one or more URLs), and `verified` (date checked). If you can't verify an
office name, don't add the override — the generic layer with a blank
office field is the honest fallback, same as `poll_worker_url: null`.

An override may also carry `request_url` — a direct link to the office's
own online public-records submission form, only when one was found and
loaded to confirm it's live. Same discipline as everything else here: no
`request_url` without confirming the page actually works, and it never
replaces the letter-drafting flow — it's offered as an additional option,
since the county's own form only covers what its fields ask for while a
letter can be more precise about scope.

Populated 2026-08-05: one override (Palm Beach × Environment &
conservation), researched via web search and cited to PBC ERM's own
pages. `request_url` added 2026-08-06 after Bill found and confirmed
PBC's own request form (`pbc.gov/eprr/erm`), pre-scoped to ERM. Everything
else is generic-layer only — real coverage grows the way `poll_worker_url`
did, one verified entry at a time. See CONTRIBUTING.md.

## `sheriffs.json`

Sourced 2026-08-06 from FDLE's own **Sheriff's Office Directory** PDF
(fdle.state.fl.us) — a state agency, not an association site, publishing
name/phone/email for all 67 counties in one document. Same trust level as
`fl-counties.json`'s `soe_email`: it's the office's one official published
contact, not necessarily a dedicated records/FOIA inbox.

Parsing note: 3 counties publish under a name without the word "County"
(Miami-Dade, Pasco, Volusia), and Duval County's office is legally the
"Jacksonville Sheriff's Office" due to consolidated city-county
government. All mapped back to standard county names in the data.

The FDLE PDF itself is dated 2025-09-02 — about a year old at import.
Re-verify before relying on it for anything time-sensitive; sheriffs are
elected and turn over.

## Why elections and sheriffs, and not other offices

Both have a bulk, state-published, structured directory because both are
constitutional officers — exactly one per county, uniform structure,
which is what makes a single statewide source possible at all.

Checked and found **no equivalent** for:
- **Clerks of Court** — the Dept. of State publishes address+phone for
  66/67 counties, but no bulk emails. Real, but not enough to power a
  mailto — would need a per-county crawl, same shape as
  `poll_worker_url`.
- **Property Appraisers** / **Tax Collectors** — the Dept. of Revenue only
  links out to each county's own site. No bulk source found at all.

Any of these could get the `poll_worker_url` treatment (crawl each
county's own site, verify each link resolves, `null` where nothing is
found) if someone wants to take it on — see CONTRIBUTING.md.

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
