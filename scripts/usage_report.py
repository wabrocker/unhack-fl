#!/usr/bin/env python3
"""
Summarize fl.unhackdemocracy.us's usage log: total actions and distinct
browsers per event, pulled live over SSH.

    ./scripts/usage_report.py

Requires the same `hostinger` SSH alias build.sh already uses. Read-only —
never modifies the log. Malformed lines (there shouldn't be any) are
skipped rather than crashing the report.
"""
import json
import subprocess
import sys

REMOTE_HOST = "hostinger"
REMOTE_LOG = "domains/unhackdemocracy.us/usage-log.ndjson"

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


def main() -> None:
    raw = fetch_log()
    lines = [ln for ln in raw.splitlines() if ln.strip()]

    if not lines:
        print("No usage recorded yet.")
        return

    events: dict[str, list[dict]] = {}
    skipped = 0
    for ln in lines:
        try:
            row = json.loads(ln)
        except json.JSONDecodeError:
            skipped += 1
            continue
        events.setdefault(row.get("event", "unknown"), []).append(row)

    dates = [row["date"] for rows in events.values() for row in rows if "date" in row]
    all_uids = {row["uid"] for rows in events.values() for row in rows if "uid" in row}

    print(f"Usage report — {min(dates)} to {max(dates)}" if dates else "Usage report")
    print("=" * 44)

    total_actions = 0
    for event, rows in sorted(events.items(), key=lambda kv: -len(kv[1])):
        label = EVENT_LABELS.get(event, event)
        distinct = len({row["uid"] for row in rows if "uid" in row})
        print(f"{label}: {len(rows)}  ({distinct} distinct browser{'s' if distinct != 1 else ''})")
        total_actions += len(rows)

    print("-" * 44)
    print(f"Total actions: {total_actions}")
    print(f"Distinct browsers, any action: {len(all_uids)}")
    if skipped:
        print(f"\n({skipped} malformed line{'s' if skipped != 1 else ''} skipped)")


if __name__ == "__main__":
    main()
