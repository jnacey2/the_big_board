import { NextResponse } from "next/server";
import { asc, desc, eq, isNotNull } from "drizzle-orm";
import { drafts, getDb, kids, snapshots, transactions } from "@/db";
import { isAdmin } from "@/lib/adminAuth";
import { etDateStr } from "@/lib/market";
import { backfillSnapshots } from "@/lib/portfolio";
import { priceOn, robotBenchmarkAmount, ROBOT_BENCHMARK_NOTE } from "@/lib/trades";

export const maxDuration = 60;

/**
 * Rebuild Indexo as a clean benchmark (parent PIN required): wipe ALL of the
 * robot's transactions and snapshots, then recreate exactly one deposit and
 * one all-in SPY buy dated on the original draft-execution day, priced at
 * SPY's close on that day, and backfill his snapshot history.
 *
 * This is the one-click fix for databases where the old per-trade mirroring
 * model inflated Indexo (every kid's dollars were added to his pot, so two
 * kids × $5,000 made a $10,000 robot). Idempotent: running it again wipes and
 * recreates the same single pair of rows.
 */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }
  const db = await getDb();

  const [robot] = await db.select().from(kids).where(eq(kids.kind, "robot"));
  if (!robot) {
    return NextResponse.json({ error: "No robot rival exists yet" }, { status: 400 });
  }

  // The benchmark is dated on draft-execution day. Prefer the draft record;
  // fall back to the robot's earliest existing transaction (his old mirrored
  // rows started the same day the draft was executed).
  const [executedDraft] = await db
    .select()
    .from(drafts)
    .where(isNotNull(drafts.executedAt))
    .orderBy(desc(drafts.id))
    .limit(1);
  const [firstRobotTx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.kidId, robot.id))
    .orderBy(asc(transactions.tradeDate), asc(transactions.id))
    .limit(1);
  const date = executedDraft?.executedAt
    ? etDateStr(executedDraft.executedAt)
    : firstRobotTx?.tradeDate;
  if (!date) {
    return NextResponse.json(
      { error: "Nothing to rebuild from — no executed draft and no robot transactions" },
      { status: 400 }
    );
  }

  const amount = await robotBenchmarkAmount();
  const spyPrice = await priceOn("SPY", date).catch((e) => {
    console.error("SPY price lookup failed:", e);
    return null;
  });
  if (!spyPrice || spyPrice <= 0) {
    return NextResponse.json(
      { error: `Couldn't get a SPY price for ${date} — check the FMP API key and try again` },
      { status: 502 }
    );
  }

  await db.delete(transactions).where(eq(transactions.kidId, robot.id));
  await db.delete(snapshots).where(eq(snapshots.kidId, robot.id));

  await db.insert(transactions).values({
    kidId: robot.id,
    ticker: "SPY",
    type: "deposit",
    shares: 0,
    price: 0,
    amount,
    tradeDate: date,
    note: ROBOT_BENCHMARK_NOTE,
  });
  await db.insert(transactions).values({
    kidId: robot.id,
    ticker: "SPY",
    type: "buy",
    shares: amount / spyPrice,
    price: spyPrice,
    amount,
    tradeDate: date,
    note: ROBOT_BENCHMARK_NOTE,
  });

  const snapshotDays = await backfillSnapshots(robot.id).catch((e) => {
    console.error("robot snapshot backfill failed:", e);
    return 0;
  });

  return NextResponse.json({
    ok: true,
    date,
    amount,
    spyPrice,
    shares: amount / spyPrice,
    snapshotDays,
  });
}
