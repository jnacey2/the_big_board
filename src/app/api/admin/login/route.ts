import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, checkPin } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  if (!checkPin(String(pin ?? ""))) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
