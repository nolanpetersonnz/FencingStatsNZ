# Changelog

## [0.1.0] — 2026-04-29

Initial release.
- Built the prototype of the app using ClaudeCode
-  Made minor design decisions such as elo system and styling.
- Ran into issues pulling the CSV results from Fencingtimelive so looking for a workaround.

## [0.1.1] - 2026-04-30
### Added
- Leaderboard with separate pool and DE ratings per fencer per weapon
- Fencer profiles with rating progression chart
- Competition browser with field strength tiers (A–D based on pool median)
- Head-to-head comparison with predicted win probabilities per stream
- CSV import from FENZ Database (file upload or paste) and fictional demo dataset
- Configurable rating parameters (initial rating/RD/volatility, tau, upset threshold and multiplier)
- Python ingest script (`ingest/fenz_ingest.py`) for pulling bout data from the FeNZ public API
