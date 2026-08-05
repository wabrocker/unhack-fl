#!/usr/bin/env python3
"""
Discover each county's poll-worker page by reading its Supervisor of
Elections site. Never construct a URL from a pattern — a guessed link that
resolves to the wrong page is worse than admitting we don't have it.

Writes a report to stdout. Applying it to the data file is a separate
step, after review.
"""
import json, re, sys, time
import urllib.request, urllib.error, urllib.parse
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " \
     "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"

# Anchor-text signals, strongest first.
TEXT_RULES = [
    (100, re.compile(r"\bbecome\s+a\s+poll\s*worker", re.I)),
    (95,  re.compile(r"\bpoll\s*worker(s)?\b", re.I)),
    (90,  re.compile(r"\bwork\s+(at\s+)?the\s+polls\b", re.I)),
    (85,  re.compile(r"\belection\s+worker(s)?\b", re.I)),
    (80,  re.compile(r"\bpoll\s+deputy\b", re.I)),
    (70,  re.compile(r"\bwork\s+for\s+(us|elections)\b", re.I)),
]
HREF_RULES = [
    (60, re.compile(r"poll[-_]?worker", re.I)),
    (55, re.compile(r"work[-_]?the[-_]?polls", re.I)),
    (50, re.compile(r"election[-_]?worker", re.I)),
    (40, re.compile(r"become[-_]?a[-_]?poll", re.I)),
]
# Pages that mention poll workers but aren't the recruitment page.
NEGATIVE = re.compile(r"\b(results|canvass|training\s+video|manual\.pdf)\b", re.I)

ANCHOR = re.compile(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.I | re.S)
TAGS = re.compile(r"<[^>]+>")


def get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.geturl(), r.read(400_000).decode("utf-8", "replace")


def score_links(base, html):
    out = []
    for href, inner in ANCHOR.findall(html):
        text = TAGS.sub(" ", inner)
        text = re.sub(r"\s+", " ", text).strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        s = 0
        for pts, rx in TEXT_RULES:
            if rx.search(text):
                s = max(s, pts)
                break
        for pts, rx in HREF_RULES:
            if rx.search(href):
                s = max(s, pts)
                break
        if s and NEGATIVE.search(text):
            s -= 30
        if s > 0:
            out.append((s, urllib.parse.urljoin(base, href), text[:70]))
    out.sort(key=lambda x: -x[0])
    return out


def check(url):
    """Confirm the candidate actually resolves."""
    try:
        final, _ = get(url, timeout=15)
        return True, final
    except urllib.error.HTTPError as e:
        return (e.code in (403, 405)), url     # bot-blocked, not broken
    except Exception:
        return False, url


def work(c):
    name, home = c["name"], c["soe_url"]
    if not home:
        return {**c, "found": None, "note": "no SOE url"}
    try:
        base, html = get(home)
    except Exception as e:
        return {**c, "found": None, "note": f"fetch failed: {type(e).__name__}"}

    cands = score_links(base, html)
    if not cands:
        return {**c, "found": None, "note": "no candidate link on homepage"}

    for s, url, text in cands[:3]:
        ok, final = check(url)
        if ok:
            return {**c, "found": final, "score": s, "anchor": text, "note": "ok"}
    return {**c, "found": None, "note": f"candidates failed ({cands[0][1][:60]})"}


def main():
    data = json.load(open("data/fl-counties.json"))
    counties = data["counties"]
    results = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for i, r in enumerate(ex.map(work, counties), 1):
            results.append(r)
            print(f"{i:3}/67  {r['name']:<14} "
                  f"{(r['found'] or '—')[:74]}", flush=True)
            time.sleep(0.05)

    found = [r for r in results if r["found"]]
    print(f"\nfound {len(found)} / {len(results)}")
    json.dump(results, open("/tmp/pollworker-scan.json", "w"), indent=2)
    print("full results -> /tmp/pollworker-scan.json")


if __name__ == "__main__":
    main()
