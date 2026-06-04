export const SCALE = 173.7178;

export const toG2 = (r, rd) => ({ mu: (r - 1500) / SCALE, phi: rd / SCALE });
export const fromG2 = (mu, phi) => ({ rating: mu * SCALE + 1500, rd: phi * SCALE });
export const gFn = (phi) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
export const eFn = (mu, mu_j, phi_j) => 1 / (1 + Math.exp(-gFn(phi_j) * (mu - mu_j)));

// Probability that fencer A beats fencer B, given each side's rating and RD.
// Glicko-2 expected score with the two uncertainties combined, so a bout
// involving a high-RD (provisional) fencer is pulled toward 50%. This is the
// canonical win-probability used across the app — Head-to-Head predictions and
// the competition difficulty / expected-pool-wins view.
export function winProbability(ratingA, rdA, ratingB, rdB) {
  const { mu: muA, phi: phiA } = toG2(ratingA, rdA);
  const { mu: muB, phi: phiB } = toG2(ratingB, rdB);
  const combinedPhi = Math.sqrt(phiA * phiA + phiB * phiB);
  return 1 / (1 + Math.exp(-gFn(combinedPhi) * (muA - muB)));
}

// Time-decay of certainty for an idle fencer. Between rating periods the
// deviation grows as phi' = sqrt(phi^2 + c^2 * dtYears), with c in the internal
// (mu/phi) scale — the Glicko-2 inactivity step, generalised from "per period"
// to elapsed time so two idle years widen more than two idle months. Capped at
// the initial RD: an inactive veteran should read as no less certain than a
// brand-new fencer, never more. c = 0 (the default) returns RD untouched, which
// keeps the whole pipeline behaviour-preserving when decay is off.
export function decayRD(rd, dtYears, c, initialRD) {
  if (!c || !(dtYears > 0)) return rd;
  const phi = rd / SCALE;
  const grown = Math.sqrt(phi * phi + c * c * dtYears) * SCALE;
  return Math.min(grown, initialRD);
}

export function newVolatility(sigma, delta, phi, v, tau) {
  const a = Math.log(sigma * sigma);
  const f = (x) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (tau * tau);
  };
  let A = a;
  let B;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(a - k * tau) < 0) k++; B = a - k * tau; }
  let fA = f(A), fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) { A = B; fA = fB; } else { fA = fA / 2; }
    B = C; fB = fC;
  }
  return Math.exp(A / 2);
}

export function updateRating(fencer, opponentBouts, settings) {
  if (opponentBouts.length === 0) {
    const { mu, phi } = toG2(fencer.rating, fencer.rd);
    const phiStar = Math.sqrt(phi * phi + fencer.volatility * fencer.volatility);
    const { rating, rd } = fromG2(mu, phiStar);
    return { rating, rd, volatility: fencer.volatility };
  }
  const { mu, phi } = toG2(fencer.rating, fencer.rd);
  let vInv = 0, deltaSum = 0;
  for (const b of opponentBouts) {
    const { mu: mj, phi: pj } = toG2(b.opponentRating, b.opponentRD);
    const gj = gFn(pj), Ej = eFn(mu, mj, pj);
    vInv += b.weight * gj * gj * Ej * (1 - Ej);
    deltaSum += b.weight * gj * (b.score - Ej);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;
  const sigma2 = newVolatility(fencer.volatility, delta, phi, v, settings.tau);
  const phiStar = Math.sqrt(phi * phi + sigma2 * sigma2);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

  let amplified = 0;
  for (const b of opponentBouts) {
    const { mu: mj, phi: pj } = toG2(b.opponentRating, b.opponentRD);
    const gj = gFn(pj), Ej = eFn(mu, mj, pj);
    const diff = b.opponentRating - fencer.rating;
    let m = 1;
    if (b.score === 1 && diff > settings.upsetThreshold) m = settings.upsetMultiplier;
    else if (b.score === 0 && diff < -settings.upsetThreshold) m = settings.upsetMultiplier;
    amplified += m * b.weight * gj * (b.score - Ej);
  }
  const muPrime = mu + phiPrime * phiPrime * amplified;
  const { rating, rd } = fromG2(muPrime, phiPrime);
  return { rating, rd, volatility: sigma2 };
}
