/**
 * Regression tests for the Sharpe / daily-return math in src/lib/portfolio.ts.
 * No test framework in this repo — plain assertions, run with:
 *
 *   npx tsx scripts/test-sharpe-math.ts
 *
 * Expected values are hand-computed (shown in comments) so a future change to
 * the formulas fails loudly instead of silently shifting the leaderboard.
 */
import {
  computeDailyReturns,
  computeRiskStats,
  MIN_SHARPE_DAYS,
  RISK_FREE_RATE,
} from "../src/lib/portfolio";

let failures = 0;
function check(name: string, actual: number | null, expected: number | null, tol = 1e-9) {
  const ok =
    actual === null || expected === null
      ? actual === expected
      : Math.abs(actual - expected) <= tol;
  if (!ok) {
    failures++;
    console.error(`FAIL ${name}: expected ${expected}, got ${actual}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// ── computeDailyReturns ───────────────────────────────────────────

// Day one is included: r_1 = V_1 / base - 1. $5,000 in, first close $4,915
// -> -1.7%; next day 4915 * 1.002 = 4924.83 -> +0.2%.
{
  const { dates, returns } = computeDailyReturns(
    [
      { snapDate: "2026-07-06", value: 4915 },
      { snapDate: "2026-07-07", value: 4924.83 },
    ],
    new Map(),
    5000
  );
  check("day-one return included (count)", returns.length, 2);
  check("day-one return r1 = 4915/5000 - 1", returns[0], -0.017, 1e-12);
  check("second return r2 = 4924.83/4915 - 1", returns[1], 0.002, 1e-12);
  check("day-one date is first snapshot", dates[0] === "2026-07-06" ? 1 : 0, 1);
}

// Deposits landing on day t are not return: V goes 5000 -> 5100 but $100 of
// that was a deposit, so both days are 0%.
{
  const { returns } = computeDailyReturns(
    [
      { snapDate: "2026-07-06", value: 5000 },
      { snapDate: "2026-07-07", value: 5100 },
    ],
    new Map([["2026-07-07", 100]]),
    5000
  );
  check("deposit-adjusted r1", returns[0], 0, 1e-12);
  check("deposit-adjusted r2 = (5100-100)/5000 - 1", returns[1], 0, 1e-12);
}

// Robot pattern: funded entirely by a day-one deposit (base = that deposit).
// First close $5,050 on a $5,000 deposit -> +1%.
{
  const { returns } = computeDailyReturns(
    [{ snapDate: "2026-07-06", value: 5050 }],
    new Map([["2026-07-06", 5000]]),
    5000
  );
  check("robot day-one vs deposit base", returns[0], 0.01, 1e-12);
}

// Zero base (defensive): day one skipped, later days still computed.
{
  const { returns } = computeDailyReturns(
    [
      { snapDate: "2026-07-06", value: 5000 },
      { snapDate: "2026-07-07", value: 5050 },
    ],
    new Map(),
    0
  );
  check("zero base: only snapshot-over-snapshot return", returns.length, 1);
  check("zero base r = 5050/5000 - 1", returns[0], 0.01, 1e-12);
}

// ── computeRiskStats ──────────────────────────────────────────────

// Hand-computed 5-sample case: rets = [1%, -0.5%, 0.2%, 0.7%, -0.1%]
//   mean = 0.0026
//   sample var = ((0.0074)^2+(0.0076)^2+(0.0006)^2+(0.0044)^2+(0.0036)^2)/4
//              = 1.452e-4 / 4 = 3.63e-5;  std = 6.0249481e-3
//   annual vol = std * sqrt(252) = 0.09564322 -> 9.564322%
//   rf_daily   = 0.045/252 = 1.7857143e-4
//   sharpe     = (0.0026 - rf_daily)/std * sqrt(252) = 6.3799698
{
  const s = computeRiskStats([0.01, -0.005, 0.002, 0.007, -0.001]);
  check("annual vol % (hand)", s.volatilityAnnualPct, 9.5643224, 1e-4);
  check("sharpe (hand)", s.sharpe, 6.3799698, 1e-4);
}

// The daily-excess form must equal the annualized form:
// (mean - rf/252)/std * sqrt(252) === (mean*252 - rf) / (std*sqrt(252))
{
  const rets = [0.004, -0.0031, 0.0012, 0.0055, -0.002, 0.0008];
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)
  );
  const annualForm = (mean * 252 - RISK_FREE_RATE) / (sd * Math.sqrt(252));
  check("daily-excess form == annual form", computeRiskStats(rets).sharpe, annualForm, 1e-12);
}

// Small-sample guard: with fewer than MIN_SHARPE_DAYS returns, Sharpe is
// null but volatility/risk still compute (from 2 observations).
{
  const s = computeRiskStats([-0.017, 0.002, 0.003, 0.002]); // 4 < 5
  check(`sharpe null below ${MIN_SHARPE_DAYS} samples`, s.sharpe, null);
  const volOk = s.volatilityAnnualPct != null && s.volatilityAnnualPct > 0;
  check("volatility still computed at n=4", volOk ? 1 : 0, 1);
  check("everything null at n=1", computeRiskStats([0.01]).sharpe, null);
  check("vol null at n=1", computeRiskStats([0.01]).volatilityAnnualPct, null);
}

// Zero volatility: identical returns -> no meaningful Sharpe.
{
  const s = computeRiskStats([0.001, 0.001, 0.001, 0.001, 0.001]);
  check("zero-vol sharpe is null", s.sharpe, null);
  check("zero-vol annual vol is 0", s.volatilityAnnualPct, 0, 1e-12);
}

// ── The production paradox, pinned down ───────────────────────────
// A big day-one loss followed by small up days: cumulative return is
// negative, so the return series must NOT have a positive mean (the old code
// dropped day one and produced Sharpe ~ +6.8 for a losing portfolio).
{
  const snaps = [
    { snapDate: "2026-07-06", value: 4915 }, // -1.70% day one
    { snapDate: "2026-07-07", value: 4915 * 0.997 },
    { snapDate: "2026-07-08", value: 4915 * 0.997 * 1.006 },
    { snapDate: "2026-07-09", value: 4915 * 0.997 * 1.006 * 1.0035 },
  ];
  const { returns } = computeDailyReturns(snaps, new Map(), 5000);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  check("losing portfolio has negative mean daily return", mean < 0 ? 1 : 0, 1);
  // And with only 4 observations, Sharpe stays hidden anyway:
  check("4-day-old portfolio shows no sharpe", computeRiskStats(returns).sharpe, null);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll Sharpe math checks passed.");
