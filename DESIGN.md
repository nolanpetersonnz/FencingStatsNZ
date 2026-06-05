# Design decisions

A retrospective on the key choices behind FencingStatsNZ: what I decided, what I considered instead, and what I'd revisit. Written partly for my own memory and partly so anyone who wants to understand or contribute to the project can see the reasoning, not just the code.

---

## Why Glicko-2 (not Elo)

The obvious starting point was Elo. It's the rating system most people have heard of, it's well-understood, and the math is simple enough to implement in one sitting.

The problem with Elo for fencing is that it assumes a steady stream of bouts against varied opponents. Chess players, the original target, play hundreds of games a year against opponents from across a rating distribution. NZ fencers might fence anywhere between three and thirty competitions a year, each against largely the same group of people, since fencing is a relatively niche sport in New Zealand. Elo handles infrequent play badly. Your rating becomes increasingly stale, and there's nothing to tell you how stale it is.

Glicko-2 adds two things Elo lacks. First, *rating deviation* (RD) - a measure of how certain we are about a fencer's rating, essentially uncertainty. A new fencer starts with high RD; their rating moves a lot with new results. An established fencer has low RD; ratings move slowly because we already have a lot of evidence. Second, *rating periods* - batches of bouts processed together, which suits the tournament-based structure of fencing better than Elo.

The trade-off was that Glicko-2 is significantly more complex to implement and harder to explain. RD specifically is a concept fencers don't intuitively understand - most just want to know "what's my number?" I've added a note in the FAQ but it's an ongoing UX challenge.

I'm still wondering whether something better than Glicko-2 would suit fencing more. Glicko-2 is designed for one-on-one rating-based contests; it doesn't model things specific to fencing like the difference between pool and Direct Elimination psychology, or referee effects, or weapon-specific factors. I'm treating the current implementation as a starting point that's better than what I had, not as the final system.

---

## Separate pool and DE rating streams

Each fencer has two independent ratings per weapon: one for pool bouts, one for direct elimination. There is no overlap between the two.

The original implementation had a single rating per weapon, with pool and DE bouts both feeding into it but weighted differently (pool bouts at 0.6, DE bouts at 1.0). The reasoning behind that was reasonable on paper: DE bouts are longer, the format is higher-stakes, less 'lucky', and so they should count for more. But, it conflated two different things into one number.

Pool fencing and direct elimination are two different skills. Pool bouts are five-touch, low-stakes individually but cumulative. They reward consistency and avoiding bad performances, and it is much more often that there are upsets. DE bouts are fifteen-touch, single-elimination. They reward closing out matches, handling pressure, and solving the puzzle that is the opponent. A fencer can be great at one and mediocre at the other. The most common pattern I noticed in my own results was strong pool performance and not as good in DE, signalling that I would benefit from training 15 touch format bouts more. Other fencers I know are the inverse, especially NZ fencers, where pools are (in my opinion), underemphasised.

Treating them as one skill obscured this. A fencer who consistently topped pools and then lost in the round of 32 would have an average rating that didn't reflect either truth. Splitting the streams means the leaderboard shows both, and you can see where someone's strengths actually are.

Every tournament now produces two rating updates per fencer instead of one. Each stream has less data than the unified rating did, so RDs stay higher and ratings move more slowly. For a fencer who's done many bouts, this is fine, they have enough data. For a new fencer, it means their numbers will take longer to settle in both categories.

I'd revisit this if the data showed pool and DE ratings were almost perfectly correlated, which would suggest I was wrong about them being different skills and the split was just adding noise. As of v0.1.8 the correlation is real but not overwhelming (better fencers are still better), which I think validates the split. Additionally, no one has seemed to have a problem with it, based on the first two rounds of feedback.

---

## Mixed events: the bug that (re)taught me about data pipelines

This was the most embarrassing bug in the project's history and the one I'm most grateful was caught.


NZ has some tournaments where men and women fence in the same event, called mixed events. They are not common internationally, but the often times there are not enough female entries to hold a competition. The FeNZ data pipeline labelled these events as both Mens and Womens, generating two duplicate copies of every bout in the dataset.

My original processing code keyed rating periods by competition name. The two copies of the event had different names ("Russell Towns Open - Mens" and "Russell Towns Open - Womens"), so they were processed as two separate rating periods. Every bout updated every fencer's rating twice.

I didn't catch this myself. A user did, one of my original test reporters - Elliot Hayes, who checked his own foil rankings and noticed his ratings were inflated. *"Yeah I checked my foil rankings cause it was a mixed event and the elo gets double counted. So anytime there's a mixed event elo losses and gains are basically doubled."*

The fix was a deduplication step: `detectMixedEvents` identifies when two competition labels refer to the same bouts, and `boutHash` removes duplicates before any rating math runs. But the more interesting consequence was downstream: women were appearing in the men's leaderboard. Gender was being assigned based on the first event-label the fencer was seen in; alphabetical sorting meant "Mens" came first, and so women in mixed events got stuck as men. The fix there was majority-voting gender from single-gender events only. A long tail of that choice surfaced later: fencers who *only* ever fenced mixed events had no single-gender row to vote on, so they fell out of the gendered leaderboards entirely. Their rating existed, but they weren't included. Thankfully, FeNZ has provided me with some fencer info, so gender now falls back to the official FeNZ data (whose ranking keys encode it) whenever the bout vote comes up empty.

What I took from this is that I need to assume my data has been touched by every other developer's decisions before it reached me. Always check downstream consequences of dedupe logic before you trust it, and that users will find bugs you missed in five minutes that you'd never have found in five months, because they're checking the system against truths only they know, such as their bout history.

---

## Chronological per-competition rating periods

Bouts from the same competition are processed together as a single rating period, before any ratings update. Within a competition, all pool bouts and all DE bouts contribute to one snapshot+update pass.

This sounds technical but it matters because the alternative would mean a fencer's first pool win would change their rating, which would then affect how the rating system evaluated their second pool win. Different orderings of the same data would produce different final ratings. That's how Elo works, and it's also why Elo can produce systematic biases when bouts within a session aren't actually independent.

Glicko-2's design assumes you batch bouts within a rating period because you're trying to evaluate a fencer's performance against a snapshot of where their opponents were before the period started. This is the correct structure for tournament-based competition: you walk into a tournament with some skill level, you fence several bouts against people at their pre-tournament skill levels, and the tournament tells you something about everyone at the same time. It is consistent with FIE (Fédération Internationale d'Escrime), where fencers enter the competition with rankings that don't change until final placement.

The decision I thought was worth worth noting was: how small should a rating period be? To me, it seemed to make sense to go per-competition rather than per-day (some competitions are multi-day, and sometimes there are multiple events per day). 

An implication: when two competitions happen on the same day, for example, A junior and senior regional being held on the same day, they're treated as separate rating periods. A fencer who somehow fenced both (unusual but possible across age categories) would get two independent rating updates that day. That seemed correct to me.

---

## Age category streams with downward inclusion

Each weapon now has separate rating streams per age category - Cadet, Junior, Senior, Veteran. Within each category, bouts at higher-tier events count toward lower-tier ratings, but not the reverse. Specifically: Senior bouts feed Senior + Junior + Cadet streams. Junior bouts feed Junior + Cadet. Cadet bouts feed only Cadet. Veteran is isolated.

This is in-line with FeNZ's system logic, the idea being that seniors can't fence in junior events, while juniors can. A junior gaining extra senior ranking points for doing well at an event without seniors seemed unfair to me.


Downward inclusion because matches selectors' intuitions about which results inform which decisions. When picking the NZ junior team, you'd consider a fencer's Senior performances; when picking the NZ senior team, you wouldn't weight their Junior performances heavily. It also doesn't make sense for a Junior or Cadet's performances in these gated competitions to be able to influence rankings where not everyone on the leaderboard had the opportunity to fence.

This caused a follow-up bug. The Junior leaderboard initially included every senior who'd ever fenced a senior event, because the Junior stream legitimately received their Senior bouts. The fix was to separate which streams receive Elo updates from a bout, and which leaderboard a fencer appears in. The solution was to require at least one bout in an explicitly Junior-tagged event within the current dataset year. So a fencer appears in the Junior leaderboard only if they've actually fenced as a Junior recently, even though their Junior stream may have been updated by Senior bouts.  

I then revisited this upon recieving fencer information from FeNZ that included fencer's dates of birth. I was able to use that to infer which fencers belong in which age categories.

A later pass turned up two more wrinkles in the same area. "Secondary Schools" events matched none of the age keywords and were silently classed as Senior, feeding school-age results into the open chain; they're now classed as Cadet, the conservative choice for a years-9–13 field, so the results never count upward. And the DOB enrichment had a subtler failure: because the registry merges records by licence number, a sibling's mis-entered licence in the source data folded one family member's name alias into another's record, so a handful of fencers (Daniel Gourley among them) was assigned sibling's birth year and dropped out of their real age category. The lookup now insists a record win its *own* name before any alias it merely happens to carry. A second variant followed: a single fencer split into two records by a typo'd birth year (Chantelle May as both 2004 and an impossible 2018, which slipped her into Juniors). Rather than guess by club count, the lookup demotes a DOB that's implausible for the fencer's competitive record: younger than eight at the time of an official ranking they hold, narrowly enough that real namesakes (two different James McKenzies, born 1977 and 1997) keep both their years.

---

## Withdrawals, abandons, and other non-results

Not every line in a bracket is a fenced result. A fencer can withdraw injured (medical), abandon, fail to finish, or be excluded (a black card). The FeNZ tableau encodes these with a per-fencer result code (`MED`, `A`, `DNF`, `E`/`EXC`) sitting alongside the normal `V` (victory) and `D` (defeat). Early on the ingest only read the score, so a withdrawal that carried points, or one recorded as 0–0, was indistinguishable from a real bout, it moved both ratings, and in the 0–0 case it registered as two losses. A beta reporter caught it: "it's struggling a bit with medical withdrawals, it says he lost as well."

The question was what a withdrawal *should* do. Skipping the bout entirely would erase it from the withdrawer's record, which felt wrong: they did lose the match, and the bracket shows it. Treating it as a normal loss is what caused the complaint, because a medical withdrawal says nothing about either fencer's skill on the day. The decision: record it as a loss for the fencer who withdrew and a win for their opponent, so the result stays visible, but contribute nothing to either rating. My logic is that a withdrawal is a fact about the tournament, not evidence about skill. I am still debating this though... arguably an injured fencer still 'lost', and this may allow people to game the system, by medically withdrawing rather than losing matches. I think it's a consideration I will have to make down the line, if this starts happening.

Mechanically, the ingest reads the code and tags the bout with a `flag` column; the rating engine skips flagged bouts when building its Glicko inputs but still tallies the win and the loss. It's the same lesson as the mixed-events bug in a smaller key: the rating math is only as honest as the pipeline's understanding of what each row of data actually means.

---

## Expected pool wins, and checking the model actually predicts

A recurring request was askFRED's "expected pool wins". This was a feature that didn't exist, so I had to look to 'fencingtracker', the only other fencing tracker that has this feature. The problem was: given the ratings of everyone in your pool, how many bouts *should* you win, and did you beat that? The maths is easy. Expected wins is just the sum of your win probabilities against each pool-mate, but it only means anything if the win probabilities themselves are any good. So before building the UI I ran a calibration check over the whole dataset: predict every bout from the two fencers' ratings as they stood *before* that competition (out-of-sample at the event level), then compare the predictions to what actually happened.

The model holds up. Favourites win about 67% of the time overall, and 73% when both fencers have rating history. More important than raw accuracy, is that it's calibrated: when the model calls someone a 70–80% favourite they win 76–80% of the time, and 90%+ favourites win 97%. Brier score lands at 0.18–0.20 against the 0.25 you'd get flipping coins. If anything it's slightly under-confident at the top, which in my opinion is a safe direction to err.

That gave me the confidence to surface it as a "Field overview": each bout drawn as a box coloured by difficulty (the pre-bout win probability) with the outcome on top, so a row reads at a glance: did you win the easy ones and steal a hard one, or drop bouts you were favoured in? The expected / actual / difference columns put a number on it. The honest limitation is that this is a post-hoc lens on competitions already in the data; a true pre-draw predictor would need the pool sheet before the event runs. I also pulled the win-probability formula into one shared helper so the Field overview and the Head-to-Head predictor can't drift apart.

---

## Decaying old results

The mechanism is shipped but switched off. There's an inactivity decay in place that widens a fencer's uncertainty the longer they go without competing, but it's off by default and I haven't tuned it yet. What I haven't committed to is decaying individual bouts by age, and that's the part I'm still uncertain about: what decay should mean and where to draw the lines. I do believe more recent bouts are more relevant, especially in a sport like fencing where a fencer's skill can change dramatically over a short period. It's a decision I want outside opinions on before I turn anything on.


---

## Showing uncertainty: a range, not just a number

The issue was that some fencers had very little data, so people with only a handful of bouts were being boosted to the top of the rankings despite high uncertainty. I decided to display the low end of that uncertainty as the headline number, to keep the fencers who have actually demonstrated consistent results at the top. It's a design decision I'm still not completely certain about, and one I intend to document better for users.



---

## Best and worst matchups: record versus expectation

I chose to define a worst matchup as a fencer who has beaten you more often than expected, over at least three meetings. The reasoning is that while you might be better on paper, they've shown a higher chance of beating you than the numbers predict, which points to a stylistic mismatch. For example, two of my own worst matchups, Cooper Gouge and Alex Holton, are both right-handed French-grip fencers, which suggests I may struggle against that archetype and would benefit from training against more fencers like them. The best matchups are the same idea inverted: opponents you beat more often than the ratings expect, where you tend to have their number even when they're close to you on paper. 

---

## Reconstructing and reading the DE tableau

Building out the difficulty of a DE path was a requested feature, and the reasoning fit my goal for the project: I want rankings to be more consistent and objective. A fencer with a relatively easy DE path will, by luck, earn more ranking points in the FeNZ system than someone who beat objectively better fencers and was knocked out by the eventual winner. I could infer the topology of the tableau from the FeNZ data, since it records the matchups and the round each occurred in, but I don't have the pool results that originally seeded the bracket. 

I chose to rank by the highest average-rating path, because a strong fencer beating strong fencers still performed the best, more so than a weaker fencer beating average ones, and I didn't want to strip that performance of its value. In addition to this, I thought it would be interesting to also show who had the best chance of sweeping their draw. 

---

## Putting the model's accuracy on the site

I surfaced the calibration backtest publicly because I want the platform's value to be visible: that it can be a genuine tool with real predictive value, and that users can draw their own conclusions about where it might help them (or not).

---

## Things I'm still uncertain about

A few decisions are sitting on the to-revisit pile:

The upset multiplier: I added a 1.25× multiplier to rating swings when the lower-rated fencer wins. The standard Glicko-2 formula already produces larger updates for upsets; the multiplier amplifies them further. The reasoning was that genuine upsets carry more information than the math implicitly assumes, because most upsets aren't random, they're caused by something like the higher-rated fencer being injured or the lower-rated fencer having improved. But this is hand-wavy. The right test would be: does the multiplier improve predictive accuracy on held-out data? I haven't run that test yet.

Club strength tiers: the current implementation uses median pool rating, which provides unintuitive results in early feedback. Small clubs with one or two strong members are ranked above larger clubs whose distribution naturally regressed toward the mean. There's a fix in place (median-of-active with a minimum-member threshold) but the deeper question is whether "club strength" is even the right metric, or whether the club section should be reframed entirely around "where should I fence?", a question about location, training environment, times, and affiliation rather than rating.

Provisional vs. displayed ratings: fencers with very few bouts have high RD, and Glicko-2's math can make their ratings spike to look unreasonably high. The system now shows the conservative `rating - RD` as the headline (see "Showing uncertainty" above), with a minimum-bouts filter on the leaderboard, which keeps thin-data fencers off the top. I'm still not certain that beats showing the raw rating behind the filter, since people don't always recognise the conservative number as their "actual" rating.

What I should do with withdrawals: losses or ties? Reduced rating weight?


These are the kinds of things I want the user study and continued beta feedback to inform.

---

## What I'd do differently if I started over


I'd write the data pipeline as a real pipeline from the start. Explicit stages with explicit invariants, rather than treating it as glue code between the API and the rating engine. The mixed-events bug took longer to find than it should have because the pipeline was implicit and the data assumptions were buried.

I'd build the FAQ and the in-app explanation of the math much earlier. Users went into the system without the conceptual framework to interpret it, which generated feedback that was 70% "I don't understand X" and 30% actual design issues. Better explanation upfront would have surfaced more substantive feedback faster.

I'd treat the FEEDBACK.md as something valuable. It started as a personal note-taking file and only later became something I'd want others to read. If I'd been writing it for an audience from the start, the early entries would be more useful both for me and for anyone else trying to learn from the project.

---

## What's next

Some things on the roadmap, framed by uncertainty rather than scope:

A user study with 6-8 fencers, using a remote screen-share methodology. The findings will go in `USER_STUDY.md` and inform v1.1.

Reconsidering the club section based on early feedback that "where should I fence?" might be a more useful framing than "how strong is this club?" This depends on data I don't currently have (location, affiliation status, training info).

A formal API design, possibly in collaboration with FeNZ, that would make the data accessible to other tools and replace the current scraping approach. This is in active discussion with the federation.



