import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { admins } from "@/db/schema";

export async function listAdmins() {
  const rows = await getDb()
    .select({ id: admins.id, fullName: admins.fullName, username: admins.username })
    .from(admins)
    .where(eq(admins.isActive, true))
    .orderBy(asc(admins.createdAt));
  return rows.map((r) => ({ id: r.id, name: r.fullName ?? r.username }));
}
