# Deploying to Hostinger (Business plan)

Business is shared PHP hosting — no Node. That's why the API layer is a
single PHP file with no dependencies and no build step.

## Layout on the server

```
/home/USER/
  .env                 <-- API key lives HERE, above the web root
  domains/DOMAIN/public_html/
    index.html         <-- contents of web/
    styles.css
    app.js
    data/fl-counties.json
    api/index.php
    api/.htaccess
```

**The key must sit above `public_html`.** Anything inside it is served
over HTTP. `api/index.php` looks two levels up first for exactly this
reason, and `api/.htaccess` refuses to serve a stray `.env` as a backstop.

## Steps

1. In hPanel, point a domain or subdomain at a new site. `billbrocker.com`
   and `billb.tech` are both on the plan; a subdomain such as
   `fl.billbrocker.com` keeps this separate from anything else.
2. Upload `web/*` to `public_html/`, plus `data/` and `api/`.
3. Create `/home/USER/.env` containing:
   `ANTHROPIC_API_KEY=sk-ant-...`
4. Confirm PHP 8.1+ and that cURL is enabled (both are standard on
   Business).
5. Verify the key is NOT reachable: `curl https://DOMAIN/.env` and
   `curl https://DOMAIN/api/.env` must both fail.

## Check it works

```
curl -s -X POST https://DOMAIN/api/ \
  -H 'content-type: application/json' \
  -d '{"action":"explain","passage":"Chapter 119 does not set an express deadline.","question":"How fast must they respond?"}'
```

Expect `{"ok":true,"text":"..."}`. An `{"ok":false}` with "Server is not
configured" means the `.env` isn't where PHP is looking.

## Cost control

The proxy caps output tokens and rate-limits to 8 requests per IP per 10
minutes. Watch usage in the Anthropic console for the first week and
tighten `RATE_LIMIT` if anything looks off — a public endpoint is a
standing invitation.
