# Can fencers read their own ratings? Codebook and coding procedure

Version 1.0, 2026-09-23. Companion to the study protocol (section 7, Measures). Freeze this file with the protocol before the first main-sample session and commit any later change with a dated changelog entry at the bottom.

## 0. Scope

- Applies to main-sample sessions P1 onward. The pilot (P0, 2026-09-23) was coded with this codebook only to test it; P0 scores and observations do not enter Part 2.
- Sources per session: the screen and audio recording, and the transcript. Task outcomes and navigation events are coded from the recording. Comprehension and observations are coded from the transcript, checked against the recording where the transcript is ambiguous.
- First coder: the moderator (also the developer). Second coder: section 8.

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

C1, rating range (from T1). Gold: the headline number is the low end of the uncertainty range; raw is the centre; the range narrows as bouts accumulate and widens with inactivity.
- 2: low end, plus at least one of the two dynamics.
- 1: knows there is a range but treats the headline as the exact rating, or knows a dynamic but not that the headline is the low end.
- 0: no range concept.

C2, line average and sweep odds (from T4). Gold (DESIGN.md): line average is the mean rating of the opponents beaten on a fencer's DE path; sweep odds is the chance, from ratings alone, of winning every bout on that path, so lower means harder.
- 2: both, including that lower sweep odds means a harder line.
- 1: one of the two, or "harder opponents" with no mechanism, or sweep odds as "win every bout" without the line link.
- 0: reads line average as the fencer's own rating, or sweep odds as bouts won or as the chance of winning the event.

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

Impact, one letter:
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

- Within 48 hours of each session, before the next one: task outcomes from the recording, comprehension scores, rating-interpretation codes, then one observation pass through the transcript.
- Stop rule: run to eight sessions, or stop after six if two consecutive sessions have produced no new observation of impact A or B. Recruitment quotas in protocol section 3 still apply.
- After consolidation: a per-RQ synthesis listing confirming evidence, disconfirming evidence, and "no evidence obtained", each with participant lists.

## 8. Second coder

- Two sessions, chosen by availability, not by content. The second coder gets the clean transcript, the recording, and this codebook, and does not see the first coder's scores.
- Recodes task success, C1 to C3, T7 Q1 and Q2 for both sessions, and codes observations for one of them.
- Report percent agreement per measure and list every disagreement with how it was resolved. No kappa; the sample is too small for it to mean anything.

## 9. Reporting rules

- Findings are stated as "P2, P5 and P6 said or did X". No percentages.
- Every issue shows its evidence obs_ids and quotes.
- Each RQ reports disconfirming evidence (POS rows) with the same prominence as confirming evidence.
- T5 wager answers are stored unlinked from participant codes and reported only in aggregate terms.

## Changelog

- 1.0 (2026-09-23): first version, tested on the pilot transcript.
