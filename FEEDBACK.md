# Feedback log

A running log of feedback from users on the deployed site. Newest first.
Status: **open** (not yet addressed), **addressed** (shipped, link to version), **wontfix** (decided against), **deferred** (planned, not now).

---

## Round 3 — public beta on FeNZ Facebook + DMs

Posted the beta to the NZ fencing community Facebook group; collected responses across FB comments, DMs, and direct emails. Entries below are grouped by theme rather than by individual reporter, since several themes were raised by multiple people.

### Decay-weighted ratings / age old results — **open, leaning toward implementing**
- Sources: Andy Liu (FB, in extended comment thread), Brendan Lindsay (email follow-up)
- Andy: "exponential decay that strongly weights the most recent 9 months, and the remainder past 18 months will all non-quarterfinal-or-higher national results decaying to a minimum floor outside of this window, and quarterfinal-or-higher also decaying but to a higher floor."
- Andy's proposed split: "80% of the effect of matches coming from matches in the last 9 months, 15% of the effect of matches coming from matches in the last 18 months or historical quarterfinals-or-higher matches, 5% of the effect of matches coming from results older than 18 months."
- Brendan (separate email): "Andy Liu's comments about aging results is something I believe needs to be done... The current rankings are simply too volatile."
- Direction: a decay model on bouts rather than a hard rolling-window cut. Older bouts still inform the rating graph but with diminishing weight. Needs a specific decay curve chosen and tested against historical data.
- Status: open. The strongest design recommendation from Round 3 — two unrelated reviewers independently raised it.

### Older / pre-2018 competition data — **open**
- Source: Nathan McKnight (FB) — "Any plans to add in older comps for anyone who's a little washed up?"
- My initial reply offered two options: (A) let users decide how far back the tracker goes, (B) display all fencer data on profiles but only track certain info for the main ratings.
- Direction: probably (B) — the rating math benefits from limiting to recent data (and the decay model above would supersede a hard cutoff anyway), but historical results on profiles are valuable for context. Pre-2018 data may not exist in the FeNZ public API in usable form, so this is also a data-availability question.
- Status: open, dependent on data availability and decay-model decision.

### Developmental bands / qualitative grades — **noted, deferred**
- Source: Andy Liu (FB, long comment)
- Andy proposed a qualitative classification on top of the numerical rating: Newcomer / Intermediate / Advanced / Champion, based on observable skill markers (e.g. "can't be outfenced 15-0 or 5-0 in poules unless physically injured or impaired" for Intermediate; "carries through from start of day to end of day, makes consistent top 8 at most national competitions" for Champion).
- Useful framing but a different artifact from a rating system — closer to a coaching/development tool. The numerical rating measures performance; the bands would measure skill stage.
- Direction: interesting future work but not v1 scope. Possibly a separate page rather than something baked into ratings.
- Status: deferred.

### Connectivity floor for appearance in main rankings — **addressed in [0.1.13]**
- Source: Sam Webster (email)
- "What are the requirements for showing up in the main ranking page? I've not fenced a huge amount recently but I have a profile with a rating and don't show up in the main list for foil."
- Investigation: the Min Bouts filter wasn't the cause — it defaults to 1, so anyone with a bout in the weapon passes. The real silent exclusion was **undetermined gender**: a fencer who only ever fenced mixed events has no single-gender row to vote on, so they were dropped from both the Men's and Women's leaderboards (33 rated fencers, 11 with foil bouts). (Sam himself has no bouts in the current 2024+ dataset under that name — a separate data-coverage matter.)
- Resolution: gender now falls back to the FNZ registry ranking keys (`foil_W` / `epee_M`) when bout data is inconclusive, recovering 31 of the 33; and the Min Bouts control has a tooltip explaining it and pointing at the weapon/gender filters.
- Status: addressed in [0.1.13]; a "provisional" indicator for very-low-bout fencers remains a possible future refinement.

### Non-FeNZ data ingestion / private competitions — **noted, deferred**
- Source: Sam Webster (email)
- "I literally just did this for our club a couple of weeks ago... I assume the idea is to enter data from FeNZ events. As a possible future option it would be interesting to explore a non-FeNZ entry system... if you had to have a login to register bouts you could track who is entering bouts and see if anyone is trying to game the system. The rating could be split into FeNZ and non-FeNZ rating."
- This is a substantial feature: would require user accounts, authentication, moderation, and a way to handle the trust gap between authoritative FeNZ data and self-reported bouts. The split-rating idea (FeNZ vs non-FeNZ) is a sensible architectural answer to the trust problem.
- Direction: not v1 scope, but a strong v2 direction that would meaningfully expand the system's usefulness for non-competitive club fencing.
- Status: deferred. Worth pursuing if FeNZ collaboration takes a direction that doesn't already cover this.

### Age-category leak (U17s appearing in senior rankings) — **partially addressed in [0.1.12]**
- Source: Casper Howell (FB) — "this seems to include age group and senior tournaments together — so a fencer who has a strong U17 track record but has never fenced seniors is rated quite high. I wonder if there's a way to filter out age group data?"
- My reply: "I've tried to follow the FeNZ logic where U17s and juniors can't count upwards so it's likely a bug."
- Investigation: the Senior rating *stream* is not contaminated — downward inclusion only flows Senior→Junior→Cadet, so U17 bouts never feed a Senior rating, and the Senior leaderboard requires a native Senior bout in the current year. Two real findings: (1) seven "Secondary Schools" events matched no U-band keyword and were misclassified as Senior, feeding the senior chain and able to make a school-only fencer a native Senior; (2) the default "All ages" leaderboard blends every category into one rating — most likely what Casper saw, a U17 specialist's all-events number sitting high among everyone.
- Resolution: (1) fixed — Secondary Schools now classify as Cadet [0.1.12]. (2) the "All ages" blending is working as designed; surfacing the age filter better, or rethinking the default view, is a separate UX item.
- Status: partially addressed in [0.1.12]; the "All ages" UX question remains open.

### Wrong date of birth from sibling licence collisions — **addressed in [0.1.12]**
- Source: Nolan (internal QA), 2026-05-28 — noticed Daniel Gourley classed as born 2005 when he was born 2007.
- Root cause: the licence registry (`fencers.json`) merges records by licence number. A shared or mis-entered licence in the source Fencing Time XML folds a stray name alias of one family member into another's record — Kate Gourley's record carried the alias "daniel gourley". The frontend's `buildEnrichmentIndex` then resolved that key to whichever record had the most signal, and a club-count tiebreaker handed it to the sibling, surfacing her 2005 DOB. A too-old DOB also wrongly drops a fencer from the Junior/Cadet leaderboards.
- Scope: a registry scan found the pattern affects ~6 fencers (Gourley; Craig & Stacy Chong; Milo Henshaw; Luke Boyd; Tim Wang) — bounded, not pervasive.
- Resolution: the lookup now gives a record an ownership bonus for a name_key that matches its own display_name, so the canonically-named fencer always wins their own key over a sibling alias. The underlying licence-keyed merge still mixes aliases; fixing that needs the raw XML and is upstream data quality.
- Status: addressed in [0.1.12].

### Wrong date of birth from a typo'd split record (Chantelle May) — **addressed in [0.1.13]**
- Source: Nolan (internal QA), 2026-05-28 — "Chantelle May is showing in juniors. She is not born in 2018."
- Root cause: distinct from the sibling-alias case above. The registry merges by (loose-name, DOB), so a data-entry typo on one birth year splits a single fencer into two records — Chantelle May as both 2004 and an impossible 2018. The 2018 record (carrying a 2024 national foil ranking — she'd be 6) won the lookup on club count, and a 2018 DOB satisfies both Junior (U20) and Cadet (U17) eligibility, so she surfaced in those leaderboards.
- Resolution: `buildEnrichmentIndex` now demotes any DOB that would make a fencer younger than 8 at the time of an official ranking they hold. Exactly one record in the registry trips this, so genuine namesakes with two plausible years (the 1977 veteran and 1997 senior "James McKenzie") are untouched.
- Status: addressed in [0.1.13].

### Medical withdrawals counted as losses — **addressed in [0.1.12]**
- Source: anonymous DM (with screenshot of bracket showing a fencer marked as having lost via medical withdrawal)
- "I think it's struggling a bit with medical withdrawals. It says he lost as well."
- Root cause: FeNZ tableau data carries a per-fencer result `code` — `V`/`D` for victory/defeat, plus `MED` (medical), `A` (abandon), `DNF`, and `E`/`EXC` (exclusion) for fencers who didn't lose on the strip. The ingest ignored the code, so a withdrawal recorded with points — or one recorded as 0–0 that paired into a tie — flowed into the rating math like a normal result. 16 such bouts were in the dataset, each a 0–0 "tie" that nudged both ratings.
- Resolution: the ingest now reads the code and tags the bout with a `flag` column; `processBouts` records the withdrawal as a loss for the fencer who withdrew and a win for the opponent, but moves neither rating (per Nolan's call — keep the loss visible, zero the Elo). The existing rows were backfilled from the API cache.
- Status: addressed in [0.1.12].

### Ratings too compressed / range too narrow — **open**
- Source: Lockie (via DM relayed by friend) — "the elo is too close together and wonders if there's any way to stretch people out a bit"
- This is a recurring perception across multiple reporters: the top of the leaderboard feels tightly packed and it's hard to distinguish fencers visually.
- Possible causes: (a) the rating spread genuinely is narrow because the NZ population is small and the network is densely connected, so true skill differences cluster more than they would in chess-sized populations; (b) Glicko-2's default parameters are tuned for larger populations and may need recalibration; (c) the display itself could emphasise differences (visual bar charts, percentile rankings) without changing the underlying math.
- Direction: investigate parameter tuning (tau, initial RD); consider adding visual aids that exaggerate perceived differences without distorting the math.
- Status: open.

### Show winner in competition view, not just elo change — **addressed in [0.1.13]**
- Source: friend (DM) — "when clicking on a comp it's annoying only being able to see people's elo gain. You should also be able to see who won. So maybe a little like selection button to change between the two"
- Resolution: the Competition detail Performance table defaults to a "Results" view (toggle to "Elo change"). It shows each fencer's placement — 1, 2, then 3rd tied (two bronzes, no 4th), then place bands 5–8, 9–16, 17–32, … for the deeper rounds, plus a below-the-cut range for pool-only fencers — alongside the W–L record. Official placings aren't in the FeNZ data, so placement is reconstructed from the DE bracket.
- Status: addressed in [0.1.13].

### Expected pool wins (askFRED-style) — **noted**
- Source: friend (DM, on behalf of Joel) — "Joel really wants what ask Fred has in the US which is expected pool wins. So you can compare your pool results with what you're expected to get."
- This would be a meaningful addition: before a competition, predict each fencer's expected wins in their pool based on opponents' ratings, then compare to actual performance. Useful both as a pre-event tool and a post-event diagnostic ("did you outperform or underperform expectation?").
- Direction: doable within the existing rating engine — pool predictions are just pairwise probability calculations across the pool. UI is the harder part.
- Status: noted, not v1 priority but a strong v1.x feature.

### Best matchup / worst matchup widget — **noted**
- Source: friend (DM) — "Maybe low-key have like a best matchup and a worst matchup based of historical results. That could be kinda fun."
- Light feature, fun to have. Not high priority but cheap to add.
- Status: noted.

### Difficulty / strength-of-field metric improvements — **open**
- Sources: Brendan Lindsay (email, NI Champs example), friend's DM suggestion
- Friend: "Potentially using the root mean square instead of the usual averaging would fix that because it would weight high elos more heavily" and "setting difficulty = log2(entries) × average elo so that difficulty also scales with the number of round of DEs"
- Brendan: "How do you attempt to acknowledge that some tournaments are worth more based on the calibre of entrants?" (NI Champs vs lesser tournaments)
- The competition strength tier is currently median pool rating. Both reporters point at variants of the same critique: median doesn't capture depth of strong fencers in the field.
- Direction: experiment with weighted aggregates (root-mean-square is a reasonable candidate; the log2(entries) × average elo formula incorporates field size in a principled way). Worth running both against known-strong tournaments (NZ Nationals, NI Champs) and known-weaker tournaments to see which produces tier rankings that match expert intuition.
- Status: open. Related to the existing club-strength tier issue from Round 2.

### DE tableau line difficulty grading — **noted**
- Source: friend (DM) — "What I really want Nolan is a de tableau with lines getting graded by difficulty. Like ranking which lines are the hardest which are the easiest etc."
- Would require building a tableau-visualisation feature where each "line" (path through the bracket) is colour-coded or scored by aggregate opponent strength.
- Direction: substantial feature, deferred. Interesting because it ties to a real concern Brendan raised about seeding distortions producing perverse pool/bracket pairings.
- Status: noted, deferred.

### Club affiliation tracking — **addressed in [0.1.13]**
- Source: Brendan Lindsay (email)
- "Why do NZ Ranking & these ratings never update the fencer's details (eg correct club name)? Some fencers move club affiliation over time, but the reports (almost) always default to your initial club selection, even if that changes later."
- Root cause: `ensure()` in the pipeline set a fencer's club only on first sight (`!fencers[k].club`), so it stuck to the earliest club seen — exactly the "initial club selection" Brendan describes. (An earlier note here that it took the most-recent affiliation was mistaken.)
- Resolution: the pipeline now overwrites with each non-empty club as it walks bouts in date order, so the displayed club follows the fencer's most-recent bout. Admin/self-edit `club_overrides` still win on top.
- Status: addressed in [0.1.13], small fix.

### Sam McArthur's "rewards only fencing when you feel good mentally" critique — **explained, no code change**
- Source: Sam McArthur (FB comment on initial post)
- "It kinda rewards the 'only fence if you feel good mentally' but aside from that its great."
- My reply explained that Glicko-2's RD absorbs more single-day variation than people perceive, and framed the design as a deliberate trade-off (top-5 lets you drop bad days and rewards peaking; bout-weighted rewards consistency). Followed up that ratings systems measure different things and both can coexist.
- Status: explained. Not actioned because the design difference is intentional — the system optimises for selection-relevant skill estimation rather than for participation friction.

---

## Round 2 — broader review

Source for all Round 2 entries: family member with FeNZ involvement, 2026-05.

### Club strength tier formula favours tiny clubs — **partially addressed in [0.1.10]**
- "The club section strength doesn't work quite perhaps the way it should, with the very small clubs being able to get the A and Australia coming out as B, and most of the substantive clubs as C."
- Root cause (hypothesised): aggregate club rating is computed in a way that small clubs with one or two high-rated members rank above larger clubs whose distribution naturally regresses toward the mean. Australian clubs are pulled in because of trans-Tasman events but their member count is small in our dataset.
- Addressed in [0.1.10]:
  - Clubs page now respects the global weapon pill, so the median is computed against the active weapon rather than a foil+épée+sabre composite. Knocked NZ Academy of Fencing (29 members, 0 épéeists) off the top of the Mens Épée list.
  - Tier letter requires at least 3 members active in the selected weapon. Below-threshold clubs show an em-dash instead of A/B/C. Small clubs with one star can still appear (so members can find them), but they don't carry a misleading letter.
- Still open: "Australia coming B" — Australia still meets the 3-member-in-weapon threshold for Mens Foil/Épée and lands at the top by median. Options if you want them gone: (1) tag Australia (and other non-NZ entries) as non-affiliated via the admin Clubs panel and hide non-affiliated from the leaderboard once enough are tagged; (2) raise the threshold further; (3) restrict the ledger to NZL-nation fencers only.

### Club section should answer "where should I fence?" — **partially addressed in [0.1.10]**
- "It would also be useful to think about the club section from the perspective of: if I'm a fencer and looking to go fence somewhere, where should I go? That might mean having information about locations and also doing some filtering in terms of which clubs are actually affiliated versus non-affiliated."
- Direction: the current club page is built around "how strong is this club?" The reviewer is pointing out a different question entirely — "should I train here?" — which calls for location, affiliation status, weapons offered, training times, contact info. None of this is in the FeNZ API.
- Addressed in [0.1.10]:
  - `/#admin` → Clubs section lets an admin set website, location, and FNZ-affiliation per club. Persisted in Upstash `club_meta`, served via `/api/overrides`.
  - `ClubDetail` renders the location, a clickable website link, and an affiliation badge under the club heading when set.
- Still open: weapons offered, training times, contact info; a UX-led page redesign that surfaces "where to fence" before "how strong"; bulk import of the affiliation list (currently a fencer-by-fencer manual exercise).

### Affiliated vs non-affiliated club filtering — **data layer addressed in [0.1.10]; filter UI still open**
- Related to above. Some clubs in the dataset aren't formally FeNZ-affiliated, which matters for fencers choosing where to compete.
- Addressed in [0.1.10]: affiliation flag now editable in the admin Clubs panel and rendered as a badge on the club detail page. Stored in `club_meta`.
- Still open: a public "hide non-affiliated" toggle on the Clubs page. Cheap to add (~10 lines) once enough clubs are tagged that the filter is useful.

### "What does it show you're capable of?" — **noted, not actionable**
- "If I'm looking at this from the perspective of what it shows you're capable of, the kind of questions that I would get to would be: Is it deployed and used by people?"
- Not a bug or feature request — strategic feedback about how the project will be evaluated by external audiences (e.g. admissions readers, federations, recruiters). The two questions implied: (1) is it live at a URL, (2) does it have real users?
- Status of (1): deployed at https://fencing-stats-nz.vercel.app/. Status of (2): in active beta with NZ fencing community.

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
