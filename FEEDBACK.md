# Feedback log

A running log of feedback from users on the deployed site. Newest first.
Status: **open** (not yet addressed), **addressed** (shipped, link to version), **wontfix** (decided against), **deferred** (planned, not now).

---

## Post-launch feedback (after first release)

### Mixed events double-count Elo — **addressed in [0.1.8]**
- Source: multiple — original reporter + Elliot Hayes (foil rankings)
- "Sometimes people are gaining double elo if the event is mixed. Look at Ryan Sadler — 2024 Russell Towns Opens he's getting elo for the men's and the women's category."
- "Yeah I checked my foil rankings cause it was a mixed event and the elo gets double counted. So anytime there's a mixed event elo losses and gains are basically doubled."
- Root cause: the FenZ scraper ingested each mixed event twice (once tagged "- Mens", once "- Womens") with identical bout rows. `pipeline.js` keyed periods by competition name so the two copies sat in separate periods and every bout updated ratings twice.
- Fix: `detectMixedEvents` + `boutHash` in `processBouts` — duplicate rows are deduped before any rating math runs.

### Women appearing in men's leaderboard (e.g. Maddy) — **addressed in [0.1.8]**
- Source: original reporter
- "Maddy is also in the men's rankings"
- Root cause: in mixed events, the same bout appeared with `gender=Mens` and `gender=Womens` labels. Gender was locked to the first row seen; "- Mens" sorted before "- Womens" so women got stuck on M.
- Fix: majority-vote across single-gender event rows only (mixed-event labels are now cleared during dedupe so they contribute no votes).

### Need an age-group filter — **addressed in [0.1.8]**
- Source: original reporter
- "Like you should have a filter at least."
- "Just a filter tho so you only see people in your age group would be enough."
- Fix: age dropdown in the header (Cadet / Junior / Senior / Veteran / All) parsed from competition names.

### Don't let Elo contaminate upward across age groups — **addressed in [0.1.8]**
- Source: original reporter (suggested as optional)
- "You could also change elo system so it only counts your elo against other juniors for the junior rankings but not sure about that"
- Resolution: implemented as downward-inclusive streams — Senior bouts feed Senior+Junior+Cadet; Cadet bouts only feed Cadet; Veteran is isolated.

### Most fencers grouped into Juniors for no reason — **addressed in [0.1.8] (follow-up)**
- Source: original reporter
- "Right now most fencers are being grouped into juniors for no reason. The function is not working as intended."
- Root cause: leaderboard membership was based on `byAge.junior.bouts >= minBouts`, but the Junior stream legitimately receives Senior bouts via downward inclusion — so every adult who'd fenced a senior event appeared in the Junior leaderboard.
- Fix: split **stream contributions** (which streams receive Elo updates) from **native participation** (which leaderboards a fencer appears in). Membership in the Junior leaderboard now requires at least one bout in a Junior-tagged event.

### Aged-out fencers still showing in Junior leaderboard — **addressed in [0.1.8] (follow-up)**
- Source: original reporter
- "Now we have the problem that people are being juniors even though they have aged out. Can we require participation in competition from each fencer in an age group competition as of 2026 to be considered that age group?"
- Fix: leaderboard membership in age categories now requires a native bout in the dataset's most recent year (auto-computed; currently 2026).

### "Why has Elo changed?" — **explained, no code change**
- Source: original reporter
- Resolution: rating values shifted as the intended consequence of the mixed-event dedupe — bouts that were previously double-counted now count once, and mixed-event periods are now a single rating snapshot instead of two sequential ones. Even fencers who never fenced a mixed event see small ripple effects because their opponents' incoming ratings are now correct.

---

## Ideas / nice-to-haves (not formally requested)

- DOB-based age categorization as an alternative or hybrid to event-name parsing. Cleaner membership but doesn't replace event-based Elo math (a 19-year-old fencing a Senior event is still a senior bout). Would only be worth the data-entry effort if FenZ exposes DOBs.
- Per-age-category ratings on FencerProfile / CompetitionDetail / ClubDetail (currently those still show the all-events rating regardless of leaderboard filter).
- Upstream dedupe in `fenz_ingest.py` so the canonical CSV doesn't carry duplicated mixed-event rows.

---

## Template for new entries

```
### <one-line summary> — **<status>**
- Source: <name / channel / date>
- "<quote>"
- Root cause / context: <…>
- Resolution: <… or "deferred / wontfix because …">
```
