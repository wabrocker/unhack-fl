# Research brief: adding a state

**For anyone who wants to bring this to their state.** This is a
research task, not a coding task. Nothing should be built until it's
answered, because the answers decide whether the Florida build can be
copied or has to be rethought.

Written 2026-08-05, with Michigan as the working example.

## Why this exists

Florida's model is: **67 counties, one Supervisor of Elections each.** The
county dropdown, the data file, and the letter template all assume it.

That assumption does not travel. Michigan runs elections through
[**1,603 officials — 83 county clerks, 280 city clerks and 1,240 township
clerks**](https://www.michigan.gov/sos/-/media/Project/Websites/sos/Elections/Voter-Education/Michigans-Elections-System-Structure-Overview.pdf),
the most decentralised system in the country. A Michigan voter's elections
official is determined by their *township or city*, not their county — so
a county dropdown sends most people to the wrong office.

The records law differs too, and in a way that changes the letter itself.
Florida's Chapter 119 sets **no response deadline**. Michigan's FOIA
requires [**a written response within five business days**](https://ballotpedia.org/Michigan_FOIA_procedures),
with one extension of up to ten more. The paragraph in our template that
says no specific deadline applies would be **factually wrong in Michigan**
— and confidently wrong civic guidance is the failure this project exists
to avoid.

So: research first.

## The questions

### 1. Who administers elections, and at what level?

- Counties, cities, townships, or a mix? How many jurisdictions in total?
- How does a resident find *theirs* — by county, by address, by ZIP?
- Is there an official statewide directory with contact details? Ideally a
  structured file. *(Florida publishes a spreadsheet, which is how all 67
  records were sourced in a day.)*
- Does the state provide an address → jurisdiction lookup we can link to?

### 2. What is the public records law?

- Which statute, by name and citation?
- **Is there a response deadline?** This is the single most important
  question — it's the sentence in the letter most likely to be wrong.
- Are fees allowed, and is there a right to an estimate before charges?
- Must the requester identify themselves or state a purpose? *(Florida:
  no. If your state says yes, that changes our anonymity stance there.)*
- Must the request be in writing? Is there a required form?
- Is there a constitutional right of access, as in Fla. Const. Art. I §24?

### 3. What does the poll-worker path look like?

- Who hires and trains poll workers — same office as elections
  administration, or a different one?
- Eligibility: age, residency, citizenship, party-balance requirements?
- Is training mandatory? Paid?
- Is pay set locally or statewide?
- Does each jurisdiction publish its own application page, or is there a
  central one? *(Florida: each county publishes its own, no common URL
  scheme — which is why ours were crawled, never constructed.)*

### 4. Where does the data live, and how stale does it get?

- Is there a machine-readable source, or does this need a crawl?
- Who would notice when it goes out of date, and how often?
- **Are you willing to own it?** Not "would you like it to exist" —
  willing to re-verify before each election cycle. A state without a local
  maintainer decays into wrong information, which is worse than no
  coverage at all.

### 5. What's the state-specific legal landmine?

Every state has one. In Florida it's third-party voter registration: SB
7050 makes collecting other people's completed registration forms
hazardous, with per-application penalties — so this project never touches
them, by design rather than oversight.

Find yours before building, not after.

## What to produce

A plain document answering the above, with **a source link for every
factual claim** and the date you checked it. That's the same standard the
tool holds itself to, and it's what makes the research reusable.

Then one paragraph of judgement: **does the Florida build copy across, or
does your state need a different shape?** For Michigan the honest answer
looks like "different shape" — 1,603 jurisdictions and a hard FOIA
deadline aren't a config change.

## Two gates before any code

1. **Florida has real users.** Proving the model works once comes before
   proving it twice.
2. **The state has an owner** who will maintain its data.

Both are about not shipping something that quietly rots. A civic tool
giving out last cycle's contact details is worse than no tool.
