import { and, count, eq, gt, lt, min } from "drizzle-orm";
import { loginFailures } from "@/db/schema";
import type { Db } from "@/db/types";



const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_USER_AND_IP = 5; // wrong passwords for one username from one address
const MAX_PER_IP = 30; // wrong passwords from one address, any username

// Returns how many minutes remain on a block, or 0 when the attempt may go ahead.
export async function loginBlockedMinutes(db: Db, ip: string, usernameLower: string) {
  const since = Date.now() - WINDOW_MS;
  const [pair] = await db.select({ n: count(), first: min(loginFailures.at) }).from(loginFailures)
    .where(and(eq(loginFailures.ip, ip), eq(loginFailures.usernameLower, usernameLower), gt(loginFailures.at, since)));
  if (pair.n >= MAX_PER_USER_AND_IP) return Math.max(1, Math.ceil(((pair.first ?? since) + WINDOW_MS - Date.now()) / 60_000));
  const [all] = await db.select({ n: count(), first: min(loginFailures.at) }).from(loginFailures)
    .where(and(eq(loginFailures.ip, ip), gt(loginFailures.at, since)));
  if (all.n >= MAX_PER_IP) return Math.max(1, Math.ceil(((all.first ?? since) + WINDOW_MS - Date.now()) / 60_000));
  return 0;
}

export async function recordLoginFailure(db: Db, ip: string, usernameLower: string) {
  const now = Date.now();
  await db.insert(loginFailures).values({ id: crypto.randomUUID(), ip, usernameLower: usernameLower.slice(0, 60), at: now });
  await db.delete(loginFailures).where(lt(loginFailures.at, now - 24 * 60 * 60 * 1000)); // keep the table small
}

export async function clearLoginFailures(db: Db, ip: string, usernameLower: string) {
  await db.delete(loginFailures).where(and(eq(loginFailures.ip, ip), eq(loginFailures.usernameLower, usernameLower)));
}
