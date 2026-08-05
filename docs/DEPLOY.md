# Deploying to Hostinger (Business plan)

Business is shared PHP hosting — no Node. That's why the API layer is a
single PHP file with no dependencies and no build step.

Live target: **https://fl.unhackdemocracy.us** (HTTPS is issued
automatically; HTTP 301s to it).

## Where things go

The subdomain has its own document root, kept separate from the root
domain so `unhackdemocracy.us` stays free for a project landing page. Find
the exact path in hPanel under **Websites → unhackdemocracy.us → Domains →
Subdomains**; it will look like:

```
/home/uXXXXXXXXX/domains/unhackdemocracy.us/public_html/fl/
```

Upload into that folder:

```
<subdomain docroot>/
  index.html          <- from web/
  styles.css          <- from web/
  app.js              <- from web/
  data/
    fl-counties.json  <- from data/
  api/
    index.php         <- from api/
    .htaccess         <- from api/
```

`app.js` fetches `../data/fl-counties.json` and posts to `../api/`, both
relative to `web/`. Since `index.html` lands at the docroot rather than
inside a `web/` folder, keep `data/` and `api/` as siblings of
`index.html` exactly as shown and the relative paths resolve.

## The API key

**Put `.env` above the web root.** Anything inside a document root is
served over HTTP. Recommended location:

```
/home/uXXXXXXXXX/domains/unhackdemocracy.us/.env
```

containing:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`api/index.php` searches upward from itself and will find it there. It
also checks `/home/USER/.env` and `/home/USER/domains/.env` — either is
fine, and higher is safer. `api/.htaccess` refuses to serve a stray `.env`
as a backstop, but the backstop is not the plan.

**Verify it is unreachable** after uploading. Both of these must fail:

```bash
curl -sI https://fl.unhackdemocracy.us/.env | head -1
curl -sI https://fl.unhackdemocracy.us/api/.env | head -1
```

## Check it works

```bash
curl -s -X POST https://fl.unhackdemocracy.us/api/ \
  -H 'content-type: application/json' \
  -d '{"action":"explain","passage":"Chapter 119 does not set an express deadline.","question":"How fast must they respond?"}'
```

Expect `{"ok":true,"text":"..."}`.

- `{"ok":false,"error":"Server is not configured."}` → PHP can't find the
  `.env`. Check the path and that it is readable.
- `502` → key present but rejected upstream, or cURL is blocked.
- `405` in a browser is correct: the endpoint is POST-only.

Then load the site, pick a county, and run one real records request end to
end. That path — the live model call and the draft rendering — is the only
part never exercised locally.

## Confirm the root stayed separate

After uploading, `https://unhackdemocracy.us` should still show
Hostinger's default page rather than the tool. If it shows the tool, the
subdomain is sharing the root's `public_html` and needs recreating with
only "Custom folder" ticked.

## Cost control

The proxy caps output tokens and rate-limits to 8 requests per IP per 10
minutes. Watch usage in the Anthropic console for the first week and lower
`RATE_LIMIT` if anything looks off — a public endpoint is a standing
invitation.

## Rotating the API key

Keys were set to a 30-day expiry on 2026-08-05 (~2026-09-04). When one
expires, the "sharpen" button fails **silently** — no error banner, no
alert, `env_key()` just can't authenticate and the button quietly hides
itself again, exactly as it does with no key configured at all. Nothing
tells you it happened; check the console or test the endpoint.

1. **console.anthropic.com → API keys** — create the replacement before
   the old one lapses, so there's no gap. **Leave auto-reload off** on the
   billing page: with it off, the credit balance is a hard ceiling on a
   public endpoint — if something goes wrong, the button stops working
   instead of billing without limit. Also set a monthly spend cap and a
   usage alert as backstops.
2. SSH in and edit the file in place — never paste a real key into chat,
   here or anywhere:
   ```bash
   ssh -p 65002 u773936078@YOUR_SSH_HOST
   nano ~/domains/unhackdemocracy.us/.env
   ```
   Replace the `ANTHROPIC_API_KEY=` line, save (`Ctrl+O`, Enter, `Ctrl+X`).
3. Verify without ever printing the key — check status only:
   ```bash
   curl -s -X POST https://fl.unhackdemocracy.us/api/ \
     -H 'content-type: application/json' \
     -d '{"action":"explain","passage":"Chapter 119 sets no deadline.","question":"how fast?"}'
   ```
   Expect `{"ok":true,...}`.
4. Delete the old key from the console once the new one is confirmed
   working, so only one live key exists at a time.

Consider a calendar reminder at rotation time — a silent failure mode is
the kind that goes unnoticed for weeks.
