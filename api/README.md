# api/ — the server side

This directory holds the only component that touches the Anthropic API
key. The browser never does, under any circumstance.

**Deliberately empty pending one decision:** which runtime, which depends
on the Hostinger plan.

## The options

| Hostinger plan | Approach |
|---|---|
| **Shared / Premium / Business** (PHP, no Node) | A single PHP endpoint that proxies to the Anthropic API. ~50 lines, no build step, no dependencies, deploys by file upload. Matches the no-build frontend. |
| **VPS or Cloud** (Node available) | A small Node/Express or Next.js route handler. More familiar tooling, more moving parts to maintain. |
| **Any plan** | Serve the static site from Hostinger and put the endpoint on a serverless platform (Cloudflare Workers, Vercel) with a generous free tier. Adds a second vendor, but decouples hosting from runtime. |

For a six-week ship on shared hosting, the PHP proxy is the lowest-risk
option: nothing to build, nothing to keep running, one file to review.

## Whatever it ends up being, it must

- Read the key from the environment / a gitignored `.env` — never a literal
  in source, never a value in a commit.
- Accept only the specific shapes the frontend sends; reject anything else
  rather than forwarding arbitrary prompts. This endpoint is public.
- Rate-limit per IP. An open proxy to a paid API is somebody else's free
  API.
- Log nothing but timings and status codes. Never request or response
  bodies — users will paste real questions about real local matters.
- Return errors the frontend can show plainly. "The service is down" beats
  a spinner forever.

## What it will serve

1. **Records-request drafting** — takes what the user says they want to
   know, returns a correctly-formed Ch. 119 request in their words.
   Refuses to invent the substance of the request.
2. **Plain-language explanation** — of a statute or a county requirement,
   grounded in text supplied from `data/`, never from model memory.
