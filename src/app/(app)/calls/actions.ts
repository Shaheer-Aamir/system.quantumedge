"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { calls, leads, meetings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { resolveLead } from "@/lib/leads";
import { OUTCOME_VALUES, type Outcome } from "@/lib/outcomes";
import { localInputToMs } from "@/lib/time";

export type CallState = { error?: string; ok?: boolean };

export async function logCallAction(_prev: CallState, formData: FormData): Promise<CallState> {
  const admin = await requireAdmin();

  const outcome = String(formData.get("outcome") ?? "");
  if (!OUTCOME_VALUES.includes(outcome)) return { error: "Choose how the call went." };

  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000) || null;
  const calledAt = localInputToMs(String(formData.get("calledAt") ?? "")) ?? Date.now();
  if (calledAt > Date.now() + 5 * 60_000) return { error: "The call time cannot be in the future." };

  let meetingAt: number | null = null;
  if (outcome === "meeting_booked") {
    meetingAt = localInputToMs(String(formData.get("meetingAt") ?? ""));
    if (!meetingAt) return { error: "Pick the date and time of the meeting." };
  }

  const db = getDb();
  const resolved = await resolveLead(db, admin.id, formData);
  if ("error" in resolved) return { error: resolved.error };
  const { id: leadId, status } = resolved;

  const now = Date.now();
  const callId = crypto.randomUUID();
  await db.insert(calls).values({ id: callId, adminId: admin.id, leadId, outcome: outcome as Outcome, notes, calledAt, createdAt: now });

  if (meetingAt) {
    const title = String(formData.get("meetingTitle") ?? "").trim().slice(0, 120) || "Intro call";
    const duration = [15, 30, 45, 60, 90].includes(Number(formData.get("meetingDuration"))) ? Number(formData.get("meetingDuration")) : 30;
    await db.insert(meetings).values({
      id: crypto.randomUUID(), leadId, callId, adminId: admin.id, title, startsAt: meetingAt,
      durationMin: duration, status: "scheduled", notes, createdAt: now, updatedAt: now,
    });
    await db.update(leads).set({ status: "meeting_booked", updatedAt: now }).where(eq(leads.id, leadId));
  } else if (status === "new" || (status === "dead" && outcome === "follow_up")) {
    // First contact, or a lead that was written off but now wants a follow-up
    await db.update(leads).set({ status: "contacted", updatedAt: now }).where(eq(leads.id, leadId));
  } else {
    await db.update(leads).set({ updatedAt: now }).where(eq(leads.id, leadId));
  }

  revalidatePath("/calls");
  revalidatePath("/calendar");
  revalidatePath("/leads");
  return { ok: true };
}

export async function deleteCallAction(id: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  const call = await db.query.calls.findFirst({ where: eq(calls.id, id) });
  if (!call) return {};
  if (call.adminId !== admin.id && admin.role !== "super_admin") return { error: "You can only delete your own calls." };
  await db.delete(calls).where(eq(calls.id, id));
  revalidatePath("/calls");
  revalidatePath("/leads");
  return {};
}
