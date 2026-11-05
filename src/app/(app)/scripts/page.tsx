import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { admins, scripts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/coming-soon";
import { ScriptsWorkspace } from "./scripts-workspace";
import type { ScriptItem } from "./script-editor";

export default async function ScriptsPage() {
  const me = await requireAdmin();
  const rows = await getDb()
    .select({ s: scripts, name: admins.fullName, user: admins.username })
    .from(scripts)
    .leftJoin(admins, eq(scripts.updatedBy, admins.id))
    .orderBy(asc(scripts.createdAt));

  const items: ScriptItem[] = rows.map(({ s, name, user }) => ({
    id: s.id, name: s.name, content: s.content, updatedAt: s.updatedAt, updatedBy: name ?? user ?? "Unknown",
    canDelete: s.createdBy === me.id || me.role === "super_admin",
  }));

  return (
    <>
      <PageHeader title="Scripts" description="The cold calling scripts your team uses. Anyone can edit them, so changes are visible to everyone." />
      <ScriptsWorkspace initial={items} />
    </>
  );
}
