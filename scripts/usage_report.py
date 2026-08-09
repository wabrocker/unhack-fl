#!/usr/bin/env python3
"""
Summarize fl.unhackdemocracy.us's usage log: total actions and distinct
browsers per event, pulled live over SSH.

    ./scripts/usage_report.py          point-in-time summary
    ./scripts/usage_report.py --csv    one row per day, for a graph

Requires the same `hostinger` SSH alias build.sh already uses. Read-only —
never modifies the log. Malformed lines (there shouldn't be any) are
skipped rather than crashing the report.

--csv needs no separate capture step: every event already carries its own
date, so the log itself is the time series. This just re-aggregates it by
day instead of totaling everything, on demand, from the one source of
truth — nothing to schedule, nothing to lose by missing a run.
"""
import csv
import json
import subprocess
import sys

REMOTE_HOST = "hostinger"
REMOTE_LOG = "domains/unhackdemocracy.us/usage-log.ndjson"

EVENTS = ["records_letter", "poll_worker_link", "ai_rewrite"]
EVENT_LABELS = {
    "records_letter": "Records letters generated",
    "poll_worker_link": "Poll-worker apply links clicked",
    "ai_rewrite": "AI rewrites used",
}


def fetch_log() -> str:
    try:
        result = subprocess.run(
            ["ssh", REMOTE_HOST, f"cat {REMOTE_LOG}"],
            capture_output=True, text=True, timeout=20,
        )
    except (subprocess.TimeoutExpired, OSError) as e:
        print(f"Couldn't reach {REMOTE_HOST} over SSH — is the alias set up? ({e})",
              file=sys.stderr)
        sys.exit(1)

    # A remote "no such file" (no usage yet) and a real SSH failure look
    # the same at this level — nonzero exit, no stdout. Both cases have
    # nothing to report, so give the same neutral answer rather than
    # guessing which one happened from stderr text.
    if result.returncode != 0 and result.stderr.strip():
        print(f"({result.stderr.strip()})", file=sys.stderr)
    return result.stdout


def load_rows(raw: str) -> tuple[list[dict], int]:
    """Parsed rows plus a count of lines that didn't parse."""
    rows, skipped = [], 0
    for ln in raw.splitlines():
        if not ln.strip():
            continue
        try:
            row = json.loads(ln)
        except json.JSONDecodeError:
            skipped += 1
            continue
        if "event" in row and "uid" in row and "date" in row:
            rows.append(row)
        else:
            skipped += 1
    return rows, skipped


def print_summary(rows: list[dict], skipped: int) -> None:
    events: dict[str, list[dict]] = {}
    for row in rows:
        events.setdefault(row["event"], []).append(row)

    dates = [row["date"] for row in rows]
    all_uids = {row["uid"] for row in rows}

    print(f"Usage report — {min(dates)} to {max(dates)}" if dates else "Usage report")
    print("=" * 44)

    total_actions = 0
    for event, ev_rows in sorted(events.items(), key=lambda kv: -len(kv[1])):
        label = EVENT_LABELS.get(event, event)
        distinct = len({row["uid"] for row in ev_rows})
        print(f"{label}: {len(ev_rows)}  ({distinct} distinct browser{'s' if distinct != 1 else ''})")
        total_actions += len(ev_rows)

    print("-" * 44)
    print(f"Total actions: {total_actions}")
    print(f"Distinct browsers, any action: {len(all_uids)}")
    if skipped:
        print(f"\n({skipped} malformed line{'s' if skipped != 1 else ''} skipped)")


def print_csv(rows: list[dict]) -> None:
    """
    One row per date: that day's count per event, the day's total, and the
    running distinct-user count from the start of the log through that
    date — the growth-over-time number a traction graph actually wants.
    Only dates with at least one event appear; no zero-filled gaps.
    """
    by_date: dict[str, list[dict]] = {}
    for row in rows:
        by_date.setdefault(row["date"], []).append(row)

    writer = csv.writer(sys.stdout)
    writer.writerow(["date", *EVENTS, "total_actions", "cumulative_distinct_users"])

    seen_uids: set[str] = set()
    for date in sorted(by_date):
        day_rows = by_date[date]
        seen_uids.update(row["uid"] for row in day_rows)
        counts = [sum(1 for row in day_rows if row["event"] == ev) for ev in EVENTS]
        writer.writerow([date, *counts, len(day_rows), len(seen_uids)])


def main() -> None:
    raw = fetch_log()
    rows, skipped = load_rows(raw)

    if not rows:
        print("No usage recorded yet.")
        return

    if "--csv" in sys.argv[1:]:
        print_csv(rows)
    else:
        print_summary(rows, skipped)


if __name__ == "__main__":
    main()
