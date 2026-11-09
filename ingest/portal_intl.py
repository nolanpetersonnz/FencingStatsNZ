#!/usr/bin/env python3
"""
portal_intl.py: NZ fencers' placings at overseas events, from FeNZ's results portal

FeNZ's results portal, https://results.fencing.org.nz, also holds overseas
competitions, tagged International: FIE events (World Cups, world and zonal
championships, satellites) and Australian ones. For those it records the
podium and the NZ fencers' places only: no field size, and no bouts to rate.
This reads every International competition, keeps each event's NZL rows, and
writes ingest/intl_results.json for the site's International tab and
profiles. It works out no points: FeNZ's own ranking counts FIE results and
the Australian competitions it lists (PANELS.md section 0).

Politeness is portal_ingest.py's, through its PoliteClient: robots.txt, one
request at a time at least 2 seconds apart, the FencingStatsNZ-Ingest
User-Agent, every response cached under ingest/cache/portal/ (gitignored),
and a stop with no retry on a 403 or 429.

Usage, from the repo root:
    python ingest/portal_intl.py                  # the competitions list from the cache, if held
    python ingest/portal_intl.py --refresh-list   # fetch the list again, for new competitions
    python ingest/portal_intl.py --offline        # cache only; send no requests

Each record:
  - fencer: the site's key for the name (nameKey in pipeline.js), and
    fencer_name its spelling. Names go through portal_ingest's Resolver, so a
    fencer takes the spelling their NZ bouts use, NAME_DECISIONS included.
    The portal often adds a preferred name in brackets, "GOURLEY, Daniel
    (Dan)": the name without brackets is tried first, then the forms the
    brackets give (pick_name), and the first the site already has is used.
    Names new to the site, and close matches, are listed in
    ingest/cache/intl_review.md and never merged automatically. A veteran's
    age band in the name, such as "(50+)", is dropped
  - event: the competition's name; event_label: the portal's event tab
    ("Epee Women Senior"), which gives weapon, gender and category
  - place: as the portal lists it; country: its IOC code, when known
  - date and date_end: the competition's dates (these event pages show none)
  - level: fie, or for an Australian competition national_championship or
    national_circuit, from its name
  - placing: the portal's rank; field_size: null, as the portal lists only
    the podium and the NZ fencers
  - results_url: the event's page on the portal
  - status approved, reason fenz_portal: FeNZ's own record, so there is
    nothing to review here, and any points come from FeNZ's ranking
Only these fields are written: no clubs, birth dates, licence numbers or age
bands, whatever the portal shows.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

INGEST_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(INGEST_DIR))
import portal_ingest as pi  # noqa: E402

OUT = INGEST_DIR / "intl_results.json"
REVIEW = INGEST_DIR / "cache" / "intl_review.md"
LIST_URL = f"{pi.BASE_URL}/competitions"

# IOC codes for the places the portal lists. A place not here (or two
# countries, such as "Switzerland & France") keeps its text and no code.
PLACE_CODES = {
    "Australia": "AUS", "Brazil": "BRA", "Canada": "CAN", "Egypt": "EGY", "El Salvador": "ESA",
    "Hong Kong": "HKG", "India": "IND", "Indonesia": "INA", "Singapore": "SGP",
}
NZ_NATIONS = {"NZL", "NZ", "NEW ZEALAND"}
GENDER_WORDS = re.compile(r"(?i)^(foil|epee|épée|sabre|saber|men|mens|women|womens|ladies|male|female|mixed)$")


def parse_competition_list(page: str) -> list[dict]:
    """The /competitions page: [{id, name, tags, place}], one per card."""
    flat = re.sub(r"\s+", " ", re.sub(r"<script.*?</script>", "", page, flags=re.S))
    out = []
    for cid, card in re.findall(rf'<a href="/competitions/({pi.UUID})"[^>]*>(.*?)</a>', flat):
        divs = re.findall(r"<div[^>]*>(.*?)</div>", card)
        place = re.search(r'<span class="ml-2">(.*?)</span>', card)
        out.append({
            "id": cid,
            "name": pi._text(divs[0]) if divs else "",
            "tags": [pi._text(t) for t in re.findall(r'<span class="[^"]*rounded-full[^"]*">(.*?)</span>', card)],
            "place": pi._text(place.group(1)) if place else "",
        })
    if not out:
        raise ValueError("no competition cards on the competitions page: has the layout changed?")
    return out


def category_of(label: str) -> tuple[str | None, str]:
    """'Epee Women Senior' -> ('senior', 'Senior'): the site's category, if
    one fits, and the label's own age words."""
    age = " ".join(w for w in label.split() if not GENDER_WORDS.match(w))
    w = age.lower()
    if re.search(r"\bvet", w):
        return "veteran", age
    if re.search(r"\bjunior\b|\bu ?20\b", w):
        return "u20", age
    if re.search(r"\bcadet\b|\bu ?17\b", w):
        return "u17", age
    if re.search(r"\bsenior\b|\bopen\b", w):
        return "senior", age
    return None, age


def fix_mojibake(s: str) -> str:
    """'BÃ©CHET' -> 'BéCHET': UTF-8 read as Latin-1, as a few portal names are."""
    if re.search("[ÂÃ][\u0080-¿]", s):
        try:
            return s.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return s


def name_candidates(raw: str) -> list[str]:
    """The portal's name without its brackets, then the forms the brackets
    give, in the order tried. The portal adds a preferred name in brackets:
    'GOURLEY, Daniel (Dan)' gives 'GOURLEY, Daniel', then 'GOURLEY, Dan',
    'GOURLEY, Dan Daniel' and 'GOURLEY, Daniel Dan'; 'LI, Ruihan(ryan)
    (Ryan Li)' also 'Ryan Li'; 'YUAN, Louise Xinrui (Louise)' also 'YUAN,
    Xinrui'. A bracketed age band, '(50+)', is dropped, and a name without
    its full stops is tried too. The first two are the plain forms."""
    s = re.sub(r"\([^)]*\d[^)]*\)", " ", fix_mojibake(raw))
    nicks = [" ".join(n.split()) for n in re.findall(r"\(([^)]*)\)", s) if n.strip()]
    base = " ".join(re.sub(r"\([^)]*\)", " ", s).split()).replace(" ,", ",")
    out = [base, base.replace(".", "")]
    if "," in base:
        last, given = (x.strip() for x in base.split(",", 1))
        for n in nicks:
            if len(n.split()) > 1:
                out.append(n)
                continue
            out += [f"{last}, {n}", f"{last}, {n} {given}", f"{last}, {given} {n}"]
            rest = " ".join(w for w in given.split() if w.lower() != n.lower())
            if rest and rest != given:
                out.append(f"{last}, {rest}")
    return out


def on_site(known: pi.KnownNames, name: str) -> bool:
    """The site already has this name: bouts, a registry alias of a name with
    bouts, or a NAME_DECISIONS entry."""
    key = pi.name_key(pi.title_name(name))
    src = known.source.get(key, "")
    return key in pi.NAME_DECISIONS or src == "bouts.csv" or src.startswith("fencers.json alias")


def pick_name(raw: str, known: pi.KnownNames) -> tuple[str, bool]:
    """The first candidate the site already has, else the portal's own name.
    True when it took a form the brackets gave."""
    cands = name_candidates(raw)
    for i, c in enumerate(cands):
        if c and on_site(known, c):
            return c, i >= 2
    return cands[0], False


def level_of(comp: dict) -> str:
    if comp["place"] != "Australia":
        return "fie"
    return "national_championship" if re.search(r"(?i)championship", comp["name"]) else "national_circuit"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--refresh-list", action="store_true", help="fetch the competitions list again")
    ap.add_argument("--offline", action="store_true", help="use the cache only; send no requests")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--replace", action="store_true", help="allow dropping competitions --out already holds")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    client = pi.PoliteClient(offline=args.offline)
    if args.refresh_list:
        for p in client._paths(LIST_URL):
            p.unlink(missing_ok=True)
    listed = [c for c in parse_competition_list(client.get(LIST_URL)) if "International" in c["tags"]]
    print(f"[intl] {len(listed)} International competitions on the portal")

    known = pi.KnownNames.load([INGEST_DIR / "bouts.csv", INGEST_DIR / "bouts_portal.csv"],
                               INGEST_DIR / "fencers.json")
    resolver = pi.Resolver(known)
    records: list[dict] = []
    notes: list[str] = []
    bracketed: dict[str, str] = {}   # portal name -> site name, found through its brackets
    per_comp: list[str] = []
    gathered: list[tuple] = []       # every NZL row, resolved once all are read
    for card in listed:
        cid = card["id"]
        try:
            comp = pi.parse_competition(client.get(f"{pi.BASE_URL}/competitions/{cid}"), cid)
        except ValueError as e:
            if "no event tabs" not in str(e):
                raise
            notes.append(f"{card['name']}: no events listed yet, skipped")
            continue
        comp["place"] = comp["place"] or card["place"]
        line = [f"- **{comp['name']}** ({comp['start']} to {comp['end']}, {comp['place'] or 'no place listed'})"]
        for eid, label in comp["events"]:
            weapon, genders, _ = pi.parse_event_label(label)
            category, age = category_of(label)
            url = f"{pi.BASE_URL}/competitions/{cid}/events/{eid}"
            _ev_date, rows = pi.parse_standings(client.get(url))
            nz = [r for r in rows if r["nation"].strip().upper() in NZ_NATIONS]
            line.append(f"  - {label}: {len(rows)} rows, {len(nz)} NZL")
            if not nz:
                notes.append(f"{comp['name']} / {label}: no NZL rows")
            if category is None:
                notes.append(f"{comp['name']} / {label}: age words {age!r} fit no site category")
            gathered += [(comp, eid, label, weapon, genders, category, age, url, r) for r in nz]
        per_comp.append("\n".join(line))
        print(f"[intl] {comp['name']}: {len(comp['events'])} events")

    # The portal gives some fencers a bracketed preferred name in one event
    # and not in another ('MCARTHUR, Samuel (Sam)', 'MCARTHUR, Samuel'): the
    # plain name then takes what its bracketed form found on the site.
    plain = lambda raw: pi.name_key(pi.title_name(name_candidates(raw)[0]))  # noqa: E731
    via_brackets: dict[str, str] = {}
    for *_, r in gathered:
        name, by_bracket = pick_name(r["raw"], known)
        if by_bracket:
            via_brackets.setdefault(plain(r["raw"]), name)
    for comp, eid, label, weapon, genders, category, age, url, r in gathered:
        raw, by_bracket = pick_name(r["raw"], known)
        if not by_bracket and not on_site(known, raw) and plain(r["raw"]) in via_brackets:
            raw, by_bracket = via_brackets[plain(r["raw"])], True
        name = resolver.resolve(raw, weapon, "", f"{comp['name']} / {label}")
        if by_bracket:
            bracketed[r["raw"]] = name
        key = pi.name_key(name)
        records.append({
            "id": f"portal:{eid}:{key}",
            "fencer": key,
            "fencer_name": name,
            "weapon": weapon,
            "gender": "mixed" if len(genders) > 1 else genders[0].lower(),
            "category": category,
            "age_label": age,
            "event": comp["name"],
            "event_label": label,
            "place": comp["place"],
            "country": PLACE_CODES.get(comp["place"]),
            "level": level_of(comp),
            "date": comp["start"],
            "date_end": comp["end"],
            "results_url": url,
            "placing": r["rank"],
            "field_size": None,
            "made_de": None,
            "status": "approved",
            "reason": "fenz_portal",
        })

    dupes = [k for k, n in Counter(r["id"] for r in records).items() if n > 1]
    if dupes:
        print(f"[intl] the same fencer twice in one event: {dupes}. Nothing written.", file=sys.stderr)
        return 1
    records.sort(key=lambda r: (r["date"], r["event"], r["event_label"], -r["placing"], r["fencer_name"]), reverse=True)

    out_path = Path(args.out)
    if out_path.exists() and not args.replace:
        held = {r["event"] for r in json.loads(out_path.read_text(encoding="utf-8")).get("results", [])}
        dropped = sorted(held - {r["event"] for r in records})
        if dropped:
            print(f"[intl] {out_path} also holds {', '.join(dropped)}, which this run would drop. "
                  "Pass --replace if that is meant. Nothing written.", file=sys.stderr)
            return 1
    out_path.write_text(json.dumps({
        "source": "FeNZ results portal, International competitions (results.fencing.org.nz)",
        "note": "Podium and NZ fencers only: no field sizes. Written by ingest/portal_intl.py.",
        "results": records,
    }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    fencers = len({r["fencer"] for r in records})
    print(f"[intl] wrote {len(records)} results for {fencers} fencers to {out_path} "
          f"({client.requests_made} requests sent this run)")

    report = [f"# International results review\n\n{len(records)} NZ results, {fencers} fencers, "
              f"{len(per_comp)} competitions.\n\n## Competitions\n", *per_comp, "\n## Notes\n",
              *(f"- {n}" for n in notes or ["none"]), "\n## Names new to the site\n"]
    for name, info in sorted(resolver.new.items()):
        close = "; ".join(f"{c['name']} ({c['score']})" for c in info["close"]) or "no close match"
        report.append(f"- {name} ({info['event']}): {close}")
    report.append("\n## Names the registry knows but the site has no bouts for\n")
    for name, info in sorted(resolver.registry_new.items()):
        close = "; ".join(f"{c['name']} ({c['score']})" for c in info["close"]) or "no close match"
        report.append(f"- {name} ({info['event']}): registry lists {info['registry'] or 'nothing else'}; {close}")
    report.append("\n## Names found through the portal's bracketed preferred name\n")
    report += [f"- {k} -> {v}" for k, v in sorted(bracketed.items())] or ["- none"]
    report.append("\n## Spellings taken from the site\n")
    report += [f"- {k} -> {v}" for k, v in sorted({**resolver.aliased, **resolver.decided}.items())] or ["- none"]
    REVIEW.write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"[intl] review written to {REVIEW}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
