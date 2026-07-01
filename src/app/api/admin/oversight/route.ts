import { NextResponse } from "next/server";
import { asc, desc } from "drizzle-orm";
import { chatMessages, getDb, kids, theses } from "@/db";
import { isAdmin } from "@/lib/adminAuth";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }
  const db = await getDb();
  const [kidRows, chats, thesisRows] = await Promise.all([
    db.select().from(kids).orderBy(asc(kids.id)),
    db.select().from(chatMessages).orderBy(desc(chatMessages.id)).limit(300),
    db.select().from(theses).orderBy(desc(theses.updatedAt)),
  ]);
  return NextResponse.json({ kids: kidRows, chats: chats.reverse(), theses: thesisRows });
}
