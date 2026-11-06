#!/usr/bin/env python3
"""
portal_ingest.py: FeNZ results portal to FencingStatsNZ CSV

The old FeNZ API that fenz_ingest.py reads (api.fencing.org.nz) now returns
errors and retires at the end of 2026. Results now live on the new portal,
https://results.fencing.org.nz. It has no JSON API: every page is HTML built
on the server (FastHTML with htmx), so this reads the pages a browser does:

    /competitions/{comp}                         name, dates, place, event tabs
    /competitions/{comp}/events/{event}          event date, final standings
    /competitions/{comp}/events/{event}/pools    pool tables (V5 / D3 cells)
    /competitions/{comp}/events/{event}/bracket  DE cards, the winner in bold

and writes ingest/bouts_portal.csv in the same 15 columns as bouts.csv. It
never writes bouts.csv: the refresh workflow rebuilds that file from the old
API, and the site loads every ingest/*.csv (copy-data.mjs and the manifest).

Politeness, agreed with the portal's maintainer and not optional:
  - robots.txt is read first and obeyed
  - one request at a time, at least 2 seconds apart (2.5 here)
  - every response is cached under ingest/cache/portal/ (gitignored), so a
    rerun sends no requests; delete a cached file to fetch that page again
  - User-Agent: FencingStatsNZ-Ingest/0.3 (+https://github.com/nolanpetersonnz/FencingStatsNZ)
  - a 403 or 429 stops the run with no retry, and leaves a STOP file in the
    cache that blocks every later request until a person deletes it

Usage, from the repo root:
    pip install requests rapidfuzz          # fenz_ingest.py's dependencies
    python ingest/portal_ingest.py --nationals-2026
    python ingest/portal_ingest.py --comp UUID [UUID ...] --out ingest/bouts_portal.csv
    python ingest/portal_ingest.py --nationals-2026 --offline   # cache only

Rows follow bouts.csv:
  - date: the competition's start date, YYYY-MM-DD
  - competition: "<portal name> <year, if the name lacks one> - Mens|Womens",
    so parseAgeCategory still reads Veteran or Senior from the name
  - pool bouts: one row per pair, the lower pool position as fencer A
  - de_round: T64, T32, T16, QF, SF or Final, from the tableau size
  - a mixed event is written once per gender with identical rows, as the old
    data has it; dedupeBouts in pipeline.js folds the two copies into one
  - fencer_a_uid and fencer_b_uid stay blank: portal IDs are another system
  - flag stays blank: the portal shows no abandonment, medical, exclusion or
    DNF markers, so fenz_ingest's WD_CODES have nothing to match; suspicious
    bouts (missing scores, a tie, a winner with fewer touches) are listed in
    the review instead of guessed
  - names go from "SURNAME, Given" to "Given Surname" with title_name; a name
    whose site key (nameKey in pipeline.js) matches bouts.csv or a fencers.json
    name key takes the existing spelling; close matches (rapidfuzz WRatio 88
    or more, same weapon or club) are listed for review, never merged
  - only these 15 columns are written: no birth dates, licence numbers or
    other personal fields, whatever the portal shows

A review report (bout-count checks, suspicious bouts, names, club changes)
goes to ingest/cache/portal_review.md, and the portal's final standings to
ingest/cache/portal_standings.json for the placing check. Both stay local.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

INGEST_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(INGEST_DIR))
from fenz_ingest import CSV_HEADER, DE_ROUND_LABELS, Bout, title_name  # noqa: E402

try:
    from rapidfuzz import fuzz, process  # noqa: E402
except ImportError:  # pragma: no cover
    print("Missing dependency. Run:  pip install rapidfuzz requests", file=sys.stderr)
    sys.exit(1)

BASE_URL = "https://results.fencing.org.nz"
USER_AGENT = "FencingStatsNZ-Ingest/0.3 (+https://github.com/nolanpetersonnz/FencingStatsNZ)"
UA_TOKEN = "FencingStatsNZ-Ingest"
MIN_GAP_SECONDS = 2.5
CACHE_DIR = INGEST_DIR / "cache" / "portal"
FUZZY_THRESHOLD = 88

# Phase A: the two 2026 Nationals (24 to 26 Oct 2026, Christchurch).
NATIONALS_2026 = [
    "92242dc1-3e3f-4e76-bca8-c3cb77763600",  # NZL National Senior Championships
    "eaa26091-93c6-4d86-b53b-7cd8992f7df8",  # NZL National Veteran Championships
]

UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


# ============================================================
# POLITE CLIENT: robots.txt, one request at a time, spacing, disk cache
# ============================================================

class StopScraping(SystemExit):
    """Raised on a 403 or 429. Never caught: the run ends there."""


class FetchError(RuntimeError):
    pass


class PoliteClient:
    def __init__(self, cache_dir: Path = CACHE_DIR, offline: bool = False):
        self.cache_dir = cache_dir
        self.offline = offline
        self.requests_made = 0
        self._robots: dict[str, urllib.robotparser.RobotFileParser] = {}
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _paths(self, url: str) -> tuple[Path, Path]:
        p = urllib.parse.urlsplit(url)
        slug = re.sub(r"[^A-Za-z0-9._-]+", "_",
                      (p.path + ("?" + p.query if p.query else "")).strip("/"))[:80] or "root"
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
        host_dir = self.cache_dir / re.sub(r"[^A-Za-z0-9._-]+", "_", p.netloc)
        host_dir.mkdir(parents=True, exist_ok=True)
        base = host_dir / f"{slug}-{digest}"
        return base.with_name(base.name + ".body"), base.with_name(base.name + ".meta.json")

    def _request(self, url: str) -> tuple[int, bytes]:
        stop_file = self.cache_dir / "STOP"
        if stop_file.exists():
            raise StopScraping(f"STOP file present ({stop_file}): an earlier run got a 403 or 429. "
                               "Not sending anything. Tell Nolan; delete the file only once that is sorted.")
        if self.offline:
            raise FetchError(f"offline and not cached: {url}")
        lock_dir = self.cache_dir / ".lock"
        state = self.cache_dir / ".last_request"
        t0 = time.time()
        while True:  # one request at a time, across processes too
            try:
                lock_dir.mkdir()
                break
            except FileExistsError:
                if time.time() - t0 > 120:
                    raise FetchError(f"lock held for 2 minutes: {lock_dir}")
                time.sleep(0.5)
        try:
            try:
                last = float(state.read_text(encoding="utf-8").strip() or 0)
            except (FileNotFoundError, ValueError):
                last = 0.0
            wait = last + MIN_GAP_SECONDS - time.time()
            if wait > 0:
                time.sleep(wait)
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.1"})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    status, headers, body = r.status, dict(r.headers), r.read()
            except urllib.error.HTTPError as e:
                status, headers = e.code, dict(e.headers or {})
                try:
                    body = e.read()
                except Exception:
                    body = b""
            finally:
                state.write_text(str(time.time()), encoding="utf-8")
                self.requests_made += 1
            body_path, meta_path = self._paths(url)
            body_path.write_bytes(body)
            meta_path.write_text(json.dumps({
                "url": url, "status": status, "headers": headers, "bytes": len(body),
                "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            }, indent=2), encoding="utf-8")
            if status in (403, 429):
                stop_file.write_text(f"{status} on {url} at {time.ctime()}\n", encoding="utf-8")
                raise StopScraping(f"HTTP {status} on {url}. Stopped, no retry. Tell Nolan.")
            return status, body
        finally:
            try:
                lock_dir.rmdir()
            except OSError:
                pass

    def _allowed(self, url: str) -> bool:
        p = urllib.parse.urlsplit(url)
        origin = f"{p.scheme}://{p.netloc}"
        if origin not in self._robots:
            robots_url = origin + "/robots.txt"
            status, text = self._cached_or_fetch(robots_url)
            rp = urllib.robotparser.RobotFileParser()
            if 200 <= status < 300:
                rp.parse(text.splitlines())
            elif 400 <= status < 500:
                rp.allow_all = True  # no robots.txt: no restrictions
            else:
                raise FetchError(f"robots.txt unavailable (HTTP {status}); not proceeding")
            self._robots[origin] = rp
        rp = self._robots[origin]
        return rp.can_fetch(UA_TOKEN, url) and rp.can_fetch(USER_AGENT, url)

    def _cached_or_fetch(self, url: str) -> tuple[int, str]:
        body_path, meta_path = self._paths(url)
        if meta_path.exists() and body_path.exists():
            status = json.loads(meta_path.read_text(encoding="utf-8"))["status"]
            return status, body_path.read_text(encoding="utf-8", errors="replace")
        status, body = self._request(url)
        return status, body.decode("utf-8", errors="replace")

    def get(self, url: str) -> str:
        if not self._allowed(url):
            raise FetchError(f"robots.txt disallows {url}")
        status, text = self._cached_or_fetch(url)
        if not 200 <= status < 300:
            raise FetchError(f"HTTP {status} for {url} (cached; delete the cache file to retry)")
        return text


# ============================================================
# PAGE PARSERS (the portal's HTML as of Nov 2026; it is "under active
# development", so every parser checks its own output and fails loudly)
# ============================================================

def _text(fragment: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", fragment)).split())


def parse_competition(page: str, comp_id: str) -> dict:
    body = re.sub(r"<script.*?</script>", "", page, flags=re.S)
    flat = re.sub(r"\s+", " ", body)
    events = re.findall(
        rf'hx-get="/competitions/{comp_id}/events/({UUID})"[^>]*?hx-target="#event-shell"[^>]*>([^<]+)</a>', flat)
    if not events:
        raise ValueError(f"{comp_id}: no event tabs found")
    head = flat[: flat.find('hx-target="#event-shell"')]
    pieces = [p.strip() for p in re.split(r"<[^>]+>", head) if p.strip()]
    # The range reads like 2026-10-24, an en dash, 2026-10-26, a middle dot, then the place.
    date_re = re.compile(r"^(\d{4}-\d{2}-\d{2})(?:\s*\S\s*(\d{4}-\d{2}-\d{2}))?\s*\N{MIDDLE DOT}\s*(.+)$")
    for i, piece in enumerate(pieces):
        m = date_re.match(html.unescape(piece))
        if m and i > 0:
            return {
                "id": comp_id,
                "name": html.unescape(pieces[i - 1]),
                "start": m.group(1),
                "end": m.group(2) or m.group(1),
                "place": html.unescape(m.group(3)).strip(),
                "events": [(eid, html.unescape(label).strip()) for eid, label in events],
            }
    raise ValueError(f"{comp_id}: competition name and dates not found")


def parse_event_label(label: str) -> tuple[str, list[str], str]:
    """'Foil Mixed Veteran' -> ('foil', ['Mens', 'Womens'], 'Veteran')."""
    words = label.split()
    w = label.lower()
    weapon = "foil" if "foil" in w else "sabre" if ("sabre" in w or "saber" in w) else "epee" if ("epee" in w or "épée" in w) else None
    if weapon is None:
        raise ValueError(f"unknown weapon in event {label!r}")
    if re.search(r"\bmixed\b", w):
        genders = ["Mens", "Womens"]
    elif re.search(r"\bwom[ae]n\b|\bladies\b|\bfemale\b", w):
        genders = ["Womens"]
    elif re.search(r"\bm[ae]n\b|\bmale\b", w):
        genders = ["Mens"]
    else:
        raise ValueError(f"unknown gender in event {label!r}")
    category = words[-1] if words else ""
    return weapon, genders, category


def parse_standings(page: str) -> tuple[str, list[dict]]:
    """Event page: (event date YYYY-MM-DD or '', [{rank, raw, club, nation}])."""
    flat = re.sub(r"\s+", " ", re.sub(r"<script.*?</script>", "", page, flags=re.S))
    m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})\s*·", flat)
    ev_date = f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else ""
    rows: list[dict] = []
    # Podium: a rank number, then one or more name / club / nation blocks.
    table_at = flat.find("<table")
    podium = flat[:table_at] if table_at >= 0 else flat
    for block in re.split(r'<div class="text-xl font-bold block">', podium)[1:]:
        rank = int(re.match(r"\s*(\d+)\s*</div>", block).group(1))
        for name, club, nation in re.findall(
                r"<strong[^>]*>(.*?)</strong>\s*<p[^>]*>(.*?)</p>\s*<p[^>]*>(.*?)</p>", block):
            rows.append({"rank": rank, "raw": _text(name), "club": _text(club), "nation": _text(nation)})
    for tr in re.findall(r'<tr class="ledger-row">(.*?)</tr>', flat):
        tds = [_text(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", tr)]
        if len(tds) >= 4 and tds[0].isdigit():
            rows.append({"rank": int(tds[0]), "raw": tds[1], "club": tds[2], "nation": tds[3]})
    rows.sort(key=lambda r: r["rank"])
    return ev_date, rows


def parse_pools(page: str) -> list[dict]:
    """[{title, names: [...], cells: [[...]]}], rows in pool order."""
    pools = []
    for chunk in re.split(r"<h4[^>]*>", page)[1:]:
        title = _text(chunk[: chunk.find("</h4>")])
        if not title.lower().startswith("pool"):
            continue
        table = chunk[: chunk.find("</table>")]
        header = [_text(x) for x in re.findall(r"<th[^>]*>(.*?)</th>",
                                                 table[table.find("<thead"): table.find("</thead>")], re.S)][1:]
        names, cells = [], []
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table[table.find("<tbody"):], re.S):
            th = re.search(r"<th[^>]*>(.*?)</th>", tr, re.S)
            if not th:
                continue
            names.append(_text(th.group(1)))
            cells.append([_text(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)])
        if names != header or any(len(r) != len(names) for r in cells):
            raise ValueError(f"{title}: pool table is not square or rows and columns disagree")
        pools.append({"title": title, "names": names, "cells": cells})
    return pools


def round_size(title: str) -> int | None:
    t = title.lower()
    m = re.search(r"tableau of (\d+)", t)
    if m:
        return int(m.group(1))
    if "quarter" in t:
        return 8
    if "semi" in t:
        return 4
    if "final" in t:
        return 2
    return None


def parse_bracket(page: str) -> list[dict]:
    """[{title, size, cards: [{names: [top, bottom], scores: [..], winner: 0|1|None}]}]"""
    rounds = []
    for chunk in re.split(r"<h4[^>]*>", page)[1:]:
        title = _text(chunk[: chunk.find("</h4>")])
        size = round_size(title)
        if size is None:
            raise ValueError(f"unknown DE round title {title!r}")
        cards = []
        for card in re.split(r'<div class="rounded border', chunk)[1:]:
            spans = re.findall(r'<span class="([^"]*)">(.*?)</span>', card, re.S)
            names = [(cls, _text(v)) for cls, v in spans if "font-mono" not in cls]
            scores = [_text(v) for cls, v in spans if "font-mono" in cls]
            bold = [i for i, (cls, _) in enumerate(names) if "font-bold" in cls]
            cards.append({
                "names": [n for _, n in names],
                "scores": scores,
                "winner": bold[0] if len(bold) == 1 else None,
            })
        rounds.append({"title": title, "size": size, "cards": cards})
    return rounds


# ============================================================
# NAMES: keep the site's identity (nameKey) stable
# ============================================================

def name_key(name: str) -> str:
    """Same as nameKey in frontend/src/data/pipeline.js."""
    return " ".join((name or "").split()).lower()


@dataclass
class KnownNames:
    spelling: dict[str, str] = field(default_factory=dict)     # key -> existing spelling
    source: dict[str, str] = field(default_factory=dict)       # key -> 'bouts.csv' | 'fencers.json'
    weapons: dict[str, set] = field(default_factory=lambda: defaultdict(set))
    clubs: dict[str, set] = field(default_factory=lambda: defaultdict(set))
    latest_club: dict[str, tuple[str, str]] = field(default_factory=dict)  # key -> (date, club)

    @classmethod
    def load(cls, bouts_csv: Path, fencers_json: Path) -> "KnownNames":
        k = cls()
        counts: dict[str, Counter] = defaultdict(Counter)
        with open(bouts_csv, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                for side in ("a", "b"):
                    nm, club = r[f"fencer_{side}"].strip(), r[f"club_{side}"].strip()
                    key = name_key(nm)
                    if not key:
                        continue
                    counts[key][nm] += 1
                    k.weapons[key].add(r["weapon"])
                    if club:
                        k.clubs[key].add(club.lower())
                        prev = k.latest_club.get(key)
                        if prev is None or r["date"] >= prev[0]:
                            k.latest_club[key] = (r["date"], club)
        for key, c in counts.items():
            k.spelling[key] = c.most_common(1)[0][0]
            k.source[key] = "bouts.csv"
        if fencers_json.exists():
            for rec in json.loads(fencers_json.read_text(encoding="utf-8")):
                display = rec.get("display_name") or ""
                for nk in rec.get("name_keys") or []:
                    key = name_key(nk)
                    if key and key not in k.spelling:
                        k.spelling[key] = display if name_key(display) == key else title_name(nk)
                        k.source[key] = "fencers.json"
                    for club in [*(rec.get("clubs") or []), rec.get("current_club") or ""]:
                        if club:
                            k.clubs[key].add(str(club).lower())
        return k


@dataclass
class Resolver:
    known: KnownNames
    exact: dict[str, str] = field(default_factory=dict)      # raw -> resolved
    new: dict[str, dict] = field(default_factory=dict)       # resolved -> info for review

    def resolve(self, raw: str, weapon: str, club: str, event: str) -> str:
        if raw in self.exact:
            return self.exact[raw]
        display = title_name(raw)
        key = name_key(display)
        if key in self.known.spelling:
            resolved = self.known.spelling[key]
        else:
            resolved = display
            hits = process.extract(key, list(self.known.spelling.keys()), scorer=fuzz.WRatio,
                                   score_cutoff=FUZZY_THRESHOLD, limit=8)
            close = []
            for cand, score, _ in hits:
                same_weapon = weapon in self.known.weapons.get(cand, set())
                same_club = bool(club) and club.lower() in self.known.clubs.get(cand, set())
                if same_weapon or same_club:
                    close.append({"name": self.known.spelling[cand], "score": round(score, 1),
                                  "same_weapon": same_weapon, "same_club": same_club,
                                  "source": self.known.source.get(cand, "")})
            self.new[resolved] = {"raw": raw, "club": club, "event": event, "close": close}
        self.exact[raw] = resolved
        return resolved


# ============================================================
# INGEST
# ============================================================

@dataclass
class EventResult:
    comp: dict
    event_id: str
    label: str
    weapon: str
    genders: list[str]
    date: str
    standings: list[dict]
    pools: list[dict]
    rounds: list[dict]
    bouts: list[Bout] = field(default_factory=list)       # one copy (no mixed duplicate)
    checks: dict = field(default_factory=dict)
    suspicious: list[str] = field(default_factory=list)


def competition_name(comp: dict) -> str:
    name = comp["name"]
    year = comp["start"][:4]
    return name if re.search(r"\b(19|20)\d{2}\b", name) else f"{name} {year}"


def ingest_event(client: PoliteClient, comp: dict, event_id: str, label: str, resolver: Resolver) -> EventResult:
    base = f"{BASE_URL}/competitions/{comp['id']}/events/{event_id}"
    weapon, genders, _category = parse_event_label(label)
    ev_date, standings = parse_standings(client.get(base))
    pools = parse_pools(client.get(base + "/pools"))
    rounds = parse_bracket(client.get(base + "/bracket"))
    ev = EventResult(comp, event_id, label, weapon, genders, ev_date, standings, pools, rounds)
    club_of = {r["raw"]: r["club"] for r in standings}
    tag = f"{comp['name']} / {label}"

    def person(raw: str) -> tuple[str, str]:
        club = club_of.get(raw, "")
        if raw not in club_of:
            ev.suspicious.append(f"{tag}: {raw!r} fenced but is not in the final standings (no club)")
        return resolver.resolve(raw, weapon, club, tag), club

    # Pools: one row per pair, the lower pool position as fencer A.
    expected_pool, pool_rows, gaps = 0, 0, 0
    for pool in pools:
        names, cells = pool["names"], pool["cells"]
        n = len(names)
        expected_pool += n * (n - 1) // 2
        for i in range(n):
            for j in range(i + 1, n):
                ci, cj = cells[i][j], cells[j][i]
                mi, mj = re.fullmatch(r"([VD])(\d+)", ci), re.fullmatch(r"([VD])(\d+)", cj)
                if not (mi and mj):
                    gaps += 1
                    ev.suspicious.append(f"{tag} {pool['title']}: {names[i]} v {names[j]} has no result ({ci!r} / {cj!r}); left out")
                    continue
                (vi, si), (vj, sj) = (mi.group(1), int(mi.group(2))), (mj.group(1), int(mj.group(2)))
                if {vi, vj} != {"V", "D"}:
                    ev.suspicious.append(f"{tag} {pool['title']}: {names[i]} {ci} v {names[j]} {cj}: not one V and one D")
                elif (vi == "V" and si < sj) or (vj == "V" and sj < si):
                    ev.suspicious.append(f"{tag} {pool['title']}: {names[i]} {ci} v {names[j]} {cj}: the winner has fewer touches")
                elif si == sj:
                    ev.suspicious.append(f"{tag} {pool['title']}: {names[i]} {ci} v {names[j]} {cj}: equal touches, so the site will read a draw")
                if si == 0 and sj == 0:
                    ev.suspicious.append(f"{tag} {pool['title']}: {names[i]} v {names[j]} is 0-0")
                a_name, a_club = person(names[i])
                b_name, b_club = person(names[j])
                ev.bouts.append(Bout(date=comp["start"], competition="", weapon=weapon, gender="",
                                     bout_type="pool", a_name=a_name, a_club=a_club, a_uid=None,
                                     b_name=b_name, b_club=b_club, b_uid=None, score_a=si, score_b=sj))
                pool_rows += 1

    # DE: the top name on each card as fencer A.
    de_rows = 0
    for rnd in rounds:
        label_round = DE_ROUND_LABELS.get(rnd["size"], f"T{rnd['size']}")
        for card in rnd["cards"]:
            names, scores, win = card["names"], card["scores"], card["winner"]
            if len(names) != 2:
                ev.suspicious.append(f"{tag} {rnd['title']}: a card with {len(names)} name(s) {names}; left out")
                continue
            if len(scores) != 2 or not all(s.isdigit() for s in scores):
                ev.suspicious.append(f"{tag} {rnd['title']}: {names[0]} v {names[1]} has scores {scores}; left out")
                continue
            sa, sb = int(scores[0]), int(scores[1])
            if win is None:
                ev.suspicious.append(f"{tag} {rnd['title']}: {names[0]} {sa} v {names[1]} {sb}: no winner marked")
            elif (win == 0 and sa <= sb) or (win == 1 and sb <= sa):
                ev.suspicious.append(f"{tag} {rnd['title']}: {names[0]} {sa} v {names[1]} {sb}: the marked winner "
                                     f"({names[win]}) does not have more touches")
            if sa == 0 and sb == 0:
                ev.suspicious.append(f"{tag} {rnd['title']}: {names[0]} v {names[1]} is 0-0")
            a_name, a_club = person(names[0])
            b_name, b_club = person(names[1])
            ev.bouts.append(Bout(date=comp["start"], competition="", weapon=weapon, gender="",
                                 bout_type="de", a_name=a_name, a_club=a_club, a_uid=None,
                                 b_name=b_name, b_club=b_club, b_uid=None, score_a=sa, score_b=sb,
                                 de_round=label_round))
            de_rows += 1

    entrants = len(standings)
    pool_entrants = sum(len(p["names"]) for p in pools)
    ev.checks = {
        "entrants": entrants, "pool_entrants": pool_entrants, "pools": len(pools),
        "pool_expected": expected_pool, "pool_rows": pool_rows, "pool_gaps": gaps,
        "de_expected": entrants - 1, "de_rows": de_rows,
        "rounds": [f"{r['title']}:{len(r['cards'])}" for r in rounds],
    }
    return ev


def write_rows(events: list[EventResult], out_path: Path) -> int:
    rows = []
    for ev in events:
        comp_name = competition_name(ev.comp)
        for gender in ev.genders:  # a mixed event: once per gender, identical rows
            for b in ev.bouts:
                b2 = Bout(**{**b.__dict__, "competition": f"{comp_name} - {gender}", "gender": gender})
                rows.append(b2.csv_row())
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(CSV_HEADER)
        w.writerows(rows)
    return len(rows)


def review(events: list[EventResult], resolver: Resolver, known: KnownNames, client: PoliteClient) -> str:
    out = ["# Portal ingest review", ""]
    out.append(f"Requests sent this run: {client.requests_made} (the rest came from the cache).")
    out.append("")
    out.append("## Bout counts per event")
    out.append("")
    out.append("| Event | Entrants | Pools | Pool bouts (expected) | DE bouts (entrants minus 1) | Rounds |")
    out.append("|---|---|---|---|---|---|")
    all_ok = True
    for ev in events:
        c = ev.checks
        ok_pool = c["pool_rows"] + c["pool_gaps"] == c["pool_expected"]
        ok_de = c["de_rows"] == c["de_expected"]
        ok_ent = c["entrants"] == c["pool_entrants"]
        all_ok &= ok_pool and ok_de and ok_ent
        out.append(f"| {ev.comp['name']} / {ev.label} | {c['entrants']}"
                   f"{'' if ok_ent else ' (pools: ' + str(c['pool_entrants']) + ')'} | {c['pools']} | "
                   f"{c['pool_rows']} ({c['pool_expected']}{', gaps ' + str(c['pool_gaps']) if c['pool_gaps'] else ''})"
                   f"{'' if ok_pool else ' MISMATCH'} | {c['de_rows']} ({c['de_expected']}){'' if ok_de else ' MISMATCH'} | "
                   f"{' '.join(c['rounds'])} |")
    out.append("")
    out.append("All counts match." if all_ok else "**Some counts do not match: see above.**")
    out.append("")
    sus = [s for ev in events for s in ev.suspicious]
    out.append(f"## Suspicious bouts ({len(sus)})")
    out.append("")
    out += [f"- {s}" for s in sus] or ["None: no 0-0, missing scores, ties, or winners with fewer touches."]
    out.append("")
    unmatched = {k: v for k, v in resolver.new.items() if not v["close"]}
    near = {k: v for k, v in resolver.new.items() if v["close"]}
    out.append(f"## Names not in bouts.csv or fencers.json ({len(resolver.new)}): {len(near)} with a close match, {len(unmatched)} without")
    out.append("")
    if near:
        out.append("Close matches (WRatio 88 or more, same weapon or club). Nothing was merged; each stays a separate person unless you decide otherwise.")
        out.append("")
        for name, info in sorted(near.items()):
            cands = "; ".join(f"{c['name']} ({c['score']}, {'weapon' if c['same_weapon'] else ''}"
                              f"{' and ' if c['same_weapon'] and c['same_club'] else ''}{'club' if c['same_club'] else ''})"
                              for c in info["close"])
            out.append(f"- **{name}** ({info['club'] or 'no club'}, {info['event']}): {cands}")
        out.append("")
    if unmatched:
        out.append("New fencers with no close match:")
        out.append("")
        for name, info in sorted(unmatched.items()):
            out.append(f"- {name} ({info['club'] or 'no club'}, {info['event']})")
        out.append("")
    # Existing fencers whose club differs from their latest club in bouts.csv.
    changes = {}
    for ev in events:
        for r in ev.standings:
            resolved = resolver.exact.get(r["raw"])
            if not resolved:
                continue
            key = name_key(resolved)
            prev = known.latest_club.get(key)
            if prev and r["club"] and r["club"].lower() != prev[1].lower():
                changes[resolved] = (prev[1], r["club"], ev.label)
    out.append(f"## Club differs from the latest club in bouts.csv ({len(changes)})")
    out.append("")
    out.append("The site shows each fencer's most recent club, so these would change on the site (unless an alias in pipeline.js maps them together).")
    out.append("")
    out += [f"- {n}: {a} -> {b} ({ev})" for n, (a, b, ev) in sorted(changes.items())] or ["None."]
    out.append("")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--comp", nargs="*", default=[], help="portal competition UUIDs")
    ap.add_argument("--nationals-2026", action="store_true", help="Phase A: both 2026 Nationals")
    ap.add_argument("--out", default=str(INGEST_DIR / "bouts_portal.csv"))
    ap.add_argument("--offline", action="store_true", help="use the cache only; send no requests")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    comp_ids = list(args.comp) + (NATIONALS_2026 if args.nationals_2026 else [])
    if not comp_ids:
        ap.error("give --comp UUID ... or --nationals-2026")
    if Path(args.out).resolve() == (INGEST_DIR / "bouts.csv").resolve():
        ap.error("refusing to write bouts.csv: the portal ingest writes its own file")

    client = PoliteClient(offline=args.offline)
    known = KnownNames.load(INGEST_DIR / "bouts.csv", INGEST_DIR / "fencers.json")
    resolver = Resolver(known)
    events: list[EventResult] = []
    for cid in comp_ids:
        comp = parse_competition(client.get(f"{BASE_URL}/competitions/{cid}"), cid)
        print(f"[portal] {comp['name']} ({comp['start']} to {comp['end']}, {comp['place']}): {len(comp['events'])} events")
        for eid, label in comp["events"]:
            ev = ingest_event(client, comp, eid, label, resolver)
            c = ev.checks
            print(f"[portal]   {label}: {c['entrants']} entrants, {c['pool_rows']} pool + {c['de_rows']} DE bouts"
                  f"{' (mixed: written for Mens and Womens)' if len(ev.genders) > 1 else ''}")
            events.append(ev)

    n = write_rows(events, Path(args.out))
    print(f"[portal] wrote {n} rows to {args.out} ({client.requests_made} requests sent this run)")

    standings = [{
        "competition": competition_name(ev.comp), "weapon": ev.weapon, "genders": ev.genders,
        "date": ev.comp["start"], "event": ev.label, "event_date": ev.date,
        "standings": [{"rank": r["rank"], "name": resolver.exact.get(r["raw"], title_name(r["raw"])),
                       "club": r["club"], "nation": r["nation"]} for r in ev.standings],
    } for ev in events]
    (INGEST_DIR / "cache" / "portal_standings.json").write_text(json.dumps(standings, indent=1), encoding="utf-8")
    report = review(events, resolver, known, client)
    (INGEST_DIR / "cache" / "portal_review.md").write_text(report, encoding="utf-8")
    print(f"[portal] review written to {INGEST_DIR / 'cache' / 'portal_review.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
