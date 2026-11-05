"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { scripts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export async function createScriptAction(): Promise<{ script?: { id: string; name: string; updatedAt: number; updatedBy: string }; error?: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  const existing = new Set((await db.select({ name: scripts.name }).from(scripts)).map((s) => s.name));
  let n = existing.size + 1;
  while (existing.has(`Script ${n}`)) n++;
  const now = Date.now();
  const id = crypto.randomUUID();
  await db.insert(scripts).values({ id, name: `Script ${n}`, content: "", createdBy: admin.id, updatedBy: admin.id, createdAt: now, updatedAt: now });
  revalidatePath("/scripts");
  return { script: { id, name: `Script ${n}`, updatedAt: now, updatedBy: admin.fullName ?? admin.username } };
}

export async function saveScriptAction(
  id: string,
  data: { name: string; content: string; expectedUpdatedAt: number },
): Promise<{ error?: string; updatedAt?: number }> {
  const admin = await requireAdmin();
  const name = data.name.trim();
  if (!name || name.length > 80) return { error: "Give the script a name under 80 characters." };
  if (data.content.length > 20_000) return { error: "This script is too long. Keep it under 20,000 characters." };

  const db = getDb();
  const current = await db.query.scripts.findFirst({ where: eq(scripts.id, id) });
  if (!current) return { error: "This script was deleted." };
  if (current.updatedAt !== data.expectedUpdatedAt) {
    return { error: "Someone else saved changes to this script. Copy your text, refresh the page, and apply your edits again." };
  }
  const updatedAt = Date.now();
  await db.update(scripts).set({ name, content: data.content, updatedBy: admin.id, updatedAt }).where(eq(scripts.id, id));
  revalidatePath("/scripts");
  return { updatedAt };
}

export async function deleteScriptAction(id: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  const script = await db.query.scripts.findFirst({ where: eq(scripts.id, id) });
  if (!script) return {};
  if (script.createdBy !== admin.id && admin.role !== "super_admin") return { error: "Only the creator or the super admin can delete this script." };
  await db.delete(scripts).where(eq(scripts.id, id));
  revalidatePath("/scripts");
  return {};
}
