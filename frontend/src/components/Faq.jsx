import React from 'react';

// DRAFT FAQ COPY — wording is a placeholder for the owner to rewrite. The
// layout below is generic; edit the strings in FAQ, not the markup. Grouped so
// related questions sit together; add or remove freely.
const FAQ = [
  {
    section: 'Ratings',
    items: [
      {
        q: 'Why is my rating different from my official FeNZ ranking?',
        a: "FeNZ's ranking adds up your best five placings and treats every event the same, no matter how strong the field was. This system asks who you actually beat. Beating top fencers lifts your rating more than beating lower-rated ones, and a weak field is worth less than a strong one. The two will often disagree, especially for fencers who compete a lot at smaller regionals. That is expected.",
      },
      {
        q: 'Why are there two ratings, Pool and DE?',
        a: 'Because pool fencing and direct elimination are different skills. Pool bouts are five touches, low stakes on their own but they add up. DE bouts are fifteen touches under elimination pressure. Plenty of fencers are strong at one and only okay at the other, and a single number hides that. Each weapon carries two ratings.',
      },
      {
        q: 'Why am I ranked lower than I expected?',
        a: 'A few things can cause it. If you have not fenced much lately your uncertainty is high, so the system stays cautious. Recent losses to lower-rated opponents cost more than the equivalent wins earn. You might be strong in DE but not pools, or the other way round. And sometimes the system is simply wrong, in which case I would like to hear about it.',
      },
    ],
  },
  {
    section: 'Reading a profile',
    items: [
      {
        q: 'What is the ± range next to a rating?',
        a: 'It is how unsure the system is about your number, what Glicko calls the rating deviation, or RD. New or inactive fencers have a wide range; the more you fence, the narrower it gets. The range is your rating give or take that uncertainty.',
      },
      {
        q: 'Why is my displayed number the bottom of the range?',
        a: 'The headline number is deliberately cautious. It is the low end of your likely range, so a steady fencer with plenty of results sits above someone with one lucky day and a wide spread. As you fence more the range tightens and the number climbs toward your raw rating, which is also shown.',
      },
      {
        q: 'What are best and worst matchups?',
        a: 'Among opponents you have met at least three times, the system compares how often you actually beat them with how often it expected you to. Win more than expected and they are a best matchup. Win less and they are a worst matchup, sometimes called a bogey opponent: the kind of style problem a single rating cannot see.',
      },
      {
        q: 'What does the field overview mean?',
        a: 'Each bout is a box coloured by how hard the opponent was, using your win probability before the bout. Expected pool wins adds those probabilities up, which is the haul your draw was worth. The difference tells you whether you won the bouts you were favoured in or stole some you were not.',
      },
    ],
  },
  {
    section: 'Competitions',
    items: [
      {
        q: 'How is the tableau drawn, and why might it look slightly off?',
        a: 'The data records each DE bout\'s round and result but not the seed numbers, so the bracket is rebuilt by following the winners forward. Who beat whom is correct. The exact top-to-bottom order of the lines is inferred and may not match the original sheet.',
      },
      {
        q: 'What do line average and sweep odds mean?',
        a: 'Your line is your path through the bracket, and two numbers describe it, both measured across your whole path to the title — the opponents you fenced plus the ones you would have met in the rounds past where you went out had you kept winning. Line average is the mean opponent rating along that path, the toughness of the draw, and it is what ranks the hardest lines. Sweep odds is a separate figure: your chance, from the ratings before each bout, of beating every one of them and taking the title.',
      },
      {
        q: 'Where do competition placings come from?',
        a: 'Official placings are not in the data, so finishes are rebuilt from the bracket: champion, runner-up, then two tied thirds, since fencing runs no third-place bout, then the round\'s place band for earlier exits. Pool-only fencers get the range below the cut.',
      },
    ],
  },
  {
    section: 'The model',
    items: [
      {
        q: 'Is the prediction model any good?',
        a: 'Have a look at the predictive accuracy panel. Every bout is scored from the ratings as they stood before that event, so the model is never tested on a result it already knows. It is well calibrated: when it calls someone a 70% favourite, they win about 70% of the time. It also beats a coin flip on both Brier score and log-loss.',
      },
      {
        q: 'Why Glicko-2?',
        a: 'It copes with infrequent, clustered competition schedules better than Elo, and it carries an explicit measure of uncertainty that Elo does not, while staying simpler than TrueSkill. It is a starting point, not a final answer, and it can be swapped out.',
      },
      {
        q: 'What is the experimental time-decay?',
        a: 'An option that lets a fencer\'s uncertainty grow the longer they go without competing, so a long-idle rating widens and, shown cautiously, drifts down until they fence again. It is off by default and only changes the site if an admin turns it on.',
      },
    ],
  },
  {
    section: 'Data, privacy and contributing',
    items: [
      {
        q: 'Why are some fencers missing?',
        a: 'The data covers FeNZ-registered competitions from 2024 onward. Anyone who only fenced unregistered events, or stopped before 2024, may not show up. If someone fenced registered events and is still missing, tell me the competition.',
      },
      {
        q: 'Is this an official FeNZ tool?',
        a: 'Not for now. It is built independently using FeNZ\'s public results. I am in touch with Fencing NZ about working together.',
      },
      {
        q: 'How do I report a bug or a wrong-looking rating?',
        a: 'Email nolanpeterson.nz@gmail.com or open a GitHub issue. Say who, which tournament, what looked wrong, and what you expected. Signed-in fencers can also dispute any of their own bouts from their profile.',
      },
      {
        q: 'What about my privacy?',
        a: 'The site only shows what is already public on the FeNZ results portal: names, clubs, and results. No contact details. If you appear and want out, get in touch. Because your bouts affect other fencers\' ratings, I would anonymise rather than delete.',
      },
    ],
  },
];

export default function Faq() {
  return (
    <div>
      <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginBottom: 28, fontSize: '0.95rem' }}>
        These answers are a working draft.
      </div>
      {FAQ.map((group) => (
        <div key={group.section} style={{ marginBottom: 36 }}>
          <div className="fl-smallcaps" style={{ marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--ink)' }}>{group.section}</div>
          {group.items.map((it) => (
            <div key={it.q} style={{ marginBottom: 20, maxWidth: 760 }}>
              <div className="fl-display" style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>{it.q}</div>
              <div style={{ color: 'var(--ink-soft)', lineHeight: 1.6 }}>{it.a}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
