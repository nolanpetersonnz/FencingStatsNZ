#!/usr/bin/env python3
"""
fencerinfo_ingest.py — Fencing Time XML → public/data/fencers.json

Walks Fencerinfo/uploads/*.xml (raw Fencing Time exports with licence
numbers, full DOBs, handedness, etc.) and produces a privacy-scrubbed
fencer registry that ships with the React app.

Output schema (frontend/public/data/fencers.json) is a list of:

    {
      "display_name": "Joel Ball-La Hood",
      "name_keys": ["joel ball-la hood", "joel ball-la-hood"],
      "dob_year": 2006,                  # year only; full DOB never leaves.
                                         # null if unknown or withheld (below)
      "handedness": "right" | "left",    # null if unknown
      "nation": "NZL",
      "current_club": "South Wellington Fencing Club",
      "clubs": ["Wellington Swords Club", "Wellington South Fencing Club"],
      "rankings": {
        "epee_M": {"rank": 2, "as_of": "2024-10-27"},
        ...
      },
      "has_licence": true,               # absent if no licence on record
    }

Anyone born in or after (this year - 18) may be under 18, so their birth
year is withheld. Only the year is known, so that whole year counts as
possibly under 18. In its place the record carries what the site needs,
worked out here at build time:

      "dob_year": null,
      "dob_withheld": true,
      "age_eligibility": {"season": 2026, "junior": true, "cadet": false},
      "dob_implausible": true,           # only when the withheld year fails
                                         # the activity check in fencerInfo.js

`season` is the latest year in ingest/bouts.csv, the same "current year"
the leaderboard uses. The flags are only valid for that season, so re-run
this script when results from a new year arrive.

Licence numbers and licence hashes never appear in the output.

Usage:
    python ingest/fencerinfo_ingest.py
"""

import csv
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

WEAPON_MAP = {"E": "epee", "F": "foil", "S": "sabre"}
HANDEDNESS_MAP = {"D": "right", "G": "left"}

ROOT = Path(__file__).resolve().parent.parent
XML_DIR = ROOT / "Fencerinfo" / "uploads"
# Emit alongside ingest/bouts.csv. frontend/scripts/copy-data.mjs copies
# both into frontend/public/data/ at build time, so this file ships with
# every Vercel deploy.
OUT_PATH = ROOT / "ingest" / "fencers.json"
BOUTS_PATH = ROOT / "ingest" / "bouts.csv"

# Leaderboard age bands, mirroring Leaderboard.jsx: Junior (U20) is born
# season - 20 or later, Cadet (U17) season - 17 or later.
JUNIOR_SPAN = 20
CADET_SPAN = 17
# Mirrors MIN_PLAUSIBLE_AGE in frontend/src/data/fencerInfo.js.
MIN_PLAUSIBLE_AGE = 8


def parse_date(s: str):
    if not s:
        return None
    s = s.strip()
    for fmt in ("%d.%m.%Y %H:%M", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def name_key_strict(s: str) -> str:
    # Matches pipeline.js's nameKey: lowercase + collapse whitespace,
    # hyphens preserved. Shipped in `name_keys` so the frontend can
    # match this enrichment record to a bout-derived fencer key.
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def name_key_loose(s: str) -> str:
    # Tolerant variant: treat hyphens as spaces, so "Ball-La-Hood"
    # collides with "Ball-La Hood". Used only for cross-file merging
    # inside this script, never shipped.
    return re.sub(r"\s+", " ", re.sub(r"-", " ", (s or "").strip())).lower()


def display_name(prenom: str, nom: str) -> str:
    # FNZ XML stores Nom (surname) uppercased. Title-case for display,
    # which handles hyphenated and apostrophised names reasonably (e.g.
    # "BALL-LA HOOD" -> "Ball-La Hood"). Some edge cases like McKnight
    # will display as "Mcknight"; we accept this small cosmetic loss in
    # exchange for not maintaining a casing dictionary.
    return f"{(prenom or '').strip()} {(nom or '').strip().title()}".strip()


# A handful of XML rows have data-entry cruft like "FNZ #12345" or
# "23456'". Normalise before using the licence as a merge key, so
# multiple cruft variants of the same number collapse to one fencer.
_LICENCE_PREFIX_RE = re.compile(r"^\s*(FE?NZ\s*#?\s*)+", re.IGNORECASE)
_LICENCE_TRIM_RE = re.compile(r"[^A-Za-z0-9]+$")

def normalise_licence(licence: str) -> str:
    if not licence:
        return ""
    s = licence.strip()
    s = _LICENCE_PREFIX_RE.sub("", s)
    s = _LICENCE_TRIM_RE.sub("", s)
    return s.strip().upper()


def new_record():
    return {
        "displays": [],            # list of (date, "Joel Ball-La Hood")
        "name_strict_keys": set(),
        "dob_year": None,
        "handedness": "",
        "nation": "",
        "clubs": [],               # list of (date, club_str)
        "rankings": [],            # list of (date, weapon, gender, rank)
        "licences": set(),         # all licence numbers attributed to this fencer
    }


def merge_record(tgt, src):
    tgt["displays"].extend(src["displays"])
    tgt["name_strict_keys"].update(src["name_strict_keys"])
    tgt["clubs"].extend(src["clubs"])
    tgt["rankings"].extend(src["rankings"])
    if (src["dob_year"] is not None and tgt["dob_year"] is None
            and is_plausible_dob_year(src["dob_year"])):
        tgt["dob_year"] = src["dob_year"]
    if not tgt["handedness"]:
        tgt["handedness"] = src["handedness"]
    if not tgt["nation"]:
        tgt["nation"] = src["nation"]
    tgt["licences"].update(src["licences"])


def is_plausible_dob_year(year: int) -> bool:
    # Reject XML data-entry errors that record a baby as a fencer (e.g.
    # DateNaissance="03.01.2026"). The youngest realistic competitor in
    # NZ events is ~7 years old, so we require the fencer to be at
    # least that old in the script's current year. Lower bound rejects
    # obvious-typo birth years like 1015.
    now = datetime.now().year
    return 1900 <= year <= now - 7


def absorb(rec, comp_date, name, dob, club, hand, nation, weapon, gender, rank, licence):
    if name:
        rec["displays"].append((comp_date, name))
        rec["name_strict_keys"].add(name_key_strict(name))
    if dob and rec["dob_year"] is None and is_plausible_dob_year(dob.year):
        rec["dob_year"] = dob.year
    if hand and not rec["handedness"]:
        rec["handedness"] = hand
    if nation and not rec["nation"]:
        rec["nation"] = nation
    if club:
        rec["clubs"].append((comp_date, club))
    if rank is not None and weapon:
        rec["rankings"].append((comp_date, weapon, gender, rank))
    if licence:
        rec["licences"].add(licence)


def finalize(rec):
    rec["displays"].sort(key=lambda x: x[0] or datetime.min)
    disp = rec["displays"][-1][1] if rec["displays"] else ""
    rec["clubs"].sort(key=lambda x: x[0] or datetime.min)
    current_club = rec["clubs"][-1][1] if rec["clubs"] else ""
    all_clubs = []
    for _, c in rec["clubs"]:
        if c and c not in all_clubs:
            all_clubs.append(c)
    rankings = {}
    for d, w, g, r in sorted(rec["rankings"], key=lambda x: x[0] or datetime.min):
        gu = (g or "").upper()
        gnorm = "M" if gu.startswith("M") else "W" if gu.startswith("F") or gu.startswith("W") else "M"
        rankings[f"{w}_{gnorm}"] = {
            "rank": r,
            "as_of": d.strftime("%Y-%m-%d") if d else None,
        }
    entry = {
        "display_name": disp,
        "name_keys": sorted(rec["name_strict_keys"]),
        "dob_year": rec["dob_year"],
        "handedness": rec["handedness"] or None,
        "nation": rec["nation"] or None,
        "current_club": current_club or None,
        "clubs": all_clubs,
        "rankings": rankings,
    }
    if rec["licences"]:
        # Only the fact that a licence is on record ships. buildEnrichmentIndex
        # uses it to pick between duplicate records for the same name.
        entry["has_licence"] = True
    return entry


def dataset_season() -> int:
    """Latest year in ingest/bouts.csv: the leaderboard's "current year"."""
    latest = 0
    try:
        with BOUTS_PATH.open(newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                year = (row.get("date") or "")[:4]
                if year.isdigit():
                    latest = max(latest, int(year))
    except FileNotFoundError:
        pass
    return latest or datetime.now().year


def withhold_from_year() -> int:
    """Birth years from here on may belong to someone under 18."""
    return datetime.now().year - 18


def dob_implausible(entry) -> bool:
    # Same rule as implausibleDob() in frontend/src/data/fencerInfo.js: the
    # fencer would be younger than MIN_PLAUSIBLE_AGE at their earliest ranking.
    years = []
    for r in (entry.get("rankings") or {}).values():
        y = ((r or {}).get("as_of") or "")[:4]
        if y.isdigit():
            years.append(int(y))
    return bool(years) and min(years) - entry["dob_year"] < MIN_PLAUSIBLE_AGE


def withhold_minor_dob(entry, season: int, withhold_from: int):
    """Replace a possibly-under-18 birth year with what the site needs from it.

    Keeps buildEnrichmentIndex choosing the same record (the +10 for a known
    DOB and the implausible-DOB demotion) and keeps the Cadet/Junior
    leaderboards listing the same fencers, without publishing the year.
    """
    dob = entry.get("dob_year")
    if dob is None or dob < withhold_from:
        return entry
    implausible = dob_implausible(entry)
    entry["dob_year"] = None
    entry["dob_withheld"] = True
    entry["age_eligibility"] = {
        "season": season,
        "junior": dob >= season - JUNIOR_SPAN,
        "cadet": dob >= season - CADET_SPAN,
    }
    if implausible:
        entry["dob_implausible"] = True
    return entry


def main():
    if not XML_DIR.exists():
        print(f"ERROR: {XML_DIR} does not exist", file=sys.stderr)
        sys.exit(1)

    files = sorted(XML_DIR.glob("*.xml"))
    print(f"Parsing {len(files)} XML files...")

    licenced = {}              # licence string → record
    unlicenced = []            # records that lack a licence

    parsed = 0
    fencer_rows = 0
    for f in files:
        try:
            tree = ET.parse(f)
        except ET.ParseError as e:
            print(f"  skip {f.name}: {e}", file=sys.stderr)
            continue
        root = tree.getroot()
        if root.tag != "CompetitionIndividuelle":
            continue
        parsed += 1
        comp_date = parse_date(root.get("Date", ""))
        weapon = WEAPON_MAP.get(root.get("Arme", ""))

        for t in root.iter("Tireur"):
            licence = (t.get("Licence") or "").strip()
            nom = (t.get("Nom") or "").strip()
            prenom = (t.get("Prenom") or "").strip()
            if not (nom or prenom):
                continue
            name = display_name(prenom, nom)
            dob = parse_date(t.get("DateNaissance", ""))
            club = (t.get("Club") or "").strip()
            hand = HANDEDNESS_MAP.get((t.get("Lateralite") or "").strip(), "")
            nation = (t.get("Nation") or "").strip()
            gender = (t.get("Sexe") or "").strip()
            try:
                rank = int((t.get("Classement") or "").strip() or "")
            except ValueError:
                rank = None
            fencer_rows += 1

            norm_licence = normalise_licence(licence)
            rec = new_record()
            absorb(rec, comp_date, name, dob, club, hand, nation, weapon, gender, rank, norm_licence)
            if norm_licence:
                if norm_licence in licenced:
                    merge_record(licenced[norm_licence], rec)
                else:
                    licenced[norm_licence] = rec
            else:
                unlicenced.append(rec)

    # Coalesce records that represent the same person. A single fencer can
    # legitimately appear under several licence numbers (FNZ renewals, FIE
    # licences, multi-year history), so deduping by licence alone leaves
    # duplicates. The merge key is (loose-name, dob_year); when dob_year is
    # missing we still merge by name alone, but only between unlicenced
    # records — we won't fuse a licenced fencer into an unrelated unlicenced
    # one without DOB confirmation.
    by_key = {}            # (loose_name, dob_year) -> record
    name_only = {}         # loose_name -> record  (unlicenced fallback)
    name_only_blocked = set()

    def stash(rec):
        if not rec["name_strict_keys"]:
            return
        anchor = next(iter(rec["name_strict_keys"]))
        loose = name_key_loose(anchor)
        if rec["dob_year"] is not None:
            key = (loose, rec["dob_year"])
            if key in by_key:
                merge_record(by_key[key], rec)
            else:
                by_key[key] = rec
            # Block name-only merges for any name now anchored to a DOB.
            name_only_blocked.add(loose)
            name_only.pop(loose, None)
        else:
            if loose in name_only_blocked:
                # A DOB-anchored record already exists; create an orphan
                # bucket so we don't silently fold an unrelated person in.
                by_key[(loose, None)] = rec
            elif loose in name_only:
                merge_record(name_only[loose], rec)
            else:
                name_only[loose] = rec

    for rec in licenced.values():
        stash(rec)
    for rec in unlicenced:
        stash(rec)

    # Final fold: an unlicenced no-DOB orphan (loose, None) can be safely
    # merged into the DOB-anchored record when exactly one such record
    # shares the loose name. Multi-DOB collisions are left alone.
    by_loose = {}
    for (loose, dob_year), rec in by_key.items():
        if dob_year is not None:
            by_loose.setdefault(loose, []).append((dob_year, rec))
    for loose in list(by_key.keys()):
        if loose[1] is not None:
            continue
        candidates = by_loose.get(loose[0], [])
        if len(candidates) == 1:
            merge_record(candidates[0][1], by_key.pop(loose))

    output = [finalize(rec) for rec in by_key.values()]
    output.extend(finalize(rec) for rec in name_only.values())
    output.sort(key=lambda x: x["display_name"].lower())

    season = dataset_season()
    withhold_from = withhold_from_year()
    for entry in output:
        withhold_minor_dob(entry, season, withhold_from)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    with_lic = sum(1 for x in output if x.get("has_licence"))
    withheld = sum(1 for x in output if x.get("dob_withheld"))
    try:
        rel = OUT_PATH.relative_to(Path.cwd())
    except ValueError:
        rel = OUT_PATH
    print(f"Parsed {parsed}/{len(files)} files, {fencer_rows} fencer rows")
    print(f"Wrote {len(output)} fencers -> {rel}")
    print(f"  {with_lic} fencers with a licence on record")
    print(f"  {withheld} birth years withheld (born {withhold_from} or later), "
          f"Cadet/Junior flags for the {season} season")


if __name__ == "__main__":
    main()
