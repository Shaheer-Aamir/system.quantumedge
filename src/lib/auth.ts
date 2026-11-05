import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { admins, sessions } from "@/db/schema";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./constants";
import { newToken, sha256Hex } from "./crypto";

export async function createSession(adminId: string) {
  const db = getDb();
  const token = newToken();
  const now = Date.now();
  await db.delete(sessions).where(lt(sessions.expiresAt, now)); // tidy expired sessions
  await db.insert(sessions).values({ id: await sha256Hex(token), adminId, expiresAt: now + SESSION_TTL_MS, createdAt: now });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
  jar.delete(SESSION_COOKIE);
}

// Returns the signed-in admin (without the password hash) or null.
export const getCurrentAdmin = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await getDb()
    .select({ admin: admins })
    .from(sessions)
    .innerJoin(admins, eq(sessions.adminId, admins.id))
    .where(and(eq(sessions.id, await sha256Hex(token)), gt(sessions.expiresAt, Date.now())))
    .limit(1);
  const admin = rows[0]?.admin;
  if (!admin || !admin.isActive) return null;
  const { passwordHash: _omit, ...safe } = admin;
  return safe;
});

export type SessionAdmin = NonNullable<Awaited<ReturnType<typeof getCurrentAdmin>>>;

export async function requireAdmin(): Promise<SessionAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function requireSuperAdmin(): Promise<SessionAdmin> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") redirect("/overview");
  return admin;
}
