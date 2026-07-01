import { asc, eq } from "drizzle-orm";
import { getDb, kids, theses } from "@/db";
import {
  getPortfolio,
  getReturnSeries,
  getStats,
  type Portfolio,
  type PortfolioStats,
} from "./portfolio";

export type Competitor = {
  id: number;
  kind: string;
  name: string;
  teamName: string;
  mascot: string;
  color: string;
  portfolio: Portfolio;
  stats: PortfolioStats;
  thesisScore: number | null; // average across scored theses
  thesisCount: number;
};

export async function getCompetitors(): Promise<Competitor[]> {
  const db = await getDb();
  const rows = await db.select().from(kids).orderBy(asc(kids.id));
  const out: Competitor[] = [];
  for (const k of rows) {
    const [portfolio, stats, thesisRows] = await Promise.all([
      getPortfolio(k.id),
      getStats(k.id),
      db.select().from(theses).where(eq(theses.kidId, k.id)),
    ]);
    const scored = thesisRows.filter((t) => t.score != null);
    out.push({
      id: k.id,
      kind: k.kind,
      name: k.name,
      teamName: k.teamName,
      mascot: k.mascot,
      color: k.color,
      portfolio,
      stats,
      thesisScore:
        k.kind === "robot"
          ? 0 // the robot has no thesis — it can't think!
          : scored.length > 0
            ? scored.reduce((s, t) => s + (t.score ?? 0), 0) / scored.length
            : null,
      thesisCount: scored.length,
    });
  }
  return out;
}

export type RaceSeries = {
  id: number;
  teamName: string;
  mascot: string;
  color: string;
  kind: string;
  points: { date: string; index: number }[];
};

export async function getRaceData(competitors: Competitor[]): Promise<RaceSeries[]> {
  const out: RaceSeries[] = [];
  for (const c of competitors) {
    const points = await getReturnSeries(c.id);
    if (points.length > 0) {
      out.push({
        id: c.id,
        teamName: c.teamName,
        mascot: c.mascot,
        color: c.color,
        kind: c.kind,
        points,
      });
    }
  }
  return out;
}
