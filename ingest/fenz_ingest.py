#!/usr/bin/env python3
"""
fenz_ingest.py — Fencing NZ public API → FencingStatsNZ CSV

Pulls bout-level data from the FeNZ public API at https://api.fencing.org.nz
and emits a CSV in the schema FencingStatsNZ accepts:

    date,competition,weapon,bout_type,fencer_a,club_a,fencer_b,club_b,
    score_a,score_b,de_round,gender,fencer_a_uid,fencer_b_uid

A single /public/results?cmpId=X call returns everything we need for one
competition: pool round-robins, full DE tableaux, and a final-standings
table with stable fencer UIDs. One round trip per competition.

Usage:
    pip install requests rapidfuzz
    python fenz_ingest.py --cmp 1439 1441 --cache ./cache --out bouts.csv
    python fenz_ingest.py --since 2025-04-29 --cache ./cache --out year.csv -v
    python fenz_ingest.py --since 2025-01-01 --categories open --out senior.csv

    # /latest only returns 10 comps. To reach further back, scan a cmpId range:
    python fenz_ingest.py --scan 1280 1441 --since 2025-04-29 --cache ./cache --out year.csv -v
    python fenz_ingest.py --scan 1280 1441 --since 2025-04-29 --list   # preview

    python fenz_ingest.py --explore "https://api.fencing.org.nz/public/results/latest?limit=50"

By default, --since/--latest exclude competitions with status aus/int/fie
(Australian, international, FIE events) since they aren't reliably scrape-
able through this API. Override with --exclude-status (none) to include them.

The --cache flag stores responses on disk by URL hash, so reruns are
instant and polite to the FeNZ server. Delete the cache dir to refresh.

Notes on the output CSV:
- Each event becomes a separate "competition" in FencingStatsNZ, named
  "<Competition> - Mens|Womens", because mens and womens populations
  shouldn't share a leaderboard. Weapon stays in its own column.
- We append three extra columns (gender, fencer_a_uid, fencer_b_uid) beyond
  what the React app currently uses. They're harmless — extra columns are
  ignored by the importer — and they make later cross-source merges easier.
"""

import argparse
import csv
import hashlib
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

try:
    from rapidfuzz import fuzz, process
except ImportError:
    print("Missing dependency. Run:  pip install rapidfuzz requests", file=sys.stderr)
    sys.exit(1)


BASE_URL = "https://api.fencing.org.nz/public"
DEFAULT_DELAY = 0.4
USER_AGENT = "FencingStatsNZ-Ingest/0.2 (personal analysis)"

CSV_HEADER = [
    "date", "competition", "weapon", "bout_type",
    "fencer_a", "club_a", "fencer_b", "club_b",
    "score_a", "score_b", "de_round",
    "gender", "fencer_a_uid", "fencer_b_uid", "flag",
]

DE_ROUND_LABELS = {64: "T64", 32: "T32", 16: "T16", 8: "QF", 4: "SF", 2: "Final"}

# Non-standard DE result codes (FeNZ tableau `code` field). A fencer carrying
# one of these did not lose on the strip: A = abandon, MED = medical, DNF = did
# not finish, E/EXC = excluded. The bout is recorded as a loss for that fencer
# but must not move either rating, so we tag it for the frontend pipeline.
WD_CODES = {"A", "MED", "DNF", "E", "EXC"}


# ============================================================
# API CLIENT — requests.Session + on-disk cache + throttle
# ============================================================

class APIClient:
    def __init__(self, base: str = BASE_URL, cache_dir: str | None = None,
                 delay: float = DEFAULT_DELAY, verbose: bool = False):
        self.base = base.rstrip("/")
        self.delay = delay
        self.verbose = verbose
        self.cache_dir = Path(cache_dir) if cache_dir else None
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        })
        self._last_request = 0.0

    def _cache_path(self, url: str, params: dict) -> Path:
        items = sorted((params or {}).items())
        key = url + "?" + "&".join(f"{k}={v}" for k, v in items)
        h = hashlib.sha1(key.encode()).hexdigest()[:16]
        return self.cache_dir / f"{h}.json"  # type: ignore

    def get(self, path: str, **params) -> Any:
        url = path if path.startswith("http") else f"{self.base}{path}"
        if self.cache_dir:
            cf = self._cache_path(url, params)
            if cf.exists():
                if self.verbose:
                    print(f"[cache] {url} {params}", file=sys.stderr)
                return json.loads(cf.read_text())
        gap = time.time() - self._last_request
        if gap < self.delay:
            time.sleep(self.delay - gap)
        if self.verbose:
            print(f"[fetch] {url} {params}", file=sys.stderr)
        r = self.session.get(url, params=params, timeout=30)
        self._last_request = time.time()
        r.raise_for_status()
        data = r.json()
        if self.cache_dir:
            cf.write_text(json.dumps(data))
        return data

    def latest(self, limit: int = 10):
        return self.get("/results/latest", limit=limit)

    def competition(self, cmp_id: int):
        return self.get("/results", cmpId=cmp_id)


# ============================================================
# PARSING HELPERS
# ============================================================

def first(d: dict, *keys, default=None):
    """Return the first present non-empty value among keys."""
    if not isinstance(d, dict):
        return default
    for k in keys:
        v = d.get(k)
        if v is not None and v != "":
            return v
    return default


def parse_iso_date(s: Any) -> str:
    """Coerce date strings to YYYY-MM-DD; pass through if already there."""
    if not s:
        return ""
    s = str(s).strip()
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    if "/" in s:  # NZ DD/MM/YYYY
        parts = s.split("/")
        if len(parts) == 3 and len(parts[2]) == 4:
            return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    return s


def parse_score(s: Any) -> int | None:
    """Pull integer touches out of 'V5', 'D3', '15', or 5."""
    if s is None or s == "":
        return None
    if isinstance(s, int):
        return s
    s = str(s).strip().upper()
    if s.startswith(("V", "D")):
        s = s[1:]
    try:
        return int(s)
    except ValueError:
        return None


def norm_weapon_from_desc(desc: str) -> str:
    """Map 'Mens Foil' / 'Womens Epee' / etc. to 'foil'/'epee'/'sabre'."""
    d = (desc or "").lower()
    if "foil" in d or "fleuret" in d:
        return "foil"
    if "sabre" in d or "saber" in d:
        return "sabre"
    if "epee" in d or "épée" in d:
        return "epee"
    return "epee"  # safe default


def extract_gender(desc: str) -> str:
    """Pull 'Mens' or 'Womens' out of the event long description."""
    d = (desc or "").lower()
    # Order matters: "women" contains "men" as substring
    if "women" in d or "ladies" in d or "female" in d:
        return "Womens"
    if "men" in d or "male" in d:
        return "Mens"
    return ""


def title_name(name: str) -> str:
    """Convert FeNZ 'LAST, First Names' to 'First Names Last' with proper case."""
    s = (name or "").strip()
    if "," in s:
        last, first_n = (p.strip() for p in s.split(",", 1))
        if last and first_n:
            if last.isupper() and len(last) > 1:
                last = last.title()
            if first_n.isupper() and len(first_n) > 1:
                first_n = first_n.title()
            s = f"{first_n} {last}"
    s = " ".join(s.split())
    if s.isupper() and len(s) > 3:
        s = s.title()
    return s


# ============================================================
# DATA SHAPES
# ============================================================

@dataclass
class Bout:
    date: str
    competition: str
    weapon: str
    gender: str
    bout_type: str          # "pool" or "de"
    a_name: str
    a_club: str
    a_uid: int | None
    b_name: str
    b_club: str
    b_uid: int | None
    score_a: int
    score_b: int
    de_round: str = ""
    flag: str = ""          # "" | "wd_a" | "wd_b" | "wd" (withdrawal / no-result)

    def csv_row(self):
        return [
            self.date, self.competition, self.weapon, self.bout_type,
            self.a_name, self.a_club, self.b_name, self.b_club,
            self.score_a, self.score_b, self.de_round,
            self.gender,
            self.a_uid if self.a_uid else "",
            self.b_uid if self.b_uid else "",
            self.flag,
        ]


# ============================================================
# COMPETITION PARSER — handles the actual FeNZ response shape
# ============================================================

def parse_latest(payload: Any) -> list[dict]:
    """Pull competitions out of the /results/latest response.
    Returns dicts with cmp_id, date, name, category for filtering."""
    items = payload if isinstance(payload, list) else (
        first(payload, "data", "results", "items", "latest", default=[]) or []
    )
    out = []
    for it in items:
        cid = first(it, "cmp_id", "cmpId", "id", "cmp")
        if cid is None:
            continue
        try:
            cid_int = int(cid)
        except (ValueError, TypeError):
            continue
        out.append({
            "cmp_id": cid_int,
            "date": parse_iso_date(first(it, "comp_start", "date", "startDate", default="")),
            "name": first(it, "name", "title", default=""),
            "category": first(it, "category", "cat", default=""),
            "status": first(it, "status", default=""),
        })
    return out


def ingest_competition(payload: dict, canon, verbose: bool = False) -> list[Bout]:
    """Walk a single /results?cmpId=X response and emit all its bouts."""
    if not isinstance(payload, dict):
        return []

    cmp = payload.get("cmp") or {}
    cmp_name = first(cmp, "name", "title", default="")
    cmp_date = parse_iso_date(first(cmp, "comp_start", "date", "startDate", default=""))
    avail = payload.get("availEvents") or []
    events_dict = payload.get("events") or {}

    all_bouts: list[Bout] = []
    for ae in avail:
        evt_key = str(first(ae, "event", "evt", "id", default="") or "")
        if not evt_key or evt_key not in events_dict:
            continue
        long_desc = first(ae, "long_desc", "desc", default="")
        weapon = norm_weapon_from_desc(long_desc)
        gender = extract_gender(long_desc)
        ev = events_dict[evt_key]
        if not ev.get("detailedResults"):
            if verbose:
                print(f"[skip] cmp evt {evt_key}: no detailedResults", file=sys.stderr)
            continue

        # Per-event competition name keeps mens/womens populations distinct
        # in the React app (compId = competition+weapon+date)
        ev_comp_name = f"{cmp_name} - {gender}".strip(" -") if gender else cmp_name

        # ---- Build name → uid + club map from final standings.
        # drawTournResults is the only place uids appear; everywhere else
        # uses just the "LAST, First" name string.
        name_to_uid: dict[str, int] = {}
        name_to_club: dict[str, str] = {}
        for tr in ev.get("drawTournResults") or []:
            n = (tr.get("name") or "").strip()
            uid = tr.get("uid")
            if n and uid is not None:
                try:
                    name_to_uid[n] = int(uid)
                except (ValueError, TypeError):
                    continue
                name_to_club[n] = (tr.get("club") or "").strip()

        # Helper: given a raw FeNZ name, register with the canonicalizer
        # (using uid if we have one) and return (display_name, club, uid).
        def resolve(raw_name: str, fallback_club: str = ""):
            raw_name = (raw_name or "").strip()
            if not raw_name:
                return None
            uid = name_to_uid.get(raw_name)
            club = name_to_club.get(raw_name) or fallback_club
            display = title_name(raw_name)
            display = canon.register(uid, display, club)
            resolved_club = canon.uid_to_club.get(uid, club) if uid else club
            return (display, resolved_club, uid)

        # ---- Pool bouts ---------------------------------------------------
        poules = ((ev.get("drawPouleRound") or {}).get("poules") or {})
        pool_count = 0
        for poule_id, members in poules.items():
            if not isinstance(members, dict):
                continue
            seen_pairs: set[tuple[str, str]] = set()
            for pos_a_str, info_a in members.items():
                matches = (info_a or {}).get("matches") or {}
                for pos_b_str in matches.keys():
                    try:
                        pa, pb = int(pos_a_str), int(pos_b_str)
                    except (ValueError, TypeError):
                        continue
                    if pa == pb:
                        continue
                    a_pos, b_pos = (pos_a_str, pos_b_str) if pa < pb else (pos_b_str, pos_a_str)
                    pair = (a_pos, b_pos)
                    if pair in seen_pairs:
                        continue
                    seen_pairs.add(pair)

                    info_low = members.get(a_pos) or {}
                    info_high = members.get(b_pos) or {}
                    score_low_raw = (info_low.get("matches") or {}).get(b_pos)
                    score_high_raw = (info_high.get("matches") or {}).get(a_pos)
                    s_low = parse_score(score_low_raw)
                    s_high = parse_score(score_high_raw)
                    if s_low is None or s_high is None:
                        continue

                    a = resolve(info_low.get("name", ""))
                    b = resolve(info_high.get("name", ""))
                    if not a or not b:
                        continue
                    a_name, a_club, a_uid = a
                    b_name, b_club, b_uid = b
                    all_bouts.append(Bout(
                        date=cmp_date, competition=ev_comp_name,
                        weapon=weapon, gender=gender, bout_type="pool",
                        a_name=a_name, a_club=a_club, a_uid=a_uid,
                        b_name=b_name, b_club=b_club, b_uid=b_uid,
                        score_a=s_low, score_b=s_high, de_round="",
                    ))
                    pool_count += 1

        # ---- DE bouts -----------------------------------------------------
        tableaux = ev.get("drawTableaux") or {}
        de_count = 0
        seen_de: set[tuple[int, int, int, int]] = set()
        sized_tabs = []
        for size_key, tab in tableaux.items():
            try:
                size = int(size_key) if isinstance(size_key, str) else int(size_key)
            except (ValueError, TypeError):
                continue
            sized_tabs.append((size, tab))
        sized_tabs.sort(key=lambda x: x[0])

        # DE pairing reconstruction. FeNZ's tableau_data lays fencers out so
        # adjacent rows should be a fenced pair, but the cache often misplaces
        # names — two fencers in adjacent slots may show inconsistent scores
        # (e.g. both winning 15-12, or HANSEN 15/12 next to WILSON 14/15)
        # because the data was shuffled at display time. To reconstruct real
        # bouts we:
        #   1. Take adjacent pairs whose scores match (winner.pf == loser.pa).
        #   2. For unmatched fencers, search the whole round for a score-match
        #      opponent. The cache mis-displays the slot but each fencer's own
        #      pf/pa pair is correct, so score matching finds the true partner.
        #   3. Any still-unmatched named fencer with a real opponent score
        #      (pa > 0) likely fenced someone whose row is fully blank. If
        #      exactly one fencer from the top-N final standings is missing
        #      from this round's named set, fill in the blank with that name.
        tourn_results = ev.get("drawTournResults") or []
        named_by_size: dict[int, set[str]] = {}
        for sz, t in sized_tabs:
            d = (t or {}).get("tableau_data") or []
            named_by_size[sz] = {
                (x.get("name") or "").strip()
                for x in d if (x.get("name") or "").strip()
            }

        for size, tab in sized_tabs:
            round_label = DE_ROUND_LABELS.get(size, f"T{size}")
            data = (tab or {}).get("tableau_data") or []
            n = len(data)

            entries: list[tuple[int, str, int, int]] = []
            for idx, item in enumerate(data):
                nm = (item.get("name") or "").strip()
                pf = parse_score(item.get("points_for"))
                pa = parse_score(item.get("points_against"))
                if nm and pf is not None and pa is not None:
                    entries.append((idx, nm, pf, pa))

            matched: dict[int, int] = {}

            # Step 1: adjacent pairs whose scores match are a real bout
            for i in range(0, n - 1, 2):
                a, b = data[i], data[i + 1]
                an = (a.get("name") or "").strip()
                bn = (b.get("name") or "").strip()
                if not an or not bn:
                    continue
                apf = parse_score(a.get("points_for"))
                apa = parse_score(a.get("points_against"))
                bpf = parse_score(b.get("points_for"))
                bpa = parse_score(b.get("points_against"))
                if apf is None or apa is None or bpf is None or bpa is None:
                    continue
                if apf == bpa and apa == bpf:
                    matched[i] = i + 1
                    matched[i + 1] = i

            # Step 2: for unmatched named entries, find their score-match
            # elsewhere in the round (handles misplaced rows)
            for idx, _, pf, pa in entries:
                if idx in matched:
                    continue
                candidates = [
                    j for j, _, pf2, pa2 in entries
                    if j != idx and j not in matched
                    and pf2 == pa and pa2 == pf
                ]
                if not candidates:
                    continue
                chosen = candidates[0] if len(candidates) == 1 else min(
                    candidates, key=lambda c: abs(c - idx)
                )
                matched[idx] = chosen
                matched[chosen] = idx

            # Step 3: recover one missing fencer from final standings if
            # exactly one named entry is unmatched and one fencer from the
            # top-N is absent from this round
            named_set = {nm for (_, nm, _, _) in entries}
            recovery_candidates = [
                (tr.get("name") or "").strip()
                for tr in tourn_results[:size]
                if (tr.get("name") or "").strip()
                and (tr.get("name") or "").strip() not in named_set
            ]
            unmatched_named = [
                (i, nm, pf, pa) for i, nm, pf, pa in entries if i not in matched
            ]
            unmatched_blanks = [
                i for i in range(n)
                if i not in matched and not (data[i].get("name") or "").strip()
            ]
            recovered_pairs: dict[int, str] = {}
            if (len(unmatched_named) == 1 and len(unmatched_blanks) >= 1
                    and len(recovery_candidates) == 1):
                idx_n, _, _, pa = unmatched_named[0]
                # Walkover guard: if the named side had no opponent score
                # (pa is 0 or None), the empty slot is a DNS, not a real bout.
                if pa is not None and pa > 0:
                    blank_idx = min(unmatched_blanks, key=lambda b: abs(b - idx_n))
                    matched[idx_n] = blank_idx
                    matched[blank_idx] = idx_n
                    recovered_pairs[blank_idx] = recovery_candidates[0]

            # Step 4: emit bouts
            emitted: set[int] = set()
            for i in range(n):
                if i not in matched or i in emitted:
                    continue
                j = matched[i]
                emitted.add(i)
                emitted.add(j)
                a_idx, b_idx = (i, j) if i < j else (j, i)
                a_raw = data[a_idx]
                b_raw = data[b_idx]
                a_name_raw = (a_raw.get("name") or "").strip()
                b_name_raw = (b_raw.get("name") or "").strip()
                a_pf = a_raw.get("points_for")
                a_pa = a_raw.get("points_against")
                b_pf = b_raw.get("points_for")
                b_pa = b_raw.get("points_against")

                if not a_name_raw and a_idx in recovered_pairs:
                    a_name_raw = recovered_pairs[a_idx]
                    if a_pf is None and b_pa is not None:
                        a_pf = b_pa
                if not b_name_raw and b_idx in recovered_pairs:
                    b_name_raw = recovered_pairs[b_idx]
                    if b_pf is None and a_pa is not None:
                        b_pf = a_pa

                if not a_name_raw or not b_name_raw:
                    continue
                s_a = parse_score(a_pf)
                s_b = parse_score(b_pf)
                if s_a is None or s_b is None:
                    continue

                a = resolve(a_name_raw)
                b = resolve(b_name_raw)
                if not a or not b:
                    continue
                a_name, a_club, a_uid = a
                b_name, b_club, b_uid = b

                key_uid_a = a_uid if a_uid is not None else hash(a_name)
                key_uid_b = b_uid if b_uid is not None else hash(b_name)
                lo, hi = sorted((key_uid_a, key_uid_b))
                de_key = (lo, hi, s_a, s_b) if key_uid_a < key_uid_b else (lo, hi, s_b, s_a)
                if de_key in seen_de:
                    continue
                seen_de.add(de_key)

                # Withdrawal / no-result detection from the per-fencer result
                # code. The withdrawing fencer keeps the loss but neither rating
                # moves (handled downstream in the frontend pipeline).
                a_wd = str(a_raw.get("code") or "").upper() in WD_CODES
                b_wd = str(b_raw.get("code") or "").upper() in WD_CODES
                flag = "wd" if (a_wd and b_wd) else "wd_a" if a_wd else "wd_b" if b_wd else ""

                all_bouts.append(Bout(
                    date=cmp_date, competition=ev_comp_name,
                    weapon=weapon, gender=gender, bout_type="de",
                    a_name=a_name, a_club=a_club, a_uid=a_uid,
                    b_name=b_name, b_club=b_club, b_uid=b_uid,
                    score_a=s_a, score_b=s_b, de_round=round_label, flag=flag,
                ))
                de_count += 1

        if verbose:
            print(f"[ingest] {ev_comp_name} ({weapon}): {pool_count} pool, {de_count} DE",
                  file=sys.stderr)

    return all_bouts


# ============================================================
# NAME CANONICALIZATION
# Mostly redundant given FeNZ uids, but useful as a safety net and for
# merging non-FeNZ data later (international events, training ladders).
# ============================================================

class NameCanonicalizer:
    def __init__(self, threshold: int = 88):
        self.threshold = threshold
        self.uid_to_name: dict[int, str] = {}
        self.uid_to_club: dict[int, str] = {}
        self.no_uid_names: dict[str, str] = {}

    def register(self, uid: int | None, name: str, club: str = "") -> str:
        norm = (name or "").strip()
        if uid is not None and uid != 0:
            if uid not in self.uid_to_name:
                self.uid_to_name[uid] = norm
            if club and uid not in self.uid_to_club:
                self.uid_to_club[uid] = club.strip()
            return self.uid_to_name[uid]
        # No uid — fuzzy merge against names we've seen unidentified
        if norm in self.no_uid_names:
            return self.no_uid_names[norm]
        if self.no_uid_names:
            match = process.extractOne(
                norm, list(self.no_uid_names.keys()), scorer=fuzz.WRatio
            )
            if match and match[1] >= self.threshold:
                canon = self.no_uid_names[match[0]]
                self.no_uid_names[norm] = canon
                return canon
        self.no_uid_names[norm] = norm
        return norm


# ============================================================
# CLI
# ============================================================

def write_csv(bouts: list[Bout], out_path: str | None):
    f = open(out_path, "w", newline="", encoding="utf-8") if out_path else sys.stdout
    try:
        w = csv.writer(f)
        w.writerow(CSV_HEADER)
        for b in bouts:
            w.writerow(b.csv_row())
        if out_path:
            print(f"Wrote {len(bouts)} bouts → {out_path}", file=sys.stderr)
    finally:
        if out_path:
            f.close()


def scan_range(client: APIClient, start_id: int, end_id: int,
                stop_after_blanks: int = 30, verbose: bool = False) -> list[dict]:
    """Probe cmpIds in [start_id, end_id], reading just the metadata of
    each. Returns competitions in the same shape parse_latest produces.

    stop_after_blanks: if we hit this many consecutive 404s/empty responses,
    assume we've fallen off the end of the ID space and stop.
    """
    out = []
    consecutive_blanks = 0
    for cid in range(start_id, end_id + 1):
        try:
            payload = client.competition(cid)
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code in (404, 500):
                consecutive_blanks += 1
                if verbose:
                    print(f"[scan] cmp {cid}: {e.response.status_code}", file=sys.stderr)
                if consecutive_blanks >= stop_after_blanks:
                    if verbose:
                        print(f"[scan] {stop_after_blanks} blanks in a row, stopping",
                              file=sys.stderr)
                    break
                continue
            raise
        cmp = (payload or {}).get("cmp") or {}
        cmp_id_field = cmp.get("cmp_id")
        if not cmp_id_field:
            consecutive_blanks += 1
            continue
        consecutive_blanks = 0
        out.append({
            "cmp_id": int(cmp_id_field),
            "date": parse_iso_date(cmp.get("comp_start") or ""),
            "name": cmp.get("name") or "",
            "category": cmp.get("category") or "",
            "status": cmp.get("status") or "",
        })
        if verbose:
            print(f"[scan] cmp {cid}: {cmp.get('name','')} ({cmp.get('comp_start','')})",
                  file=sys.stderr)
    return out


def main():
    p = argparse.ArgumentParser(
        description="Ingest Fencing NZ public API → FencingStatsNZ CSV",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--latest", type=int, metavar="N", default=None,
                   help="Pull the N most recent competitions (cap when scanning)")
    p.add_argument("--since", type=str, metavar="YYYY-MM-DD",
                   help="Only include competitions on or after this date "
                        "(implies scanning /latest with a generous limit)")
    p.add_argument("--until", type=str, metavar="YYYY-MM-DD",
                   help="Only include competitions on or before this date")
    p.add_argument("--categories", type=str, nargs="+", metavar="CAT",
                   help="Only include these categories (e.g. open u20 u17)")
    p.add_argument("--exclude-categories", type=str, nargs="+", metavar="CAT",
                   help="Skip these categories (e.g. u15 u17 to keep only senior)")
    p.add_argument("--exclude-status", type=str, nargs="+", metavar="STATUS",
                   default=["aus", "int", "fie"],
                   help="Skip competitions with these status codes "
                        "(default: aus int fie — non-NZ events)")
    p.add_argument("--cmp", type=int, nargs="+", metavar="ID",
                   help="Pull specific competition IDs (one or more)")
    p.add_argument("--out", type=str, default=None,
                   help="Output CSV file (default: stdout)")
    p.add_argument("--cache", type=str, default=None,
                   help="Cache dir for API responses (recommended)")
    p.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                   help=f"Seconds between live requests (default {DEFAULT_DELAY})")
    p.add_argument("--explore", type=str, metavar="URL",
                   help="Just fetch and pretty-print this URL's JSON, then exit")
    p.add_argument("--scan", type=int, nargs=2, metavar=("FROM", "TO"),
                   help="Probe cmpIds in this range and apply --since/--until/etc filters. "
                        "Use this to reach further back than the 10-comp /latest cap. "
                        "Example: --scan 1280 1441")
    p.add_argument("--list", action="store_true",
                   help="List matching competitions but don't fetch their bouts")
    p.add_argument("-v", "--verbose", action="store_true",
                   help="Print fetch/cache/parse events to stderr")
    args = p.parse_args()

    client = APIClient(cache_dir=args.cache, delay=args.delay, verbose=args.verbose)

    if args.explore:
        json.dump(client.get(args.explore), sys.stdout, indent=2, ensure_ascii=False)
        print()
        return

    use_latest = args.latest is not None or args.since or args.until or args.categories \
                 or args.exclude_categories or args.list
    if not use_latest and not args.cmp and not args.scan:
        p.error("Specify --latest N, --since DATE, --scan FROM TO, --cmp ID..., or --explore URL")

    selected: list[dict] = []
    if args.scan:
        comps = scan_range(client, args.scan[0], args.scan[1], verbose=args.verbose)
    elif use_latest:
        scan_n = args.latest if args.latest is not None else 200
        comps = parse_latest(client.latest(limit=scan_n))
        if not comps:
            print("[warn] /latest returned nothing parseable", file=sys.stderr)
    else:
        comps = []

    if comps:
        cats_in = set(c.lower() for c in (args.categories or []))
        cats_out = set(c.lower() for c in (args.exclude_categories or []))
        status_out = set(s.lower() for s in (args.exclude_status or []))

        for c in comps:
            if args.since and c["date"] and c["date"] < args.since:
                continue
            if args.until and c["date"] and c["date"] > args.until:
                continue
            cat = (c.get("category") or "").lower()
            if cats_in and cat not in cats_in:
                continue
            if cat in cats_out:
                continue
            status = (c.get("status") or "").lower()
            if status in status_out:
                continue
            selected.append(c)

    cmp_ids: list[int] = [c["cmp_id"] for c in selected]
    if args.cmp:
        cmp_ids.extend(args.cmp)
    cmp_ids = list(dict.fromkeys(cmp_ids))  # dedup, preserve order

    if args.list or (args.verbose and selected):
        print(f"[plan] {len(cmp_ids)} competitions to ingest:", file=sys.stderr)
        for c in selected:
            print(f"  {c['cmp_id']:>5}  {c['date']}  [{c.get('category',''):>4}]  {c['name']}",
                  file=sys.stderr)
        for extra_id in (args.cmp or []):
            if extra_id not in {c["cmp_id"] for c in selected}:
                print(f"  {extra_id:>5}  (manual --cmp)", file=sys.stderr)
        if args.list:
            return

    canon = NameCanonicalizer()
    all_bouts: list[Bout] = []
    for cid in cmp_ids:
        if args.verbose:
            print(f"[cmp] {cid}", file=sys.stderr)
        try:
            payload = client.competition(cid)
        except requests.HTTPError as e:
            print(f"[error] cmp {cid}: {e}", file=sys.stderr)
            continue
        all_bouts.extend(ingest_competition(payload, canon, args.verbose))

    all_bouts.sort(key=lambda b: (b.date, b.competition, 0 if b.bout_type == "pool" else 1))
    write_csv(all_bouts, args.out)


if __name__ == "__main__":
    main()
