export const DEFAULT_SETTINGS = {
  initialRating: 1500,
  initialRD: 350,
  initialVolatility: 0.06,
  tau: 0.5,
  upsetThreshold: 75,
  upsetMultiplier: 1.25,
};

export const CSV_HEADER = 'date,competition,weapon,bout_type,fencer_a,club_a,fencer_b,club_b,score_a,score_b,de_round';
export const CSV_TEMPLATE = `${CSV_HEADER}
2025-03-15,NZ Open 2025,epee,pool,Hamish Carter,Auckland Swords,Tane Ngata,Wellington FC,5,3,
2025-03-15,NZ Open 2025,epee,pool,Charlotte Reeves,Christchurch Salle,Daniel Park,Auckland Swords,5,4,
2025-03-15,NZ Open 2025,epee,de,Hamish Carter,Auckland Swords,Theo Anand,Christchurch Salle,15,11,T8
2025-03-15,NZ Open 2025,epee,de,Tane Ngata,Wellington FC,Hamish Carter,Auckland Swords,15,13,Final
`;
