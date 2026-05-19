# Feedback log

A running log of feedback from users on the deployed site. Newest first.
Status: **open** (not yet addressed), **addressed** (shipped, link to version), **wontfix** (decided against), **deferred** (planned, not now).

---

## Round 2 — broader review

### Club strength tier formula favours tiny clubs — **open**
- Source: reviewer, 2026-05
- "The club section strength doesn't work quite perhaps the way it should, with the very small clubs being able to get the A and Australia coming out as B, and most of the substantive clubs as C."
- Root cause (hypothesised): aggregate club rating is computed in a way that small clubs with one or two high-rated members rank above larger clubs whose distribution naturally regresses toward the mean. Australian clubs are pulled in because of trans-Tasman events but their member count is small in our dataset.
- Direction: needs a strength metric that rewards depth, not just peaks. Candidate: weighted blend of median + top-N average, with a minimum-member threshold to qualify.
- Status: open — needs design decision before implementation.

### Club section should answer "where should I fence?" — **open**
- Source: reviewer, 2026-05
- "It would also be useful to think about the club section from the perspective of: if I'm a fencer and looking to go fence somewhere, where should I go? That might mean having information about locations and also doing some filtering in terms of which clubs are actually affiliated versus non-affiliated."
- Direction: the current club page is built around "how strong is this club?" The reviewer is pointing out a different question entirely — "should I train here?" — which calls for location, affiliation status, weapons offered, training times, contact info. None of this is in the FeNZ API.
- Status: open — requires data we don't currently have. Probably a manual / community-maintained `clubs.json` overlay.

### Affiliated vs non-affiliated club filtering — **open**
- Source: reviewer, 2026-05
- Related to above. Some clubs in the dataset aren't formally FeNZ-affiliated, which matters for fencers choosing where to compete.
- Status: open — needs an affiliation list from FeNZ.

### "What does it show you're capable of?" — **noted, not actionable**
- Source: reviewer, 2026-05
- "If I'm looking at this from the perspective of what it shows you're capable of, the kind of questions that I would get to would be: Is it deployed and used by people?"
- Not a bug or feature request — strategic feedback about how the project will be evaluated by external audiences (e.g. admissions readers, federations, recruiters). The two questions implied: (1) is it live at a URL, (2) does it have real users?
- Status of (1): deployed at [Vercel URL]. Status of (2): in active beta with NZ fencing community.

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
