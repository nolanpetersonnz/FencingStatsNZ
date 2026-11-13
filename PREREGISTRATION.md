# Accuracy analysis: preregistration

Nolan Peterson. Written before running any of the analysis below.

## Background

I'm running this because, as part of the informal pathway to Fencing New Zealand adoption, I needed to run checks on the accuracy of the rating that I display on my site. The current Method page numbers come from the exact data that the settings were chosen from. So now I plan on using a held-out sample to really check how well the site can predict, and how accurate my ratings are.

## Questions

1. How accurate are FencingStatsNZ's predictions on bouts the model has never been calibrated on?
2. When the official FeNZ ranking and the FencingStatsNZ rating don't agree on the favoured winner, who actually wins?
3. Does a given rating gap mean the exact same thing at every rating level?

## Data

- All bouts in the FencingStatsNZ dataset at the commit this file is in.
- **Test set:** bouts from competitions from 20 July 2026 onwards. Following Alex Dong's suggestion, this is a held-out set that the model has never been calibrated on. The rating settings haven't changed since before these bouts were added. If that turns out not to be true, I will report it.
- **FeNZ ranking:** will be taken from each competition's initial seeding on the FeNZ results portal, competition by competition. Seeding is set before the competition starts, so it can't contain results that are being tested.

### What I've already seen

The Method page currently shows accuracy over the whole dataset, which includes test-set bouts. I haven't looked at the test set on its own.

## Which bouts count

- Withdrawals and ties do not count.
- Wins on priority do not count. These are bouts where the scores were level at time, for example 13-13 or 14-14, and the winner was decided on priority. There is confirmed to be one in the test set.
- P-black cards don't count.

## Ratings used

Each fencer's rating in the bout's stream, as it stood before the competition. For example, we use a fencer's pool rating if they are fencing a pool bout.

## Measures

- Brier score, compared to a coin flip.
- Accuracy, so how often the predicted favourite wins, compared with expected accuracy: how often the favourite should win if every predicted chance were correct.
- Calibration, which is predicted against observed win rate.

## FeNZ ranking vs FencingStatsNZ rating

I'll look closely at the bouts where the two disagree, where one fencer is seeded higher by FeNZ but rated lower by FencingStatsNZ than their opponent. Then I'll report how often each side's pick wins. Bouts where either fencer is unranked will be left out, and I will report how many there are.

## Linearity

There was doubt about whether the win percentage follows the rating the way the model says. I am going to compare predicted and observed win rate:

- by rating gap: 0 to 50, 50 to 100, 100 to 200, 200 to 300, and over 300;
- by rating level, using the mean of the two fencers' ratings: below 1500, 1500 to 1700, and above 1700;
- by rating gap within each rating level, with larger gap bands so that cells aren't tiny: 0 to 100, 100 to 200, and over 200.

## Reporting

- I will report each result twice: all bouts, and established bouts only, where both fencers' RD is lower than the initial RD before the competition.
- Results will be split by pool vs DE and by weapon.
- Any group with fewer than 100 bouts is merged with its neighbour. I will log this.

## What happens with the results

This isn't being treated like a pass or fail test. These held-out numbers will replace the accuracy numbers on the Method page.

Anything I can't do as written will be listed in ANALYSIS.md, with the reason.

## How the analysis is run

The code will be written and run with agentic coding tools, working from this plan. I made the decisions, and I will write the interpretation of the results.
