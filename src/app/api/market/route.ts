import { NextResponse } from "next/server";
import { marketStatus } from "@/lib/market";

export async function GET() {
  return NextResponse.json(marketStatus());
}
