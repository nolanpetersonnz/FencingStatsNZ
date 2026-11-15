# Interpretation

Nolan's interpretation of the results, one entry per section of ANALYSIS.md. `analysis/run.mjs` reads this file and puts each entry in its section, so rerunning the analysis does not overwrite it. Edit the text here, not in ANALYSIS.md.

## 1

1. How accurate are FencingStatsNZ's predictions on bouts the model has never been calibrated on?
2. When the official FeNZ ranking and the FencingStatsNZ rating don't agree on the favoured winner, who actually wins?
3. Does a given rating gap mean the exact same thing at every rating level?

## 4

The model is notably more accurate than a coin flip, with a Brier score of 0.181 instead of a coin flip's 0.250. Accuracy is above expected accuracy, meaning that the model is underconfident. Favourites beat their predicted chance in every one of the five confidence bands, and the full dataset of 19,300 bouts also shows accuracy above expected accuracy (68.4% against 66.7%). I would still not make changes, because if we follow the logic we took with the headline ratings, we should be more conservative about who we predict to win, rather than be overconfident. The reason it's more accurate in this dataset is that 85% of the test bouts were between established fencers, while only 70% were established in the full dataset. If we compare only the established bouts, the gap shrinks: a Brier of 0.171 against 0.179. A likely explanation for this is that fencers with no rating are more often than not beginners, and they would underperform a 1500 rating start instead of overperforming or performing in line with it.

## 5

The 80 to 90% band has the biggest discrepancy between predicted and observed, and it is smallest in the 50 to 60% band. If someone on my site were to see an 85% chance to win, in reality they would likely have a chance of winning about 7 percentage points higher.

## 6

When both fencers are ranked, the FeNZ ranking and my site's rating agree most of the time: 523 out of 649 bouts. That surprises me, because my interpretation was that they disagreed a lot more frequently. In the bouts where the FeNZ ranking and the FencingStatsNZ rating disagreed, the rating's pick won slightly more often. However, the split was small, and we can't conclude that my rating is more accurate than the FeNZ ranking. We could see results like this all the time, even when the two systems are equally good. 16 out of 31 events were not seeded by the FeNZ ranking at all. Because no Rank was shown, I excluded those events from this comparison, meaning the sample became somewhat small.

## 7

As the gap between two fencers gets bigger, the space between the predicted and observed lines mostly grows. The predicted line leans less confident than the observed line actually shows, meaning my model predicts an upset more often than it actually happens. A small gap does not mean the same thing at both levels. Below 1500, the higher-rated fencers only won 49% of the time; at 1500 and over, they won 63%. The model predicted 57% for both. The established-only bouts are much more accurate than the unestablished bouts, meaning that we see a lot more difference between levels when new fencers are included, whereas that difference is almost gone among established fencers. Because there were only 80 test bouts with a mean rating of 1700 or more, I merged them into the 1500 and over bracket, which means I'm able to say nothing about the top fencers.

## 8

By Brier score, the model predicts pools better than DEs. Favourites beat their predicted chance the most in DEs. It is best at predicting foil, and worst at predicting sabre when all bouts are included, or established épée, which is in line with my expectations, because épée has a reputation for being a game of chance. In épée it's uncommon to see fencers repeatedly podium at the highest levels, while it is incredibly common in both foil and sabre. I would not put a lot of weight on the sabre results, because the sample is small.

## 9

214 of the 1,470 test bouts involve a fencer with no history, and those bouts score a Brier of about 0.24, against a coin flip's 0.25 (worked out from the two rows of the table). A fencer that is looking at a prediction that involves someone new on my site should know that, because this fencer has no history, the site is almost guessing, and they shouldn't rely on the number.

## 11

The biggest limitation here was that a third of the test bouts involve a fencer with fewer than 10 prior bouts. As we already established, having more history increases the model's accuracy, so having a lot of fencers with thin history will decrease the accuracy of the model in these tests. Additionally, the test set only covers seven New Zealand competitions between August and October 2026. This is a small sample, and so the numbers could skew either way.

## 14

Claude Code was used to write and run all of the analysis code, as well as to pull the entrant lists from the results portal. I took screenshots to find the seeding, and Claude entered them for me. It also made the tables and the two charts in the analysis, and wrote the data-only parts of ANALYSIS.md. I helped draft the plan. Claude helped draft the plan and assisted in brainstorming, as well as fixing typos and flagging where my words didn't match the numbers. It also drew charts that I looked at only for discussion. I made every final decision in the plan, and I made calls during the run. I also interpreted all of the results.
