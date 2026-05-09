# Changelog

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
