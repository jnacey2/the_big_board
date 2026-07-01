import { createHash } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "kst_admin";

export function adminToken(): string {
  const pin = process.env.ADMIN_PIN ?? "1234";
  const salt = process.env.CRON_SECRET ?? "kst_salt";
  return createHash("sha256").update(`${pin}:${salt}`).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === adminToken();
}

export function checkPin(pin: string): boolean {
  return pin === (process.env.ADMIN_PIN ?? "1234");
}
