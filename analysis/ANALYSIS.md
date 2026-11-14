# Accuracy analysis: results

Written by `analysis/run.mjs`. It holds tables, sample sizes and settings. Each `[NOLAN: ...]` line is a slot for the interpretation, and each `[CHECK n]` is one fact to look at.

## 1. Question

> [NOLAN: what this shows]

## 2. Data and test set

### Bouts

The full dataset is every bout in `ingest/bouts.csv` and `ingest/bouts_portal.csv`: 21,243 rows, 19,328 bouts once mixed events are folded. The test set is every bout from a competition dated 2026-07-20 or later. The full dataset includes the test set.

|  | Full dataset | Full dataset, counted | Test set | Test set, counted |
| --- | ---: | ---: | ---: | ---: |
| All bouts | 19,328 | 19,299 | 1,472 | 1,470 |
| Pool | 14,527 | 14,524 | 1,110 | 1,110 |
| DE | 4,801 | 4,775 | 362 | 360 |
| Epee | 9,975 | 9,957 | 832 | 831 |
| Foil | 6,457 | 6,447 | 430 | 429 |
| Sabre | 2,896 | 2,895 | 210 | 210 |
| Date range | 2024-02-17 to 2026-10-24 |  | 2026-08-15 to 2026-10-24 |  |

"Counted" leaves out the bouts in the next table. A bout's date is its competition's start date.

### Bouts that do not count

| Reason | Full dataset | Test set |
| --- | ---: | ---: |
| Withdrawal or walkover (flag `wd_a`, `wd_b` or `wd`) | 20 | 1 |
| Tie (level scores, no winner marked) | 8 | 0 |
| Win on priority (flag `pri_a` or `pri_b`) | 1 | 1 |
| P-black card | not marked | not marked |

The data has no marker for a P-black card. The results portal, which supplies every test-set bout, shows no exclusion markers. The older data folds exclusions (codes `E` and `EXC`) into the withdrawal flag without saying which card. So no bout could be left out for this reason.

Test-set bouts left out:

| Date | Competition | Weapon | Round | Fencers | Score | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-13 | North Open Championships 2026 - Mens | foil | SF | graham payne v nick ustin | 0-0 | withdrawal, nick ustin won |
| 2026-10-03 | Mid-South Open Championships 2026 - Mens | epee | T16 | alex dong v tom eyre-walker | 13-13 | priority, tom eyre-walker won |

[CHECK 1] The plan says one win on priority is confirmed in the test set. The data flags 1.

### Difference from the site's current method

`predictiveAccuracy` in `pipeline.js` leaves out withdrawals and ties and counts a win on priority as a result. The plan leaves out wins on priority too. So the figures here come from this script's own loop over `winProbability`, not from `predictiveAccuracy`. On the test set:

|  | Bouts | Brier | Accuracy | Expected accuracy |
| --- | ---: | ---: | ---: | ---: |
| All bouts, the plan's rules | 1,470 | 0.1807 | 72.4% | 69.5% |
| All bouts, `predictiveAccuracy` | 1,471 | 0.1806 | 72.5% | 69.5% |
| Established only, the plan's rules | 1,256 | 0.1709 | 74.4% | 70.5% |
| Established only, `predictiveAccuracy` | 1,257 | 0.1708 | 74.4% | 70.5% |

### Name merges and the sanity check

The site rewrites fencer names on the raw bouts before rating them, from merges kept in its live override store. They are not in the repo, so they are recorded in `analysis/merges.json` and applied here the same way:

| Name key | Merged into | On the site | Source |
| --- | --- | --- | --- |
| `tim (mutian) wang` | Tim Wang | yes | The site's override store, read from /api/overrides on the intl-results-prototype preview deployment on 14 Nov 2026. |
| `hoting chan` | Ruby Ho Ting Chan | yes | The site's override store, read from /api/overrides on the intl-results-prototype preview deployment on 14 Nov 2026. |
| `mutian wang` | Tim Wang | no | Nolan, 14 Nov 2026: Mutian Wang is Tim Wang. Decided before any test-set result was computed. Not in the site's override store on that date. |

Sanity check. With the site's own merges, `predictiveAccuracy` on the full dataset scores 19,300 bouts at 68.4%, and the five bands match too. That is what the Method tab of the intl-results-prototype preview deployment (built from commit d981950), both streams, all bouts showed on 14 November 2026: 19,300 bouts at 68.4%. With no merges the same run scores 19,300 bouts at 68.3%.

[CHECK 2] 1 merge is applied here and not on the site (`mutian wang`). Until the site has it, the Method page will not show exactly these figures.

### Competitions in the test set

| Date | Competition | Events | Pool bouts | DE bouts | Counted |
| --- | --- | ---: | ---: | ---: | ---: |
| 2026-08-15 | South Open Championship 2026 | 4 | 103 | 34 | 137 |
| 2026-09-13 | North Open Championships 2026 | 5 | 234 | 72 | 305 |
| 2026-09-19 | Central Open Championship 2026 | 7 | 122 | 38 | 160 |
| 2026-10-03 | Mid-South Open Championships 2026 | 4 | 117 | 32 | 148 |
| 2026-10-17 | Russell Towns Open 2026 | 2 | 90 | 18 | 108 |
| 2026-10-24 | NZL National Senior Championships 2026 | 6 | 374 | 139 | 513 |
| 2026-10-24 | NZL National Veteran Championships 2026 | 3 | 70 | 29 | 99 |

An event is one weapon in one men's, women's or mixed competition, as the site lists it.

### Competitions with no usable seeding

The seeding is each event's "Seeding for Round 1" on FencingTimeLive, entered in `analysis/seeds.csv`. A fencer is ranked when that page shows a Rank for them. An event's seeding is usable when at least one of its fencers shows a Rank.

| Seeding | Events | Counted bouts | Bouts with both fencers ranked |
| --- | ---: | ---: | ---: |
| Usable | 6 | 359 | 208 |
| FencingTimeLive shows no Rank for any fencer | 16 | 499 | 0 |
| Not entered yet | 9 | 612 | 0 |

By event:

| Competition | Weapon | Entrants | On FencingTimeLive | Seeded | With a Rank | Counted bouts | Both ranked | Seeding |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Central Open Championship 2026 - Mens | epee | 13 | 13 | 13 | 0 | 48 | 0 | no Rank shown |
| Central Open Championship 2026 - Mens | foil | 3 |  | 3 | 0 | 2 | 0 | no Rank shown |
| Central Open Championship 2026 - Mens | sabre | 8 | 8 | 8 | 0 | 35 | 0 | no Rank shown |
| Central Open Championship 2026 - Womens | epee | 10 | 10 | 10 | 0 | 29 | 0 | no Rank shown |
| Central Open Championship 2026 - Womens | foil | 2 |  | 2 | 0 | 1 | 0 | no Rank shown |
| Central Open Championship 2026 - Womens | sabre | 8 | 8 | 8 | 0 | 35 | 0 | no Rank shown |
| Central Open Championship 2026 Mixed | foil | 5 | 5 | 5 | 0 | 10 | 0 | no Rank shown |
| Mid-South Open Championships 2026 - Mens | epee | 14 | 14 | 14 | 0 | 54 | 0 | no Rank shown |
| Mid-South Open Championships 2026 - Womens | epee | 6 | 6 | 6 | 0 | 20 | 0 | no Rank shown |
| Mid-South Open Championships 2026 | foil | 10 | 10 | 10 | 0 | 54 | 0 | no Rank shown |
| Mid-South Open Championships 2026 | sabre | 6 | 6 | 6 | 0 | 20 | 0 | no Rank shown |
| NZL National Senior Championships 2026 - Mens | epee | 50 |  | 0 | 0 | 181 | 0 | not entered |
| NZL National Senior Championships 2026 - Mens | foil | 29 |  | 0 | 0 | 98 | 0 | not entered |
| NZL National Senior Championships 2026 - Mens | sabre | 9 |  | 0 | 0 | 44 | 0 | not entered |
| NZL National Senior Championships 2026 - Womens | epee | 37 |  | 0 | 0 | 132 | 0 | not entered |
| NZL National Senior Championships 2026 - Womens | foil | 15 |  | 0 | 0 | 44 | 0 | not entered |
| NZL National Senior Championships 2026 - Womens | sabre | 5 |  | 0 | 0 | 14 | 0 | not entered |
| NZL National Veteran Championships 2026 - Mens | epee | 15 |  | 0 | 0 | 44 | 0 | not entered |
| NZL National Veteran Championships 2026 - Womens | epee | 6 |  | 0 | 0 | 20 | 0 | not entered |
| NZL National Veteran Championships 2026 | foil | 11 |  | 0 | 0 | 35 | 0 | not entered |
| North Open Championships 2026 - Mens | epee | 35 | 35 | 35 | 23 | 139 | 63 | usable |
| North Open Championships 2026 - Mens | foil | 14 | 15 | 14 | 9 | 55 | 21 | usable |
| North Open Championships 2026 - Womens | epee | 12 | 12 | 12 | 11 | 41 | 35 | usable |
| North Open Championships 2026 - Womens | foil | 8 | 8 | 8 | 7 | 35 | 27 | usable |
| North Open Championships 2026 | sabre | 8 | 9 | 8 | 7 | 35 | 27 | usable |
| Russell Towns Open 2026 | epee | 10 | 10 | 10 | 8 | 54 | 35 | usable |
| Russell Towns Open 2026 | foil | 10 | 10 | 10 | 0 | 54 | 0 | no Rank shown |
| South Open Championship 2026 - Mens | foil | 7 | 7 | 7 | 0 | 27 | 0 | no Rank shown |
| South Open Championship 2026 - Womens | foil | 5 | 5 | 5 | 0 | 14 | 0 | no Rank shown |
| South Open Championship 2026 | epee | 19 | 19 | 19 | 0 | 69 | 0 | no Rank shown |
| South Open Championship 2026 | sabre | 7 | 7 | 7 | 0 | 27 | 0 | no Rank shown |

"Entrants" are the fencers the results portal lists for the event. "On FencingTimeLive" is the number of names on its seeding page; a name that is not among the entrants is left out. The two Central Open foil DE events ran no pools, so their fencers take their seeds from the mixed foil pool.

[CHECK 3] FencingTimeLive shows no Rank for any fencer in 16 of 31 test-set events (499 counted bouts). Their seed numbers are entered and their bouts are left out of section 6 as unranked.

[CHECK 4] Names on FencingTimeLive's seeding that are not among the portal's entrants, and so are left out: 2 (North Open Championships 2026 - Mens, foil; North Open Championships 2026, sabre). They are named in `analysis/seeds_report.txt`.

[CHECK 5] In 2 events two fencers show the same Rank (North Open Championships 2026 - Mens, epee: Rank 35; North Open Championships 2026, sabre: Rank 3). Their seed numbers differ, and section 6 compares seed numbers.

### Settings used

| Setting | Value |
| --- | --- |
| `initialRating` | 1500 |
| `initialRD` | 200 |
| `initialVolatility` | 0.06 |
| `tau` | 0.5 |
| `upsetThreshold` | 75 |
| `upsetMultiplier` | 1.25 |
| `displayK` | 1 |
| `inactivityDecayC` | 0 |
| Test set | competitions dated 2026-07-20 or later |
| Rating used | each fencer's rating and RD in the bout's stream (pool or DE), all age categories together, as they stood before the competition |
| Established bout | both fencers' RD below `initialRD` (200) before the competition |
| Smallest group reported | 100 bouts; a smaller group is merged with its neighbour |

The settings are `DEFAULT_SETTINGS` in `frontend/src/constants.js`, with the upset threshold and multiplier as set there.

### Rating code since the test set began

The last commit before 2026-07-20 is 0cdfed4, 2026-07-10. Since then, `DEFAULT_SETTINGS` is unchanged and `frontend/src/engine/glicko2.js` is unchanged.

Commits since then that touch the settings file, the engine or the pipeline:

| Commit | Date | File | What changed |
| --- | --- | --- | --- |
| `13f1c73` | 2026-11-06 | `constants.js` | Turns the header's data feed note off. No change to the settings. |
| `2d5dc0a` | 2026-11-03 | `constants.js` | Adds the header's data feed note below `DEFAULT_SETTINGS`. No change to the settings. |
| `218aa0f` | 2026-11-09 | `pipeline.js` | A win on priority (flag `pri_a` or `pri_b`) is rated as a win. Before, a bout with level scores was rated as a draw. One bout in the dataset carries the flag. |
| `f70b6b8` | 2026-11-03 | `pipeline.js` | Adds expected accuracy to `predictiveAccuracy`. No change to ratings. |

[CHECK 6] `pipeline.js` changed how one kind of bout is rated after the test set began (commit `218aa0f`, 2026-11-09): a win on priority is rated as a win, not a draw. Bouts in the dataset that carry the flag: 1, of which 1 in the test set.

### Commits

| What | Commit |
| --- | --- |
| Analysis code, this run | `d32b7e7956fff8fa1a2a77195bf633e82c5c308b` |
| Rating code (`constants.js`, `glicko2.js`, `pipeline.js`) | `218aa0faa0daa6854309854f91ad842e219710e6` |
| Data (`ingest/bouts.csv`, `ingest/bouts_portal.csv`) | `7c7e6f7921b17f59841fc58476c965a4d7253dcb` |
| `PREREGISTRATION.md` | `d981950768df40454d2c06be0c7cb70a6a7adacd` |

## 3. Plan

[PREREGISTRATION.md](https://github.com/nolanpetersonnz/FencingStatsNZ/blob/d981950768df40454d2c06be0c7cb70a6a7adacd/PREREGISTRATION.md) at commit `d981950768df40454d2c06be0c7cb70a6a7adacd`.

## 4. Headline

A coin flip scores a Brier of 0.2500 and an accuracy of 50.0%. Expected accuracy is how often the favourite would win if every predicted chance were exactly right.

|  | Bouts | Brier | Accuracy | Expected accuracy |
| --- | ---: | ---: | ---: | ---: |
| Test set, all bouts | 1,470 | 0.1807 | 72.4% | 69.5% |
| Full dataset, the plan's rules, all bouts | 19,299 | 0.1986 | 68.4% | 66.8% |
| Full dataset, as the Method page shows it now, all bouts | 19,300 | 0.1987 | 68.4% | 66.7% |
| Test set, established only | 1,256 | 0.1709 | 74.4% | 70.5% |
| Full dataset, the plan's rules, established only | 13,504 | 0.1792 | 73.4% | 69.5% |
| Full dataset, as the Method page shows it now, established only | 13,495 | 0.1793 | 73.3% | 69.5% |

The full dataset includes the test set. "As the Method page shows it now" is `predictiveAccuracy` with the site's own merges.

[CHECK 7] Test-set Brier is 0.1807 and full-dataset Brier (the plan's rules) is 0.1986: a difference of 0.0179.

[CHECK 8] 10 counted test-set bouts have a predicted chance of exactly 50% (equal ratings). The favourite is then taken as fencer A, as `predictiveAccuracy` does.

> [NOLAN: what this shows]

## 5. Calibration

Test set only. Each bout is counted for its favourite, the fencer with the higher predicted chance. Predicted is the mean predicted chance in the band; observed is how often the favourite won.

**All bouts**

| Confidence band | Bouts | Predicted | Observed |
| --- | ---: | ---: | ---: |
| 50% to 60% | 409 | 54.7% | 56.2% |
| 60% to 70% | 404 | 64.6% | 67.6% |
| 70% to 80% | 322 | 74.8% | 76.7% |
| 80% to 90% | 207 | 85.0% | 92.3% |
| 90% to 100% | 128 | 93.3% | 96.9% |

**Established only**

| Confidence band | Bouts | Predicted | Observed |
| --- | ---: | ---: | ---: |
| 50% to 60% | 318 | 55.0% | 56.6% |
| 60% to 70% | 338 | 64.7% | 67.5% |
| 70% to 80% | 285 | 74.9% | 79.6% |
| 80% to 90% | 188 | 85.0% | 93.6% |
| 90% to 100% | 127 | 93.3% | 96.9% |

No group had fewer than 100 bouts.

![Calibration: observed win rate of the favourite against the predicted rate, by confidence band, for all bouts and for established bouts only](results/calibration.svg)

> [NOLAN: what this shows]

## 6. FeNZ ranking vs FencingStatsNZ rating

Not run yet. The seeding of 9 of 31 test-set events (612 counted bouts) has not been entered, and the comparison is held back until every event is in. Section 2 lists what has been entered.

> [NOLAN: what this shows]

## 7. Linearity

Test set only. Each bout is counted for its higher-rated fencer, or for fencer A where the two ratings are equal. Predicted is that fencer's mean predicted chance in the group; observed is how often they won. A band includes its lower bound.

### By rating gap

The gap is the difference between the two fencers' ratings before the competition.

**All bouts**

| Rating gap | Bouts | Predicted | Observed |
| --- | ---: | ---: | ---: |
| 0 to 50 | 284 | 53.1% | 53.5% |
| 50 to 100 | 264 | 60.1% | 61.4% |
| 100 to 200 | 407 | 68.2% | 73.0% |
| 200 to 300 | 244 | 78.2% | 80.3% |
| 300 and over | 271 | 89.7% | 95.2% |

**Established only**

| Rating gap | Bouts | Predicted | Observed |
| --- | ---: | ---: | ---: |
| 0 to 50 | 221 | 53.4% | 52.9% |
| 50 to 100 | 218 | 60.3% | 61.5% |
| 100 to 200 | 351 | 68.6% | 74.6% |
| 200 to 300 | 215 | 78.6% | 83.3% |
| 300 and over | 251 | 90.0% | 96.4% |

No group had fewer than 100 bouts.

![Predicted and observed win rate of the higher-rated fencer by rating gap band, for all bouts and for established bouts only](results/rating_gap.svg)

### By rating level

The level is the mean of the two fencers' ratings before the competition.

**All bouts**

| Rating level | Bouts | Predicted | Observed |
| --- | ---: | ---: | ---: |
| below 1500 | 636 | 70.2% | 68.7% |
| 1500 and over | 834 | 68.9% | 75.3% |

**Established only**

| Rating level | Bouts | Predicted | Observed |
| --- | ---: | ---: | ---: |
| below 1500 | 545 | 71.4% | 75.0% |
| 1500 and over | 711 | 69.8% | 73.8% |

Groups under 100 bouts, merged:

- All bouts: 1700 and over (80 bouts) merged with 1500 to 1700 (754 bouts).
- Established only: 1700 and over (76 bouts) merged with 1500 to 1700 (635 bouts).

[CHECK 9] The plan names three rating levels. After merging there are 2 (all bouts) and 2 (established only): all bouts, 1700 and over (80 bouts) merged with 1500 to 1700 (754 bouts); established only, 1700 and over (76 bouts) merged with 1500 to 1700 (635 bouts). The gap-within-level table uses the merged levels.

### By rating gap within each rating level

**All bouts**

| Rating level | Rating gap | Bouts | Predicted | Observed |
| --- | --- | ---: | ---: | ---: |
| below 1500 | 0 to 100 | 224 | 56.8% | 49.1% |
| below 1500 | 100 to 200 | 171 | 68.1% | 70.8% |
| below 1500 | 200 and over | 241 | 84.2% | 85.5% |
| 1500 and over | 0 to 100 | 324 | 56.3% | 63.0% |
| 1500 and over | 100 to 200 | 236 | 68.3% | 74.6% |
| 1500 and over | 200 and over | 274 | 84.3% | 90.5% |

**Established only**

| Rating level | Rating gap | Bouts | Predicted | Observed |
| --- | --- | ---: | ---: | ---: |
| below 1500 | 0 to 100 | 174 | 57.0% | 54.0% |
| below 1500 | 100 to 200 | 150 | 68.4% | 76.7% |
| below 1500 | 200 and over | 221 | 84.7% | 90.5% |
| 1500 and over | 0 to 100 | 265 | 56.7% | 59.2% |
| 1500 and over | 100 to 200 | 201 | 68.8% | 73.1% |
| 1500 and over | 200 and over | 245 | 84.8% | 90.2% |

No group had fewer than 100 bouts.

> [NOLAN: what this shows]

## 8. Splits

Test set only.

### Pool vs DE

|  | Stream | Bouts | Brier | Accuracy | Expected accuracy |
| --- | --- | ---: | ---: | ---: | ---: |
| All bouts | Pool | 1,110 | 0.1796 | 72.4% | 70.2% |
| All bouts | DE | 360 | 0.1841 | 72.5% | 67.2% |
| Established only | Pool | 936 | 0.1676 | 74.9% | 71.3% |
| Established only | DE | 320 | 0.1804 | 72.8% | 68.1% |

No group had fewer than 100 bouts.

### By weapon

|  | Weapon | Bouts | Brier | Accuracy | Expected accuracy |
| --- | --- | ---: | ---: | ---: | ---: |
| All bouts | Epee | 831 | 0.1866 | 72.0% | 69.0% |
| All bouts | Foil | 429 | 0.1632 | 75.1% | 71.0% |
| All bouts | Sabre | 210 | 0.1932 | 69.0% | 68.2% |
| Established only | Epee | 728 | 0.1797 | 73.2% | 69.8% |
| Established only | Foil | 380 | 0.1537 | 76.8% | 72.0% |
| Established only | Sabre | 148 | 0.1713 | 73.6% | 70.1% |

No group had fewer than 100 bouts.

> [NOLAN: what this shows]

## 9. All vs established

Test set only. An established bout is one where both fencers' RD was below 200 before the competition.

|  | Bouts | Brier | Accuracy | Expected accuracy |
| --- | ---: | ---: | ---: | ---: |
| All bouts | 1,470 | 0.1807 | 72.4% | 69.5% |
| Established only | 1,256 | 0.1709 | 74.4% | 70.5% |

> [NOLAN: what this shows]

## 10. Method page figures

The held-out figures for each filter on the Method page: test set only, the plan's rules.

| Stream | Filter | Bouts scored | Accuracy | Expected accuracy | Brier |
| --- | --- | ---: | ---: | ---: | ---: |
| Both streams | All bouts | 1,470 | 72.4% | 69.5% | 0.1807 |
| Both streams | Established only | 1,256 | 74.4% | 70.5% | 0.1709 |
| Pool | All bouts | 1,110 | 72.4% | 70.2% | 0.1796 |
| Pool | Established only | 936 | 74.9% | 71.3% | 0.1676 |
| DE | All bouts | 360 | 72.5% | 67.2% | 0.1841 |
| DE | Established only | 320 | 72.8% | 68.1% | 0.1804 |

Confidence bands for each filter:

| Stream | Filter | Confidence band | Bouts | Predicted | Observed |
| --- | --- | --- | ---: | ---: | ---: |
| Both streams | All bouts | 50% to 60% | 409 | 54.7% | 56.2% |
| Both streams | All bouts | 60% to 70% | 404 | 64.6% | 67.6% |
| Both streams | All bouts | 70% to 80% | 322 | 74.8% | 76.7% |
| Both streams | All bouts | 80% to 90% | 207 | 85.0% | 92.3% |
| Both streams | All bouts | 90% to 100% | 128 | 93.3% | 96.9% |
| Both streams | Established only | 50% to 60% | 318 | 55.0% | 56.6% |
| Both streams | Established only | 60% to 70% | 338 | 64.7% | 67.5% |
| Both streams | Established only | 70% to 80% | 285 | 74.9% | 79.6% |
| Both streams | Established only | 80% to 90% | 188 | 85.0% | 93.6% |
| Both streams | Established only | 90% to 100% | 127 | 93.3% | 96.9% |
| Pool | All bouts | 50% to 60% | 304 | 54.6% | 57.6% |
| Pool | All bouts | 60% to 70% | 280 | 64.6% | 63.6% |
| Pool | All bouts | 70% to 80% | 237 | 74.7% | 76.4% |
| Pool | All bouts | 80% to 90% | 178 | 85.2% | 91.6% |
| Pool | All bouts | 90% to 100% | 111 | 93.4% | 96.4% |
| Pool | Established only | 50% to 60% | 235 | 54.9% | 58.7% |
| Pool | Established only | 60% to 70% | 226 | 64.7% | 63.3% |
| Pool | Established only | 70% to 80% | 205 | 74.8% | 80.5% |
| Pool | Established only | 80% to 90% | 160 | 85.1% | 93.1% |
| Pool | Established only | 90% to 100% | 110 | 93.4% | 96.4% |
| DE | All bouts | 50% to 60% | 105 | 55.1% | 52.4% |
| DE | All bouts | 60% to 70% | 124 | 64.6% | 76.6% |
| DE | All bouts | 70% to 100% | 131 | 79.4% | 84.7% |
| DE | Established only | 50% to 70% | 195 | 60.7% | 65.1% |
| DE | Established only | 70% to 100% | 125 | 79.6% | 84.8% |

[CHECK 10] The Method page shows five bands for every filter. Here bands with fewer than 100 test-set bouts are merged with a neighbour, which leaves fewer than five for: DE, all bouts; DE, established only. The merges are listed in `results/merge_log.csv`.

## 11. Limitations

- International bouts are missing. The old ingest left out competitions the FeNZ API tags `aus`, `int` or `fie` (the default of `ingest/fenz_ingest.py`). NZ fencers' results overseas are in `ingest/intl_results.json` as 304 placings at 26 competitions, with no bouts.
- All bouts: 497 of 1,470 counted test-set bouts (33.8%) involve a fencer with fewer than 10 prior bouts. 214 involve a fencer with none.
- Established only: 283 of 1,256 counted test-set bouts (22.5%) involve a fencer with fewer than 10 prior bouts. 0 involve a fencer with none.

Prior bouts are a fencer's rated bouts in the same weapon and the same stream (pool or DE) at earlier competitions in the dataset.

> [NOLAN: what this shows]

## 12. Deviations

### What could not be done as the plan says

1. **Where the FeNZ ranking comes from.** The plan takes it from each competition's initial seeding on the FeNZ results portal. The portal shows no seeding. Checked on 14 November 2026: an event's Results view lists final rank, name, club and nationality; Pools and Bracket list names and scores; `/rankings` is one current board dated 2026-10-25, after the test-set competitions. The closest source is each event's "Seeding for Round 1" page on FencingTimeLive. Nolan took a screenshot of each; they were transcribed into `analysis/seeds_ftl.csv`, and `analysis/enter_seeds.mjs` matched each name to an entrant on the sheet from `analysis/fetch_seeds.py` (`analysis/seeds_template.csv`) and wrote `analysis/seeds.csv`. No seeds were fetched by a script. **9 events are not entered yet, so section 6 is empty.**
2. **Unranked fencers.** The portal does not mark them. A fencer counts as ranked when the FencingTimeLive seeding page shows a Rank for them, and as unranked when it shows none (the `ranked` and `rank` columns of the sheet). In 16 events it shows no Rank for anyone, so every bout of those events is left out as unranked.
3. **Events with no pools.** The Central Open foil ran one mixed pool, then a men's and a women's DE. The three DE bouts use the mixed pool's seeding.
4. **P-black cards.** The plan leaves them out. The data does not mark them (section 2), so none could be left out.
5. **Loading the data.** The run instructions were to load every CSV in `ingest/` through the site's parse and dedupe steps. That alone does not reproduce the Method tab (68.3% against 68.4%), because the site also applies name merges from its override store. The run applies the site's merges, which reproduces the tab exactly (section 2).
6. **One more merge.** Nolan confirmed on 14 November 2026 that Mutian Wang is Tim Wang, before any test-set result was computed. The merge is applied here and is not on the site. Mutian Wang fenced one test-set event.

### Details the plan leaves open, fixed before any test-set result was computed

- **Calibration bands.** The site's five, on the favourite's predicted chance: 50% to 60%, up to 90% to 100%.
- **Band edges.** A band includes its lower bound: a gap of exactly 50 is in 50 to 100, a level of exactly 1500 is in 1500 to 1700.
- **Equal ratings.** The predicted chance is exactly 50% and the favourite is taken as fencer A, as the site does.
- **Merging a group under 100 bouts.** The smallest such group joins its neighbouring band; where it has two, the one with fewer bouts. This repeats until every group has 100 bouts. Pool, DE and the weapons have no neighbour, so the smallest joins the next-smallest.
- **Gap within level.** The level bands are the ones left after merging in the level table.
- **Full dataset.** Shown under the plan's rules and as the Method page shows it now.
- **Prior bouts.** Rated bouts in the same weapon and stream at earlier competitions.
- **Disagreement bouts.** Equal ratings are not a disagreement. Equal seeds are left out.

Every merge of a group under 100 bouts is listed under its table and in `results/merge_log.csv` (7 in all).

## 13. How to reproduce

From the repo root, with Node 20 or later and no packages to install:

```
node --test analysis/metrics.test.mjs    # the metric functions, on hand-made cases
node analysis/run.mjs                    # writes analysis/ANALYSIS.md and analysis/results/
```

The entrant sheet comes from the results portal pages already in `ingest/cache/portal/` (not in the repo). It needs Python 3 with `rapidfuzz` and `requests`, as the portal ingest does:

```
python analysis/fetch_seeds.py           # writes analysis/seeds_template.csv; sends no requests
```

## 14. How AI was used

> [NOLAN: what this shows]
