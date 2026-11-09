// Made-up international results for the prototype (PANELS.md 2.5: test data,
// not live results). They sit on the site's demo fencers (makeDemoBouts in
// pipeline.js), never on real ones. Every event, organiser and link is
// invented: events end "(test)" and links point at example.org. Dates count
// back from today, so the examples keep their meaning as time passes.
//
// Each record goes through the real validateResult and reviewResult, so the
// examples show what the rules do: one counted, one in too small a field,
// one at an event not on the list, one too old, one Australian (FeNZ's own
// ranking handles those; it meets cl. 5.1), one rejected and two waiting.

import { PLACEHOLDER_POLICY, initialLog, validateResult, newRecord, reviewResult, addMonths } from './intl.js';

export const TEST_FENCERS = [
  'Hamish Carter', 'Charlotte Reeves', "Liam O'Connell", 'Aroha Williams',
  'Tane Ngata', 'Theo Anand', 'Sophie Marlow',
];

const base = { organiser: 'Test federation', category: 'senior' };

function rows(today) {
  const ago = (months) => addMonths(today, -months);
  return [
    [{ ...base, fencer: 'hamish carter', fencer_name: 'Hamish Carter', weapon: 'epee', gender: 'mens',
      event: 'National Championships (test)', country: 'GBR', city: 'London', level: 'national_championship',
      date: ago(5), results_url: 'https://example.org/results/gbr-champs-epee', placing: 7, field_size: 48,
      residence: 'overseas' },
    { action: 'approve', listEntry: 'gbr-champs', note: 'Placing and field match the results page.' }],
    [{ ...base, fencer: 'hamish carter', fencer_name: 'Hamish Carter', weapon: 'epee', gender: 'mens',
      event: 'National circuit, round 2 (test)', country: 'FRA', city: 'Paris', level: 'national_circuit',
      date: ago(8), results_url: 'https://example.org/results/fra-circuit-2', placing: 21, field_size: 30,
      residence: 'overseas' },
    { action: 'approve', listEntry: 'fra-circuit', note: 'Checked.' }],
    [{ ...base, fencer: 'aroha williams', fencer_name: 'Aroha Williams', weapon: 'foil', gender: 'womens',
      event: 'Regional Open (test)', country: 'ITA', city: 'Milan', level: 'regional',
      date: ago(10), results_url: 'https://example.org/results/ita-regional', placing: 3, field_size: 250,
      residence: 'overseas' },
    { action: 'approve', note: 'Result is right; the event is not on the list.' }],
    [{ ...base, fencer: 'charlotte reeves', fencer_name: 'Charlotte Reeves', weapon: 'epee', gender: 'womens',
      event: 'National Championships (test)', country: 'GBR', city: 'Sheffield', level: 'national_championship',
      date: ago(14), results_url: 'https://example.org/results/gbr-champs-epee-w', placing: 5, field_size: 40,
      residence: 'overseas' },
    { action: 'approve', listEntry: 'gbr-champs', note: 'Checked.' }],
    [{ ...base, fencer: 'sophie marlow', fencer_name: 'Sophie Marlow', weapon: 'foil', gender: 'womens',
      event: 'National circuit, round 3 (test)', country: 'AUS', city: 'Melbourne', level: 'national_circuit',
      date: ago(2), results_url: 'https://example.org/results/aus-circuit-3', placing: 9, field_size: 30,
      residence: 'nz' },
    { action: 'approve', note: 'Checked.' }],
    [{ ...base, fencer: "liam o'connell", fencer_name: "Liam O'Connell", weapon: 'epee', gender: 'mens',
      event: 'National Championships (test)', country: 'ITA', city: 'Rome', level: 'national_championship',
      date: ago(3), results_url: 'https://example.org/results/ita-champs', placing: 18, field_size: 120,
      residence: 'overseas' },
    { action: 'reject', note: 'The results page shows 28th, not 18th.' }],
    [{ ...base, fencer: 'tane ngata', fencer_name: 'Tane Ngata', weapon: 'epee', gender: 'mens',
      event: 'National circuit, round 1 (test)', country: 'USA', city: 'Denver', level: 'national_circuit',
      date: ago(1), results_url: 'https://example.org/results/usa-circuit-1', placing: 12, field_size: 160,
      residence: 'overseas' }, null],
    [{ ...base, fencer: 'theo anand', fencer_name: 'Theo Anand', weapon: 'epee', gender: 'mens',
      event: 'Satellite (test)', country: 'SUI', city: 'Bern', level: 'fie', made_de: true,
      date: ago(6), results_url: 'https://example.org/results/sui-satellite', placing: 64, field_size: 180,
      residence: 'nz' }, null],
  ];
}

export function testIntlState(today, now = `${today}T09:00:00.000Z`) {
  const policy = PLACEHOLDER_POLICY;
  const records = rows(today).map(([input, review], i) => {
    const checked = validateResult(input, { today });
    if (checked.error) throw new Error(`test record ${i + 1}: ${checked.error}`);
    let rec = newRecord(checked.value, { id: `test-${i + 1}`, now });
    if (review) {
      const out = reviewResult(rec, review.action, {
        reviewer: 'Test reviewer', note: review.note, listEntry: review.listEntry, policy, now,
      });
      if (out.error) throw new Error(`test record ${i + 1}: ${out.error}`);
      rec = out.value;
    }
    return rec;
  });
  return { records, policy, log: initialLog(now), test_data: true };
}
