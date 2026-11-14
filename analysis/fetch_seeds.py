#!/usr/bin/env python3
"""
fetch_seeds.py: the seeding sheet for the accuracy analysis (PREREGISTRATION.md)

The plan takes the FeNZ ranking from each competition's initial seeding on the
FeNZ results portal, https://results.fencing.org.nz. The portal does not show
it. Checked on 14 Nov 2026:

    /competitions/{comp}/events/{event}/results   final rank, name, club, nationality
    /competitions/{comp}/events/{event}/pools     names and V/D cells
    /competitions/{comp}/events/{event}/bracket   names and scores
    /rankings                                     one current board ("Last update
                                                  2026-10-25"), no earlier dates

No page carries a seed number or marks a fencer as unranked. The seeding is on
FencingTimeLive, which this script does not read: Nolan copies it by hand.

So this script writes the sheet he fills in, analysis/seeds_template.csv: one
row per entrant of every test-set event (competitions starting on or after
20 July 2026), with the seed and ranked columns blank. The filled sheet is
saved as analysis/seeds.csv, which this script never writes.

Columns:
  competition  the competition as the site names that event's bouts: with
               " - Mens" or " - Womens" for a single-gender event, without for
               a mixed one (dedupeBouts in pipeline.js folds the two copies)
  event        the portal's event label, such as "Epee Men Senior"
  weapon       epee, foil or sabre
  gender       Mens, Womens or Mixed
  fencer       the name as the site spells it (the ingest's Resolver)
  seed         blank: the initial seed number from FencingTimeLive
  ranked       blank: y if FencingTimeLive shows a FeNZ ranking for the fencer,
               n if it shows them as unranked

It reuses the portal ingest's PoliteClient, cache, parsers and name Resolver
(ingest/portal_ingest.py), so every name is spelled as bouts_portal.csv has it.
Every page it needs is already in ingest/cache/portal/, and by default it
sends no requests. With --fetch it may fetch a page the cache lacks, under the
ingest's rules: robots.txt obeyed, one request at a time at least 2 seconds
apart, and a 403 or 429 stops the run with no retry.

Usage, from the repo root:
    python analysis/fetch_seeds.py            # cache only
    python analysis/fetch_seeds.py --fetch    # may fetch pages the cache lacks
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

ANALYSIS_DIR = Path(__file__).resolve().parent
INGEST_DIR = ANALYSIS_DIR.parent / "ingest"
sys.path.insert(0, str(INGEST_DIR))
import portal_ingest as pi  # noqa: E402

TEST_SET_FROM = "2026-07-20"
HEADER = ["competition", "event", "weapon", "gender", "fencer", "seed", "ranked"]


def site_competition(ev: pi.EventResult) -> tuple[str, str]:
    """(the competition name the site gives this event's bouts, gender label)."""
    if len(ev.genders) == 1:
        return f"{ev.comp_name} - {ev.genders[0]}", ev.genders[0]
    return ev.comp_name, "Mixed"


def entrants(ev: pi.EventResult, resolver: pi.Resolver) -> list[str]:
    """Everyone the event's standings, pools or bracket name, as the site spells them."""
    raw = [r["raw"] for r in ev.standings]
    raw += [n for pool in ev.pools for n in pool["names"]]
    raw += [n for rnd in ev.rounds for card in rnd["cards"] for n in card["names"]]
    club_of = {r["raw"]: r["club"] for r in ev.standings}
    tag = f"{ev.comp['name']} / {ev.label}"
    names = {resolver.resolve(r, ev.weapon, club_of.get(r, ""), tag) for r in raw if r.strip()}
    return sorted(names, key=lambda n: (n.split()[-1].lower(), n.lower()))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--fetch", action="store_true", help="allow requests for pages the cache lacks")
    ap.add_argument("--out", default=str(ANALYSIS_DIR / "seeds_template.csv"))
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if Path(args.out).resolve() == (ANALYSIS_DIR / "seeds.csv").resolve():
        ap.error("refusing to write seeds.csv: that file is filled in by hand")

    client = pi.PoliteClient(offline=not args.fetch)
    known = pi.KnownNames.load(INGEST_DIR / "bouts.csv", INGEST_DIR / "fencers.json")
    resolver = pi.Resolver(known)

    # Every competition bouts_portal.csv holds; the test set is the ones that
    # start on or after the cut-off.
    comp_ids = list(dict.fromkeys(pi.OLD_INGEST_SKIPPED + pi.PHASE_B + pi.NATIONALS_2026))
    events: list[pi.EventResult] = []
    for cid in comp_ids:
        comp = pi.parse_competition(client.get(f"{pi.BASE_URL}/competitions/{cid}"), cid)
        if comp["start"] < TEST_SET_FROM:
            continue
        comp_clubs: dict[str, str] = {}
        for eid, _label in comp["events"]:
            for r in pi.parse_standings(client.get(f"{pi.BASE_URL}/competitions/{cid}/events/{eid}"))[1]:
                if r["club"]:
                    comp_clubs.setdefault(r["raw"], r["club"])
        for eid, label in comp["events"]:
            events.append(pi.ingest_event(client, comp, eid, label, resolver, comp_clubs))
    pi.name_events(events)
    events.sort(key=lambda ev: (ev.comp["start"], ev.comp_name, ev.weapon, ev.label))

    rows, seen = [], {}
    print(f"{'date':<10}  {'competition (as the site names it)':<52} {'event':<22} {'entrants':>8} {'pool':>5} {'DE':>4}")
    for ev in events:
        comp_name, gender = site_competition(ev)
        key = (comp_name, ev.weapon)
        if key in seen:
            raise SystemExit(f"two events share {key}: {seen[key]} and {ev.label}; the join would be ambiguous")
        seen[key] = ev.label
        names = entrants(ev, resolver)
        pool = sum(1 for b in ev.bouts if b.bout_type == "pool")
        de = sum(1 for b in ev.bouts if b.bout_type == "de")
        print(f"{ev.comp['start']:<10}  {comp_name:<52} {ev.label:<22} {len(names):>8} {pool:>5} {de:>4}")
        rows += [[comp_name, ev.label, ev.weapon, gender, n, "", ""] for n in names]

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(HEADER)
        w.writerows(rows)
    comps = len({ev.comp["id"] for ev in events})
    print(f"\n{comps} competitions, {len(events)} events, {len(rows)} entrant rows written to {args.out} "
          f"({client.requests_made} requests sent this run)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
