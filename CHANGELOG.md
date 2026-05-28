# Changelog

## [0.1.13] - 2026-05-28
### Added
- "Results" view on the Competition detail Performance table, now the **default** ordering (toggle back to "Elo change" anytime). Official placings aren't in the FeNZ data, so placement is reconstructed from the DE bracket (new tested helper `deFinish` in `pipeline.js`) and shown as a place: `1` (won the DE), `2` (lost the final), then tied bands for everyone eliminated earlier, since fencing runs no classification bouts — `3rd tied` (lost a semi), `5th tied` (lost a quarter), `9th tied`, …; pool-only fencers get the below-the-cut range (DE entrants + 1 … field size, e.g. `17–32`). Each row shows its placement and W–L record. Addresses the FEEDBACK Round 3 request to "see who won, not just elo gain"
### Fixed
- Activity-implausible dates of birth no longer win the registry lookup. When a fencer is split into two records by a data-entry typo on one DOB, `buildEnrichmentIndex` could surface the wrong year — Chantelle May appeared as 2018 (impossible: she holds a 2024 national foil ranking, so she'd be 6) instead of 2004, which had placed a senior fencer in the Junior and Cadet leaderboards. A DOB that would make the fencer younger than 8 at the time of any ranking they hold is now demoted. The guard is deliberately narrow — exactly one record in the registry trips it — so genuine namesakes are left alone (the two James McKenzies, a 1977 veteran and a 1997 senior, both stay plausible and unchanged)

## [0.1.12] - 2026-05-28
### Fixed
- Medical and other non-result withdrawals no longer move ratings. FeNZ tableau data carries a per-fencer result `code`; alongside the normal `V`/`D` (victory/defeat) it uses `MED` (medical), `A` (abandon), `DNF`, and `E`/`EXC` (exclusion) for fencers who didn't lose on the strip. The ingest now reads this code and tags such bouts with a new `flag` column (`wd_a` / `wd_b`); `processBouts` records the bout as a loss for the fencer who withdrew and a win for the opponent, but contributes nothing to either rating. The 16 such bouts already in `bouts.csv` — recorded as 0–0 results that nudged both ratings as ties — were backfilled from the API cache. Reported via an anonymous DM (FEEDBACK Round 3)
- Secondary Schools events were classified as Senior. They match no U-band keyword (`U15`, `cadet`, `junior`, …) so `parseAgeCategory` fell them through to `senior`, feeding their bouts into the Senior/Junior/Cadet streams and able to make a school-only fencer a "native Senior". They're now classified as Cadet — the conservative choice for an NZ school-age field (years 9–13), so the bouts never count upward. Investigation note: the Senior rating *stream* itself was never contaminated by younger results (downward inclusion only flows Senior→Junior→Cadet), so the broader "U17s rated high" perception in FEEDBACK Round 3 is mostly the default "All ages" view blending categories — a separate UX item
- Sibling DOB collisions in the licence registry. A shared or mis-entered licence number in the source Fencing Time XML can fold a stray name alias of one family member into another's record — e.g. Kate Gourley's record carried the alias `daniel gourley`. `buildEnrichmentIndex` resolved the `daniel gourley` key to whichever record had the most signal, and the club-count tiebreaker handed it to the sibling, surfacing the wrong DOB (Daniel Gourley showed 2005, his sister's year, instead of 2007 — which also wrongly dropped him from the Junior leaderboard; the 0.1.10 note recorded this as correct). The lookup now gives a record an ownership bonus for a `name_key` equal to its own `display_name`, so the person literally named "Daniel Gourley" wins that key over a sibling listing it as an alias. Corrects Gourley, plus Craig & Stacy Chong, Milo Henshaw, Luke Boyd, and Tim Wang
### Added
- A `node:test` suite (`frontend/test/`) with an `npm test` script — no new dependencies. Covers age-category classification (incl. the Secondary Schools case), withdrawal rating behaviour against both synthetic bouts and the committed dataset, and the registry DOB-collision fix with a guard that no canonically-named fencer loses their own name key to a sibling
- `flag` column in the ingest CSV schema (`fenz_ingest.py`) — empty for normal bouts; `wd_a` / `wd_b` / `wd` mark withdrawals. Older CSVs without the column parse unchanged

## [0.1.11] - 2026-05-19
### Changed
- Competition Detail "Performance" table now orders fencers by total Elo change at that event (pool delta + DE delta), highest first, with an italic caption stating the ordering. Previously sorted by post-event rating, which mixed pool-only and DE-after values on different scales and could rank a high-rated early-exit above the gold medallist. Final placement isn't in the dataset, so Elo movement is the most informative proxy currently available
- Import (data ingest) and Tuning (rating parameters) moved off the public nav and into the Admin panel at `/#admin` as new section pills next to Edits and Clubs. Same token gate as the rest of admin. Public visitors now see only Ledger / Competitions / Clubs / Head-to-Head. `EmptyState`'s "Import Results" button redirects to `/#admin`
### Fixed
- `EditPanel` text inputs (display name, current club, merge target) no longer lose focus after each keystroke. The inner `Row` helper was defined inside the parent's render body, giving it a fresh component identity per render; React saw a new component type each time and remounted the `<input>`, dropping focus and the IME selection. Hoisted `Row` to module scope with `openId` / `setOpen` props so the input now has a stable parent and keeps focus while typing

## [0.1.10] - 2026-05-19
### Added
- DOB-based eligibility for the Cadet and Junior leaderboards — when the fencer is in the XML registry, age category derives from `dob_year` directly. Junior cutoff is `currentYear - 20` (born 2006+ in the 2026 season), Cadet is `currentYear - 17` (born 2009+). Auto-rolls each year as `currentYear` shifts. Fencers without a DOB still pass through the old event-tag inference. Net effect on Mens Épée Junior: list grows 55 → 68; Daniel Gourley (2005) correctly drops out, Joel Ball-La Hood, Nolan Peterson, Jack Hansen, Elliot Hayes, Josh Carson and ~10 others correctly appear despite skipping the 2026 junior-tagged events
- Weapon-aware Clubs page — respects the global weapon pill. The Mens Épée view now ranks clubs by their Mens Épée DE median; clubs whose entire roster is in other weapons (NZ Academy of Fencing — 29 members, all foil/sabre) no longer top the list with 0 épéeists
- Admin club editor at `/#admin` → Clubs section — set per-club website, location, and FNZ-affiliation status (yes/no/unknown). Rendered under the club heading on `ClubDetail`. Lays the groundwork for the "where should I fence?" reframe in FEEDBACK Round 2
- Admin fencer-to-club reassignment in the same panel — pick any fencer from a dropdown, type the destination club, Apply. Writes to the existing `club_overrides` doc so public reads share one code path with fencer-driven self-edits
- New `/api/admin` actions: `set_club_meta`, `clear_club_meta`, `assign_fencer`. `/api/overrides` now returns a `club_meta` map alongside the existing name/club/flagged docs
- Plausibility filter in `fencerinfo_ingest.py` rejects DOBs that would make a fencer younger than 7 in the current year — caught 14 XML data-entry errors (Brendan Lindsay as "born 2026", Thibault Schneider, etc.) that would otherwise false-positive into Cadet
- Visual sort indicators (`↓` arrow + active-row bolding) on the Bouts and W·L Leaderboard headers — the sort math always worked but the active-state cue was missing
### Changed
- Strength-tier letter on the Clubs page now requires at least 3 members active in the selected weapon. Under-threshold clubs show an em-dash instead of A/B/C, so a 1-fencer outpost with a single star can't outrank a deep club via median games. Partially addresses FEEDBACK Round 2 item #1 (club strength tier favoured tiny clubs)
- Activity gate on DOB-based junior/cadet filtering was dropped: being age-eligible is enough. Previously a junior who hadn't entered the 2026 season was excluded; now Joel Ball-La Hood (last épée 2024) and Nolan Peterson (last épée 2025) correctly appear in the 2026 junior leaderboard. The no-DOB fallback path still enforces recent activity as a sanity gate
- `bouts.csv` extended through Ongley Memorial Tournament 2026 (May 10) and Mark Rance Memorial 2026 (May 9). Dataset grows 16,509 → 17,061 bouts; range now 2024-02-17 → 2026-05-10
- Override-doc edit key now matches the bout-derived fencer key — client sends its own `fencer_key` with edits and the server verifies it's an alias of the licenced fencer before honouring. Fixes a bug where overrides for Joel Ball-La Hood wrote under the alphabetically-first alias and were silently never read on the public site
- `/api/overrides` accepts a `?t=` cache-bust query param via `loadOverrides({ fresh: true })`; `EditPanel` and the dispute button now trigger a refresh after submit so the change is visible without a hard reload
- Redis env-var detection in `api/_lib.js` accepts both Vercel marketplace defaults (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) and direct Upstash installs (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`); `fencerInfo()` falls back to an HTTP self-fetch when the bundled file can't be read from disk (covers `includeFiles` path quirks)
- Default git author on commits to this repo is now "Nolan Peterson" rather than "Nolan"
### Removed
- Decorative dingbats — fleuron (`❦`) in the App footer and Header tagline, and the `✓` checkmark on the Import success banner. Functional arrows (sort `↓`, score-flow `→`) kept

## [0.1.9] - 2026-05-19
### Added
- Fencer licence registry (`ingest/fencerinfo_ingest.py`) — walks `Fencerinfo/uploads/*.xml` (Fencing Time exports), aggregates per fencer (most-recent display name, DOB year, all clubs seen, current club, handedness, nation, latest FNZ ranking per weapon, all licence numbers) and emits `ingest/fencers.json` with SHA-256-peppered `licence_hashes` in place of raw licences; 1,355 unique fencers from 803 XML files, 940 with at least one licence hash (1,334 hashes total once year-on-year FNZ renewals and FIE numbers collapse into single records via `(loose-name, dob-year)` merging); SP-prefixed licences (the new FNZ format) and 4 data-entry oddballs (`FNZ #20499`, `20377'`) round-trip via shared `normalise_licence()` in both ingest and frontend
- DOB year / handedness / nation surfaced on `FencerProfile` (under the name heading) when the fencer is in the XML registry
- Licence-based sign-in — Header "Sign in" button opens `LoginModal`, hashes the entered licence client-side via `crypto.subtle` with `VITE_LICENCE_PEPPER`, looks up the matching fencer in the shipped `fencers.json`, persists the hash in `localStorage` for session restore; signed-in state shows the fencer's display name + Sign out, clicking the name jumps to their profile; "You" badge on own profile
- Live profile edits for signed-in fencers (`EditPanel`) — display name and current club apply immediately to the public site via `POST /api/edit` → Upstash override doc; merge-duplicate requests are queued for admin review
- Dispute bout flow — "Dispute" button per bout row on your own profile (signed-in only) opens a reason prompt, submits a dispute that immediately flags the bout fingerprint publicly (small `flagged` badge on the row) and enqueues an admin review item
- Admin queue at `/#admin` (hash-routed, off the visible nav) — paste the `ADMIN_TOKEN` once, see all submissions filterable by `pending` / `applied` / `all`, approve / reject pending items, revert applied items (clears the override and the bout-derived value reappears)
- Vercel Functions backing the edit flow (`frontend/api/`) — `POST /api/edit` (verifies licence hash against bundled `fencers.json`, rate-limits 20/h per hash via `@upstash/ratelimit`, writes to Upstash), `GET /api/overrides` (public, edge-cached 30 s, returns applied name/club overrides + flagged-bout set), `GET/POST /api/admin` (bearer-token gated)
- `frontend/vercel.json` bundles `public/data/fencers.json` into the function image so licence verification works at runtime without an extra HTTP hop
- Visual sort indicators (`↓` arrow + cell bolding) on the Bouts and W·L Leaderboard columns, matching the existing Pool and DE feedback — the underlying sort math already worked but had no clear active-state cue
- `SETUP.md` — Upstash provisioning steps, env var details, edit-kind matrix
### Changed
- `frontend/scripts/copy-data.mjs` now also copies `ingest/fencers.json` into `public/data/` at build time, so the licence registry ships with every Vercel deploy
- `App.jsx` layers Upstash overrides over the bout-derived `fencers` map after `processBouts` runs (name + club overrides) and threads a `flagged_bouts` Set into `FencerProfile` — rating math is unaffected by edits in this release
- Redis env-var detection in `api/_lib.js` accepts both Vercel marketplace defaults (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) and direct Upstash installs (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), so no renaming is needed after the marketplace integration
### Removed
- Fleuron ornament (`❦`) from the App footer and Header tagline, and the `✓` check from the Import success message — purely decorative dingbats that didn't earn their pixels
### Security / privacy
- `Fencerinfo/` (raw XML with full DOBs and licence numbers) added to `.gitignore` — only the derived `fencers.json` (DOB year only, hashed licences) ships to GitHub or Vercel
- `VITE_LICENCE_PEPPER` lives in `.env` / `frontend/.env` (both gitignored); Vite bundles it into the client at build time so login can hash a user-entered licence with the same salt the ingest used. Treat the pepper as obfuscation rather than secrecy — it raises the bar from "trivially rainbow-tabled" to "requires inspecting the JS bundle", which is the right tradeoff for a public site without a backend

## [0.1.8] - 2026-05-15
### Fixed
- Mixed events no longer double-count Elo — when the scraper ingested the same physical event twice (once as "X - Mens" and once as "X - Womens", e.g. Russell Towns Open 2024, mid-year regionals), every bout was being processed twice and gains/losses were doubled; `processBouts` now detects these via `detectMixedEvents` (shared bout hashes between the two variants), rewrites both copies to a single canonical name, and drops duplicate rows by `boutHash` before any rating math runs (44 mixed events detected in the current dataset, ~1300 duplicate rows removed)
- Women appearing in the men's leaderboard (e.g. Mei Admiraal, Madelaine Barbarics) — gender was previously locked to the first row seen, and the "- Mens" duplicate of a mixed event sorted before "- Womens" so women got stuck on M; replaced with a majority-vote tally across single-gender event rows only (mixed-event rows have their gender label cleared so they don't contribute noise), finalized after all bouts are processed
- Mixed-event competitions are now reconstructed under both Mens and Womens filters on the Competitions page (post-dedupe their row-level gender labels were blank; the pipeline now repopulates `comp.genders` from participants' finalized genders)
### Added
- Per-age-category rating streams under `fencer.byWeapon[w].byAge.{cadet,junior,senior,veteran}` — Cadet/U13–U17/Junior/U20/Veteran are parsed from competition names via `parseAgeCategory` (with an `AGE_OVERRIDES` map for manual corrections); the top-level `pool`/`de` rating still reflects every bout
- Downward-inclusive Elo flow — a bout in category X feeds the streams for X and every younger category in the Cadet→Junior→Senior chain (Senior feeds Senior+Junior+Cadet, Junior feeds Junior+Cadet, Cadet feeds itself); Veteran is isolated so vet bouts don't contaminate the open chain and vice versa
- Age-category dropdown in the header next to weapon/gender pills, switching the Leaderboard rating column and bout counts to the selected category's stream; the leaderboard heading reflects the active category
- Leaderboard membership for an age category requires **native** participation — you only appear in the Junior leaderboard if you've fenced a Junior-tagged event, not just because Senior bouts fed your Junior rating via downward inclusion (tracked in `fencer.nativeCategories[weapon]`); cadets are also juniors by age, so cadet-event participation also qualifies a fencer for the Junior leaderboard (rating math is unaffected — cadet bouts still don't feed the Junior stream)
- Recency filter for age leaderboards — to appear under Cadet/Junior/Veteran you must have a native bout in that category in the dataset's most recent year (auto-computed from the latest bout date, currently 2026), keeping aged-out fencers out of the Junior rankings
- `ageCategory` field on each bout record and competition for downstream filtering and display
- `FEEDBACK.md` — running log of user-reported feedback with status (open/addressed/deferred), source, quote, root cause, and resolution; seeded with the post-launch feedback that drove this release
### Removed
- "Senior" option from the age-category dropdown — "All ages" already serves as the open/senior view, and the senior-only stream produced confusing numbers (different from "All ages" because opponent ratings diverge across streams); the underlying `byAge.senior` stream is retained because it still feeds Junior and Cadet via downward inclusion

## [0.1.7] - 2026-05-10
### Added
- Canonical dataset published with the deployment — `frontend/scripts/copy-data.mjs` copies `ingest/*.csv` into `frontend/public/data/` (and writes a `manifest.json`) before every `npm run dev` / `npm run build`; on first load the app fetches the manifest and uses those CSVs as the dataset, so visitors always see the latest pushed data instead of an empty `localStorage`
- `parseCSV` is now exported from `data/pipeline.js` so the load path can reuse it
### Changed
- When the canonical dataset is served, `rawBouts` is no longer persisted to `localStorage` (only `settings` is) — Import-tab additions become session-only on the deployed site, ensuring everyone sees the same canonical data
- Adding new bouts now follows: run the ingest script → commit `ingest/*.csv` → push; Vercel rebuilds and the new dataset is live

## [0.1.6] - 2026-05-10
### Added
- Clubs ledger (new top-level tab) — clubs ranked by DE median across all weapons with the active gender filter; sortable by Members or DE top; clubs with fewer than 5 fencers are demoted to the bottom of DE rankings and tagged "under 5 fencers"
- Club detail page — member count, M/W split, by-weapon DE/pool breakdowns, by-gender × weapon breakdowns, and a member list sorted by best conservative DE rating
- Club-name canonicalization in `data/pipeline.js` (`CLUB_ALIASES` map + `canonicalizeClub` helper) — merges ~25 spelling variants (e.g. "Auckland Swords" / "Auckland Swords Club", "Mt Albert Grammar School" / "Mount Albert Grammar School", "VUW" / "Victoria University of Wellington Swords Club") so each club appears once across the Clubs ledger, Leaderboard club filter, and FencerProfile
- Click-through from club names — Leaderboard rows, FencerProfile header, and CompetitionDetail performance rows now navigate to the club detail page when a club name is clicked
### Changed
- Detail-page Back buttons restore the originating view via a navigation stack — clicking a club from the Leaderboard returns to the Leaderboard, clicking a fencer from a competition returns to that competition, etc.; top-tab clicks clear the stack so tabs remain fresh starts

## [0.1.5] - 2026-05-09
### Fixed
- Competitions tab column headers (Date, Field size, Strength) are now part of an aligned column-header row instead of a floating widget — "Field size" no longer reads as the label for the tier letter column
- Competition list now sorts chronologically when CSVs use `D/M/YYYY` or `M/D/YYYY` instead of ISO — `processBouts` detects the date format from the dataset and normalizes all dates to `YYYY-MM-DD` before sorting or formatting
- Same-day competitions now have a deterministic order (name tiebreaker) instead of reshuffling on each render
- Added column gap between the Top and Strength headers so they no longer visually run together
### Changed
- Leaderboard default sort changed from Pool rating to DE rating
- Competition sort headers are now reversible — click an active header to flip direction (newest↔oldest, strongest↔weakest, largest↔smallest); arrow indicator updates accordingly

## [0.1.4] - 2026-05-09
### Added
- `Conservative display k` setting (default 1) — controls how much rating uncertainty is subtracted from the displayed number
- `conservativeRating` / `fmtConservativeRating` helpers in `utils/formatters.js`
### Changed
- Default initial RD lowered from 350 to 200 — fits an established league where most imported fencers already have years of history; new fencers settle into their true rating faster, at the cost of slightly less headroom for veterans on first import
- Displayed rating is now `rating − k × RD` (TrueSkill-style conservative rating) across the Leaderboard, fencer profile headline numbers, weapon pills, rating-progression chart, and the head-to-head fencer picker — a fencer with `1800 ± 300` shows as 1500 and climbs toward 1800 as their RD shrinks
- Leaderboard pool and DE sorts now order by conservative rating, so a steady 1500 outranks an uncertain 1800
- Peak rating on fencer profiles is now computed as the highest conservative rating over history; raw rating and RD still appear as a secondary line so the underlying Glicko-2 number stays inspectable
### Notes
- Per-bout before/after deltas (FencerProfile bout rows, CompetitionDetail) and competition median/top remain raw — those snapshots don't carry an RD alongside the rating
- Existing users' saved settings persist; click *Defaults* in the Settings panel to pick up the new `initialRD` and `displayK`

## [0.1.3] - 2026-05-04
### Fixed
- Fencers now infer gender from competition name when the gender CSV field is blank, using the same keyword logic as the ingest script ("women" checked before "men")
- Each fencer is locked to the first gender determined — subsequent bouts cannot reassign them to a different category, preventing name-collision cross-contamination

## [0.1.2] - 2026-05-04
### Fixed
- Fencers with no recorded gender no longer appear in both Men's and Women's categories — gender filter now requires an explicit match in Leaderboard, Competitions, and FencerPicker

## [0.1.1] - 2026-04-30
### Added
- Leaderboard with separate pool and DE ratings per fencer per weapon
- Fencer profiles with rating progression chart
- Competition browser with field strength tiers (A–D based on pool median)
- Head-to-head comparison with predicted win probabilities per stream
- CSV import from FENZ Database (file upload or paste) and fictional demo dataset
- Configurable rating parameters (initial rating/RD/volatility, tau, upset threshold and multiplier)
- Python ingest script (`ingest/fenz_ingest.py`) for pulling bout data from the FeNZ public API

## [0.1.0] — 2026-04-29

Initial release.
- Built the prototype of the app using ClaudeCode
-  Made minor design decisions such as elo system and styling.
- Ran into issues pulling the CSV results from Fencingtimelive so looking for a workaround.
