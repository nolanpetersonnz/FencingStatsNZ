#!/usr/bin/env python3
"""
diff_bouts.py — compare two bouts.csv files for the refresh workflow.

Given the currently committed CSV (OLD) and a freshly ingested one (NEW),
report what changed: bout-count delta and which competitions appeared or
disappeared. Two jobs:

  1. Produce the human-readable summary that becomes the commit message,
     so the admin refresh log (which just reads git history) explains
     itself: "+412 bouts, +3 competitions" plus the names.

  2. Act as a shrink-guard. A refresh fully rebuilds the CSV from a cmpId
     --scan range; if that range is set too high it silently drops early
     competitions and the file shrinks. We would rather abort than commit
     a truncated dataset over a good one, so a drop past --min-ratio exits
     non-zero and the workflow stops before it can deploy.

Usage:
    python diff_bouts.py OLD NEW [--min-ratio 0.9] \
        [--emit-message msg.txt] [--emit-json summary.json] [--run-url URL]

Exit codes: 0 ok · 2 shrink-guard tripped · 1 usage/IO error.
"""

import argparse
import csv
import json
import sys
from pathlib import Path


# A "competition" for diffing is one (date, name, weapon) tuple. The ingest
# splits a physical event into Mens/Womens rows and per-weapon, so this key
# is the finest grain a viewer would recognise as a distinct draw to ship.
def comp_keys(rows: list[dict]) -> dict[tuple, int]:
    """Map each competition key to how many bout rows it contributed."""
    counts: dict[tuple, int] = {}
    for r in rows:
        key = (
            (r.get("date") or "").strip(),
            (r.get("competition") or "").strip(),
            (r.get("weapon") or "").strip().lower(),
        )
        counts[key] = counts.get(key, 0) + 1
    return counts


def read_rows(path: str) -> list[dict]:
    """Parse a bouts CSV into dict rows. A missing file reads as empty so
    the first-ever refresh (no committed CSV yet) is a clean all-new diff
    rather than an error."""
    p = Path(path)
    if not p.exists():
        return []
    with p.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def fmt_comp(key: tuple) -> str:
    date, name, weapon = key
    return f"{date}  {name}  [{weapon}]"


def build_summary(old_path: str, new_path: str, run_url: str | None) -> dict:
    old_rows = read_rows(old_path)
    new_rows = read_rows(new_path)
    old_comps = comp_keys(old_rows)
    new_comps = comp_keys(new_rows)

    added = sorted(k for k in new_comps if k not in old_comps)
    removed = sorted(k for k in old_comps if k not in new_comps)

    before, after = len(old_rows), len(new_rows)
    delta = after - before

    # Commit subject — short and scannable, since it is the one line the
    # refresh log shows by default. Lead with the bout delta (signed) and
    # the competition churn.
    sign = "+" if delta >= 0 else ""
    parts = [f"{sign}{delta} bouts"]
    if added:
        parts.append(f"+{len(added)} comp{'s' if len(added) != 1 else ''}")
    if removed:
        parts.append(f"-{len(removed)} comp{'s' if len(removed) != 1 else ''}")
    subject = f"data: refresh from FeNZ ({', '.join(parts)})"

    body_lines: list[str] = []
    if added:
        body_lines.append("New competitions:")
        body_lines += [f"- {fmt_comp(k)}" for k in added]
    if removed:
        if body_lines:
            body_lines.append("")
        body_lines.append("Dropped / corrected competitions:")
        body_lines += [f"- {fmt_comp(k)}" for k in removed]
    if not added and not removed:
        body_lines.append("No competition added or removed; bout-level corrections only.")
    body_lines.append("")
    body_lines.append(f"before={before} after={after} delta={delta}")
    if run_url:
        body_lines.append(f"Run: {run_url}")

    return {
        "before": before,
        "after": after,
        "delta": delta,
        "added": [fmt_comp(k) for k in added],
        "removed": [fmt_comp(k) for k in removed],
        "subject": subject,
        "message": subject + "\n\n" + "\n".join(body_lines) + "\n",
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Diff two bouts.csv files for the refresh workflow.")
    p.add_argument("old", help="currently committed bouts.csv (may not exist on first run)")
    p.add_argument("new", help="freshly ingested bouts.csv")
    # 0.9 = tolerate up to a 10% drop (a removed event or DE-bracket fix can
    # legitimately shrink the file a little); a bigger drop means the scan
    # range missed competitions, which is the failure we are guarding against.
    p.add_argument("--min-ratio", type=float, default=0.9,
                   help="abort if new row count < old * this ratio (default 0.9)")
    p.add_argument("--emit-message", metavar="FILE", help="write the commit message here")
    p.add_argument("--emit-json", metavar="FILE", help="write the JSON summary here")
    p.add_argument("--run-url", metavar="URL", help="workflow run URL to record in the message")
    args = p.parse_args()

    s = build_summary(args.old, args.new, args.run_url)

    # Human summary always goes to stderr for the CI log.
    print(s["subject"], file=sys.stderr)
    for line in s["added"]:
        print(f"  + {line}", file=sys.stderr)
    for line in s["removed"]:
        print(f"  - {line}", file=sys.stderr)

    if args.emit_message:
        Path(args.emit_message).write_text(s["message"], encoding="utf-8")
    if args.emit_json:
        Path(args.emit_json).write_text(json.dumps(s, indent=2) + "\n", encoding="utf-8")

    if s["before"] > 0 and s["after"] < s["before"] * args.min_ratio:
        print(
            f"[shrink-guard] new file has {s['after']} rows vs {s['before']} committed "
            f"(< {args.min_ratio:.0%}); refusing to overwrite. Lower SCAN_FROM if the "
            f"scan range missed early competitions.",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
