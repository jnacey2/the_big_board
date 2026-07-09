/**
 * Display helper for Sharpe ratios (shared by the scoreboard table and the
 * portfolio stat card). Early in the season only a handful of daily returns
 * exist, so annualized Sharpe can legitimately compute to silly magnitudes;
 * we cap what we SHOW at ±5 ("> 5" / "< -5" with the exact value in the
 * tooltip) while ranking still uses the real number.
 */
export const SHARPE_DISPLAY_CAP = 5;

export function formatSharpe(v: number): { text: string; title: string | null } {
  if (v > SHARPE_DISPLAY_CAP) {
    return {
      text: `> ${SHARPE_DISPLAY_CAP.toFixed(2)}`,
      title: `Exact Sharpe ${v.toFixed(2)} — shown capped because a few days of data make this number jumpy`,
    };
  }
  if (v < -SHARPE_DISPLAY_CAP) {
    return {
      text: `< -${SHARPE_DISPLAY_CAP.toFixed(2)}`,
      title: `Exact Sharpe ${v.toFixed(2)} — shown capped because a few days of data make this number jumpy`,
    };
  }
  return { text: v.toFixed(2), title: null };
}
