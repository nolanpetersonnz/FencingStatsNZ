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
      "dob_year": 2006,                  # year only — full DOB never leaves
      "handedness": "right" | "left",    # null if unknown
      "nation": "NZL",
      "current_club": "South Wellington Fencing Club",
      "clubs": ["Wellington Swords Club", "Wellington South Fencing Club"],
      "rankings": {
        "epee_M": {"rank": 2, "as_of": "2024-10-27"},
        ...
      },
      "licence_hash": "sha256(pepper|licence)"   # absent if no licence
    }

Licence numbers themselves never appear in the output. The pepper lives
in .env (gitignored) and is also bundled into the Vite frontend via
VITE_LICENCE_PEPPER so the login modal can hash user input client-side
and compare to the shipped hashes.

Usage:
    python ingest/fencerinfo_ingest.py
"""

import hashlib
import json
import os
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
ENV_PATH = ROOT / ".env"


def load_pepper() -> str:
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if s.startswith("VITE_LICENCE_PEPPER="):
                _, _, val = s.partition("=")
                return val.strip().strip('"').strip("'")
    return os.environ.get("VITE_LICENCE_PEPPER", "")


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


# A handful of XML rows have data-entry cruft like "FNZ #20499" or
# "20377'". Normalise before hashing so the user-typed licence (sans
# cruft) still matches, and so multiple cruft variants of the same
# number collapse to one hash. KEEP THIS IN SYNC with the same
# normaliser in frontend/src/data/fencerInfo.js.
_LICENCE_PREFIX_RE = re.compile(r"^\s*(FE?NZ\s*#?\s*)+", re.IGNORECASE)
_LICENCE_TRIM_RE = re.compile(r"[^A-Za-z0-9]+$")

def normalise_licence(licence: str) -> str:
    if not licence:
        return ""
    s = licence.strip()
    s = _LICENCE_PREFIX_RE.sub("", s)
    s = _LICENCE_TRIM_RE.sub("", s)
    return s.strip().upper()


def hash_licence(licence: str, pepper: str) -> str:
    return hashlib.sha256(f"{pepper}|{normalise_licence(licence)}".encode("utf-8")).hexdigest()


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
    if src["dob_year"] is not None and tgt["dob_year"] is None:
        tgt["dob_year"] = src["dob_year"]
    if not tgt["handedness"]:
        tgt["handedness"] = src["handedness"]
    if not tgt["nation"]:
        tgt["nation"] = src["nation"]
    tgt["licences"].update(src["licences"])


def absorb(rec, comp_date, name, dob, club, hand, nation, weapon, gender, rank, licence):
    if name:
        rec["displays"].append((comp_date, name))
        rec["name_strict_keys"].add(name_key_strict(name))
    if dob and rec["dob_year"] is None:
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


def finalize(rec, pepper):
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
        # A fencer can legitimately accumulate several licence numbers over
        # the years (federation licences renew, FIE licences are separate).
        # Ship all hashes; login accepts a match against any of them.
        entry["licence_hashes"] = sorted({hash_licence(l, pepper) for l in rec["licences"]})
    return entry


def main():
    pepper = load_pepper()
    if not pepper:
        print("WARNING: VITE_LICENCE_PEPPER not found — hashes will be unsalted.", file=sys.stderr)

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

    output = [finalize(rec, pepper) for rec in by_key.values()]
    output.extend(finalize(rec, pepper) for rec in name_only.values())
    output.sort(key=lambda x: x["display_name"].lower())

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    with_lic = sum(1 for x in output if x.get("licence_hashes"))
    total_hashes = sum(len(x.get("licence_hashes", [])) for x in output)
    try:
        rel = OUT_PATH.relative_to(Path.cwd())
    except ValueError:
        rel = OUT_PATH
    print(f"Parsed {parsed}/{len(files)} files, {fencer_rows} fencer rows")
    print(f"Wrote {len(output)} fencers -> {rel}")
    print(f"  {with_lic} fencers with at least one licence hash ({total_hashes} hashes total)")
    print(f"  {len(output) - with_lic} fencers without any licence hash")


if __name__ == "__main__":
    main()
