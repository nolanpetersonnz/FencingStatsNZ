# FencingStatsNZ

A fencer-first results viewer and rating ledger for New Zealand fencing, built to run alongside (and eventually replace) the official stats portal.

---

## The problem

New Zealand's current ranking system takes each fencer's top five competition performances and sums the points. The problem is that it treats all competitions equally, a podium at the NZ Open counts the same as a podium at a small regional with a weak field. Enter enough competitions, get lucky at a few of them, and you can accumulate a ranking that doesn't reflect how you'd actually perform against the top fencers.

This came to a head during a recent team selection debate. One fencer had the results on paper to justify selection and, by the official metric, deserved it, but wasn't the strongest option for the team. The result was two proposed squads: 'the fair one' and 'he best one'. Neither felt fully defensible, and FeNZ has acknowledged that the ranking system is self-admittedly poor.

FencingStatsNZ is an attempt at something better: a system that weights wins by who you beat, separates pool-round competency from direct-elimination competency, and gives fencers and selectors a more honest basis for comparison.

---

## What it does

- **Ratings weighted by field strength** — winning against a highly-rated opponent moves your rating more than beating someone rated lower than you. A weak-field competition gives you less credit than a strong one.
- **Separate pool and DE ratings** — pool fencing and direct elimination are different skills. Each fencer carries two independent ratings per weapon, so you can see where your game actually lives.
- **Fencer profiles with rating history** — track how your ratings move across competitions and spot trends in your pool vs DE split.
- **Head-to-head comparison** — look up any two fencers' shared bout history and see a predicted win probability per stream based on current ratings.
- **Competition browser** — browse events ranked by field strength (S–D tiers based on median pool rating).
- **CSV import** — paste or upload a CSV of bout results; see the Import tab for the schema.

---

## The rating algorithm

The current implementation uses [Glicko-2](http://www.glicko.net/glicko.html) as a starting point. It handles infrequent competition schedules reasonably well, which matters for a country with NZ's calendar — and accounts for opponent strength, which the current top-five system completely ignores.

Two additions sit on top of the base algorithm:

- **Upset multiplier** — when the lower-rated fencer wins, the rating swing is amplified slightly (configurable, default 1.25×). This rewards genuine upsets more than the standard formula would.
- **Chronological rating periods** — all bouts from the same competition are processed together as one rating period before any ratings update, so earlier bouts in the day don't influence how later bouts are scored.

Glicko-2 is not necessarily the *right* algorithm for fencing. It was chosen as a reasonable placeholder, not a final decision. The plan is to experiment, gather feedback from fencers, and iterate. The algorithm is configurable from the Settings tab. If you have opinions, open an issue.

---

## A note on the data

FencingTimeLive recently blocked CSV exports from their results pages. To work around this, the ingest script (`ingest/fenz_ingest.py`) pulls directly from the FeNZ public API — the same data FeNZ uses to publish results on their own site. A side effect is that this gives FeNZ an incentive to keep their results up to date, since the data is only as good as what they enter.

---

## Running locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Data is persisted in your browser's local storage.

To load real results, go to the Import tab and upload a CSV, or use the ingest script:

```bash
cd ingest
pip install requests rapidfuzz
python fenz_ingest.py --since 2025-01-01 --cache ./cache --out bouts.csv
# Then import bouts.csv through the Import tab
```

See `python fenz_ingest.py --help` for the full list of options, including `--scan` (to reach further back than the 10-competition `/latest` cap) and `--categories` (to filter by age group).

---

## Deploying to Vercel

Import the repo, set the root directory to `frontend`, and Vercel will pick up `npm run build` automatically. No environment variables needed — the app is entirely client-side.

---

## Screenshot

*Coming soon.*

---

## A note on my own rankings

I'm ranked #1 in NZ Juniors and #8 in Seniors — previously #1. My own rating in this system is lower than my official ranking. The system isn't built to flatter me. Its harder on fencers who've padded their points at smaller competitions.

---

## License

MIT — see [LICENSE](LICENSE).
