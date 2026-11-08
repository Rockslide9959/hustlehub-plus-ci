// Rounds the largest value up to a "nice" number (1, 2, 5 x 10^n) so the axis ticks are readable
export function niceMax(value) {
  // Also covers missing or non-numeric values (undefined, NaN)
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  return niceStep(fraction) * 10 ** exponent;
}

// The smallest of 1, 2, 5 or 10 that is at least the given fraction (1 to 10)
function niceStep(fraction) {
  if (fraction <= 1) return 1;
  if (fraction <= 2) return 2;
  if (fraction <= 5) return 5;
  return 10;
}
