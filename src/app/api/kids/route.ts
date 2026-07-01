import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, kids } from "@/db";
import { isAdmin } from "@/lib/adminAuth";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(kids).orderBy(kids.id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  const existing = await db.select().from(kids);
  const firstRun = existing.filter((k) => k.kind === "kid").length === 0;
  if (!firstRun && !(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }

  const body = await req.json();
  const { name, teamName, mascot, color, startingBudget } = body ?? {};
  if (!name || !teamName) {
    return NextResponse.json({ error: "name and teamName required" }, { status: 400 });
  }
  const [row] = await db
    .insert(kids)
    .values({
      kind: "kid",
      name: String(name).slice(0, 40),
      teamName: String(teamName).slice(0, 60),
      mascot: mascot || "🚀",
      color: color || "#22d3ee",
      startingBudget: Number(startingBudget) > 0 ? Number(startingBudget) : 500,
    })
    .returning();

  // Ensure the robot rival exists once real kids exist.
  const robot = existing.find((k) => k.kind === "robot");
  if (!robot) {
    await db.insert(kids).values({
      kind: "robot",
      name: "Indexo",
      teamName: "Indexo the Robot",
      mascot: "🤖",
      color: "#94a3b8",
      startingBudget: 0,
    });
  }
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }
  const db = await getDb();
  const body = await req.json();
  const { id, ...fields } = body ?? {};
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const allowed: Record<string, unknown> = {};
  for (const k of ["name", "teamName", "mascot", "color", "startingBudget", "tourSeen"]) {
    if (fields[k] !== undefined) allowed[k] = fields[k];
  }
  const [row] = await db.update(kids).set(allowed).where(eq(kids.id, id)).returning();
  return NextResponse.json(row);
}
