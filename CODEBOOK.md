# Can fencers read their own ratings? Codebook and coding procedure

Version 1.4, 2026-10-30 (1.0 frozen 2026-09-23 and registered). Companion to the study protocol (section 7, Measures). Every change after registration is a dated entry in the changelog at the bottom and is reported as a deviation in Part 2.

## 0. Scope

- Applies to main-sample sessions P1 onward. The pilot (P0, 2026-09-23) was coded with this codebook only to test it; P0 scores and observations do not enter Part 2.
- Sources per session: the screen and audio recording, and the transcript. Task outcomes and navigation events are coded from the recording. Comprehension and observations are coded from the transcript, checked against the recording where the transcript is ambiguous.
- First coder: the moderator (also the developer). Second coder: section 8.
- Coding workflow (added 1.1): first-pass codes are drafted with an AI assistant from the automated transcript; the moderator verifies every row against the recording, answers the assistant's clarification questions, and records the verification status per participant in the Participants sheet ("Moderator check" column). The second coder sees neither the draft nor the moderator's codes.
- Participants not in the dataset (newcomer slot, added 1.1): T1 to T4 are run on a stand-in profile and T6 on the moderator's test account. Items that refer to "your" numbers or day are scored as read about the stand-in; debrief Q4 (own numbers) does not apply. P01's stand-in was chosen on the call and is logged as a deviation; for any later newcomer the stand-in is chosen before the session and written on the run sheet. The test account is reset between sessions.

## 1. Units

- Session record: one per participant (Participants sheet).
- Task episode: from the moderator reading the task prompt to the participant's ease answer (SEQ). Up to eight per session (T8 optional).
- Observation: one codeable event, an utterance or an on-screen action, that shows a misreading, an absent concept, a navigation failure, confusion, a workaround, an expectation mismatch, a trust statement, a feature request, a data doubt, a moderator deviation, or something working as designed. One row per code, timestamped, with the verbatim quote where spoken.
- Issue: a consolidated usability problem, built from observations after all sessions (section 6).

## 2. Task outcome (one row per task episode)

Fields: participant, task, start, end, duration, hint (N / H1 / H2), success (Full / Partial / Fail), deciding criterion, SEQ (1 to 7), condition notes.

Rules:
- Success is scored against the protocol's section 6 criteria as written. Write the clause that decided it in "deciding criterion". If a session does not fit any clause, say why in that field; do not invent a category.
- Any hint caps success at Partial, on every task, not only T6. Log which hint.
- SEQ not asked = blank. Never imputed.
- T2: "grounded in the page" means the participant points at any page element as the basis for the training decision. Record the element used (pool/DE split, matchups, field overview, other) in condition notes. RQ2 is answered from that field, not from the success score. The pilot showed the matchups table doing the job the split was built for, so the two must be separable.
- T3: record the bracket used and whether the age filter was touched. Only junior and veteran brackets produce evidence for RQ3; a senior-bracket run is scored for success but not counted for or against RQ3.
- T6: record sign-in state at task start. If the participant was already signed in, sign-in discoverability is untested for that participant; success covers the dispute path only and the notes say so.
- T7: record before-number, after-number, the participant's reasoning, and the Q1 and Q2 answers. Pointing the participant to the accuracy tab is H1.

## 3. Comprehension items (0 = wrong, 1 = partial, 2 = solid)

Score the participant's best complete statement made without moderator explanation. Self-correction while reading the page counts. Correction after a moderator hint or explanation does not.

Operational evidence (added 1.1): where no statement about an item was elicited, a clear on-screen use of the concept scores 1 if correct and 0 if incorrect (for example, picking the hardest line from the lowest sweep odds scores C2 = 1; picking it from the highest scores 0). A statement, when present, takes precedence over use. An item with neither statement nor use stays blank, and the total is blank for that participant. The rule is symmetric and applies to every participant including those coded before 2026-10-01.

C1, rating range (from T1). Gold: the headline number is the low end of the uncertainty range; raw is the centre; the range narrows as bouts accumulate and widens with inactivity.
- 2: low end, plus at least one of the two dynamics.
- 1: knows there is a range but treats the headline as the exact rating, or knows a dynamic but not that the headline is the low end.
- 0: no range concept.

C2, line average and sweep odds (from T4). Gold (site FAQ, README and CHANGELOG since 2026-06-05; corrected in 1.4): both figures span a fencer's whole path to the title, the opponents they fenced plus those they would have met in later rounds had they kept winning. Line average is the mean opponent rating along that path. Sweep odds is the chance, from the ratings before each bout, of beating every opponent on that path and so taking the title; lower means harder.
- 2: both, including that lower sweep odds means a harder line.
- 1: one of the two, or "harder opponents" with no mechanism, or sweep odds as winning every bout or winning the event without the link to the line or the ratings.
- 0: reads line average as the fencer's own rating, or sweep odds as bouts won.

C3, win prediction (from T5). Gold: the per-stream percentages are a prediction from the two ratings, not a guarantee or a record.
- 2: reads both streams correctly as ratings-based predictions and can say what would move them.
- 1: reads the numbers but treats them as fact, or cannot say where they come from.
- 0: misreads them (as past win rate, as a score, or the wrong way round).

Total = C1 + C2 + C3, range 0 to 6. T7 Q1 and Q2 (accuracy panel readings) are scored 0 to 2 on the gold set in the run sheet and reported separately, not added to the total.

## 4. Rating-interpretation codes (RQ1)

Applied to three statements per participant: intro Q5 (before the site is open), the unprompted T1 explanation, and debrief Q1. More than one code per statement is allowed.

- INT-ELO: generic Elo or points account ("goes up when you win, down when you lose").
- INT-EXACT: treats the headline number as the exact skill level.
- INT-LOWEND: the headline is the low end of a range, a conservative figure.
- INT-RANGE: mentions uncertainty or a range without saying the headline is its low end.
- INT-DATA: the number rises with more data, not only with wins; or the range narrows with bouts.
- INT-COMPARE: frames the rating as standing relative to other fencers or to the FeNZ ranking.
- INT-OTHER: none of the above; quote it.

Report the three codes side by side per participant. The Q5 to debrief pair is the before/after on the session.

## 5. Observation codes

One row per code. Code what was said or done, not what you infer they think. A single utterance can carry two codes (two rows). POS is coded with the same effort as problems; it is the disconfirming evidence the protocol promises.

| Family | Codes | Definition | RQ |
|---|---|---|---|
| MIS (misreading) | MIS-RANGE, MIS-LOWEND, MIS-SPLIT, MIS-AGE, MIS-LINE, MIS-SWEEP, MIS-PROB, MIS-CLUB, MIS-OTHER | Participant states a wrong reading of a number, term, or list. MIS-AGE: takes the All-ages ladder as the age-category list. MIS-CLUB: reads club strength as something it is not. | 1, 2, 3, 4, 5, 6 |
| ABS (absent concept) | ABS-LOWEND, ABS-RANGE, ABS-SPLIT | A concept the design relies on is missing from the participant's unprompted account, even if they get it right when probed. Not an error; an omission. | 1, 2 |
| NAV | NAV-CANTFIND, NAV-WRONG, NAV-HINT | Cannot locate a feature; goes to the wrong page or control; a hint is given (log the hint). | all |
| CONF | CONF | Expressed uncertainty ("not sure what each dot is"). Note whether it self-resolved. | all |
| WORK | WORK | A workaround for something the page does not offer directly. | all |
| EXP | EXP | Expectation mismatch or surprise about content or layout. | all |
| TRUST | TRUST-UP, TRUST-DOWN | A statement that raises or lowers trust in a number. Tag the reason: DATA-VOLUME, PERSONAL-KNOWLEDGE, SAMPLE-SIZE, INACTIVITY, CALIBRATION, OTHER. | 5 |
| REQ | REQ | Feature request or wish. | all |
| DATA | DATA | Doubt about data correctness (a wrong result, a missing field). Logged to the normal data-error flow; not a usability issue. | none |
| POS | POS | Works as designed, or clearly understood. | all |
| MOD | MOD-LEAD, MOD-EXPLAIN, MOD-HINT-OFFRULE | Moderator deviation: a leading probe; explaining a feature during a task; a hint outside the 90-second rule. Reported in the limitations, not as findings. | none |
| NOTE | NOTE | A substantive statement that fits no family and is worth keeping for synthesis. | any |

Fields per observation: obs_id, participant, task, mm:ss, page or component, code, reason tag (TRUST only), RQ, evidence (Said / Did), quote, note, issue_id (filled in section 6).

## 6. Issue consolidation and severity

After the last session, group observations from MIS, ABS, NAV, CONF, WORK, EXP and REQ into issues. Two observations belong to the same issue when they sit on the same page or component and share an underlying cause. Record every merge. DATA and MOD rows never become issues.

Fields: issue_id, title, location, RQ, cause, participants, n, impact, severity, evidence (obs_ids), v1.1 action.

Amended 1.3: the single "impact" field is replaced by three, "n at impact A", "n at impact B" and "highest impact", because the severity rule below counts participants per impact level and one letter per issue cannot carry that. Impact is assigned per participant per issue from that participant's task outcome and observation rows; severity is a formula over the two counts. The rule itself is unchanged.

Impact, one letter per participant:
- A: the participant reached a wrong conclusion about a core number, their standing, or a prediction; or the task failed.
- B: delay, hint needed, or a recoverable error or confusion.
- C: irritation, cosmetic, or a wish.

Severity, 0 to 4, fixed before data collection:
- 4: impact A in two or more participants.
- 3: impact A in one participant, or impact B in three or more.
- 2: impact B in one or two participants.
- 1: impact C, any number of participants.
- 0: not a problem; works as designed.

If a case does not fit, apply the rule as written and note the tension in the write-up. Do not adjust the rule mid-study. Anything at 3 or above blocks or reshapes a v1.1 item (protocol section 7).

## 7. Procedure and timing

- Within 48 hours of each session, and before the next one where scheduling allows (amended 1.1: sessions on consecutive mornings make "before the next one" impossible; the 48-hour limit stands): task outcomes from the recording, comprehension scores, rating-interpretation codes, then one observation pass through the transcript.
- SEQ is recorded as given; the anchor wording used is noted when it departed from the script. An SEQ asked before the task's main part (for example after navigation but before the question the task poses) is recorded with that note and counts as the task's SEQ.
- SUS is reported in aggregate only (n, median, range), not per participant (amended 1.2). Participants P03 and P04 were told on the call that their answers could not be matched to their codes, so no response is linked to a participant for any session. This departs from the registered per-participant SUS and is reported as a deviation; SEQ carries the per-task signal.
- Stop rule: run to eight sessions, or stop after six if two consecutive sessions have produced no new observation of impact A or B. Recruitment quotas in protocol section 3 still apply.
- After consolidation: a per-RQ synthesis listing confirming evidence, disconfirming evidence, and "no evidence obtained", each with participant lists.

## 8. Second coder

Not run (changelog 1.4(h)). The procedure below is the registered one, kept for the record.

- Two sessions, chosen by availability, not by content. The second coder gets the clean transcript, the recording, and this codebook, and does not see the first coder's scores.
- Recodes task success, C1 to C3, T7 Q1 and Q2 for both sessions, and codes observations for one of them.
- Report percent agreement per measure and list every disagreement with how it was resolved. No kappa; the sample is too small for it to mean anything.

## 9. Reporting rules

- Findings are stated as "P2, P5 and P6 said or did X". No percentages.
- Every issue shows its evidence obs_ids and quotes.
- Each RQ reports disconfirming evidence (POS rows) with the same prominence as confirming evidence.
- T5 wager answers are stored unlinked from participant codes and reported only in aggregate terms.

## Changelog

- 1.0 (2026-09-23): first version, tested on the pilot transcript. Registered on OSF 2026-09-28.
- 1.1 (2026-10-01), after sessions P01 and P02: (a) operational-evidence rule for comprehension items, symmetric, applied to all participants; (b) coding timing relaxed to "within 48 hours, before the next session where scheduling allows"; (c) SEQ recording rules for off-script anchors and early asking; (d) SUS linkage by code field and timestamp; (e) AI-assisted first-pass coding with moderator verification recorded per participant; (f) stand-in profile procedure for newcomers not in the dataset. All six are reported as deviations from the registered version in Part 2.
- 1.2 (2026-10-05), after sessions P03 to P05: SUS reported in aggregate only, replacing the 1.1 linkage rule, because two participants were told their answers could not be matched to their codes. Reported as a deviation.
- 1.3 (2026-10-23), after sessions P06 and P07, at consolidation: (a) the Issues sheet records impact per participant ("n at impact A", "n at impact B", "highest impact") so the registered severity rule can be applied as written; the rule is unchanged. (b) Recodes made during consolidation, recorded as section 6 requires: O251 NOTE to NAV-CANTFIND (P04, "I can't go back", for consistency with P06 O393 and P07 O456); O405 NOTE to MIS-SWEEP (P06, sweep odds read as the chance of winning the event, which section 3 scores 0). Four rows in eligible codes were left without an issue, each with a reason in the issue_id column: O058 (a moderator hint, not a site problem), O219 (an instrument fault, the Q1 wording), O413 (intended use), O462 (one participant's expectation about one fencer's position). (c) The sample was closed at seven sessions. The registered stop rule was eight sessions, or six if two consecutive sessions added nothing at impact A or B; neither condition was met, since P06 added I-13 (impact A) and P07 added I-05 and the coin-flip misreading in I-06 (impact A). Reason for closing: not recorded; superseded by 1.4(a). Reported as a deviation, together with the regional quota (one of two outside the main centres; P07 is from a main centre). (d) P07 was transcribed from Zoom's own automatic transcript and speaker attribution, not the offline pipeline used for P01 to P06; timestamps are Zoom's. (e) Coding timing: P04 and P05 were coded on 2026-10-05, outside the 48-hour limit in section 7. (f) Wager storage: the TaskLog notes for six participants and four observation quotes had carried the T5 wager answer next to the participant code, against section 9; redacted on 2026-10-23 with a backup kept, and the unlinked sheet shuffled out of session order. The answers never left the private workbook.
- 1.4 (2026-10-30), after session P08: (a) An eighth session was run (P08, 2026-10-29). The registered stop rule (eight sessions) is met, so 1.3(c) is withdrawn. The regional quota is met (two participants outside the main centres). (b) C2 gold corrected. The site has defined line average and sweep odds over the whole path to the title since 2026-06-05 (commit a4be70f), before this codebook was written; the 1.0 gold copied the superseded 0.1.15 wording, and its 0 anchor listed the correct reading ("the chance of winning the event") as a misreading. Found by the moderator while verifying P08. Reapplied to every participant: no C2 score changes (P03, P05, P06, P07 and P08 read sweep odds as winning every bout or the event, and none of them also explained line average with lower-is-harder; P04 keeps 2). The 1.3(b) recode of O405 is reversed (MIS-SWEEP to POS) and I-18 is withdrawn together with its v1.1 action, which would have mislabelled the figure. (c) P08 was transcribed from Zoom's automatic transcript and speaker attribution, as P07 was. (d) P08's session was also captured by a third-party AI notetaker (Fathom) in addition to Zoom; the consent text names "a third-party transcription software". Its summary linked the participant's organisation to his trust answers and the T5 discussion. It was not used as a source and the moderator is deleting it. It captured no other session (moderator, 2026-10-30). (e) SUS: the form used a 7-point scale, not the five points in the run sheet, with agreement at 1 (confirmed by the moderator, 2026-10-30). The aggregate is scored with the 7-point adaptation (positive items 7 minus the answer, negative items the answer minus 1, sum times 100/60) and is not directly comparable with 5-point SUS norms. (f) P08 T6: the run sheet's licence-number warning was not read, and the moderator supplied the participant's own licence number through the Zoom chat. (g) Wager storage, second pass. After 1.3(f) the unlinked sheet still quoted each participant's reasoning verbatim, and every quote also sat in Observations under a participant code; its pairing details (weapon, odds, names) also matched the TaskLog and Comprehension notes. Every answer could therefore be matched to a person. The sheet now holds the answer only, in shuffled order, without the pilot's row; one moderator line that stated an answer (O340) and one TaskLog note (P07) were redacted. Part 2 reports wager answers as counts only, without reasons. The trust reasons given in the T5 probes stay linked; they are RQ5 data, not wager answers. (h) Second coder (section 8) not run. One classmate was approached and declined, finding the task too hard, and no other coder was available within the reporting window. Percent agreement is therefore not reported. The items that had been left for the second coder (P01's and P05's trust numbers, P06 at 27:00, P07 T4 at 22:14, P08's C1) stand on the moderator's reading of the recordings, and every score in the study rests on a single coder who is also the moderator and developer, working from AI-drafted first-pass codes (1.1(e)).
