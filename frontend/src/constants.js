export const DEFAULT_SETTINGS = {
  initialRating: 1500,
  initialRD: 200,
  initialVolatility: 0.06,
  tau: 0.5,
  upsetThreshold: 75,
  upsetMultiplier: 1.25,
  displayK: 1,
  // Experimental time-decay. A fencer's certainty erodes while they sit out, so
  // their RD grows with elapsed time between competitions (phi' = sqrt(phi^2 +
  // c^2 * years_idle), the standard Glicko-2 inactivity step). 0 disables it
  // entirely and is the default — the live leaderboard only decays if an admin
  // turns this on. A starting value to try is ~0.2 (unvalidated: not yet checked
  // against held-out predictive accuracy, which is the test that would justify
  // a specific number).
  inactivityDecayC: 0,
};

export const CSV_HEADER = 'date,competition,weapon,bout_type,fencer_a,club_a,fencer_b,club_b,score_a,score_b,de_round';
export const CSV_TEMPLATE = `${CSV_HEADER}
2025-03-15,NZ Open 2025,epee,pool,Hamish Carter,Auckland Swords,Tane Ngata,Wellington FC,5,3,
2025-03-15,NZ Open 2025,epee,pool,Charlotte Reeves,Christchurch Salle,Daniel Park,Auckland Swords,5,4,
2025-03-15,NZ Open 2025,epee,de,Hamish Carter,Auckland Swords,Theo Anand,Christchurch Salle,15,11,T8
2025-03-15,NZ Open 2025,epee,de,Tane Ngata,Wellington FC,Hamish Carter,Auckland Swords,15,13,Final
`;
