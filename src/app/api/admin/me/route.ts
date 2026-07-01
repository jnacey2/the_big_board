import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";

export async function GET() {
  return NextResponse.json({ admin: await isAdmin() });
}
