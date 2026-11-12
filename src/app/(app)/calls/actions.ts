"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { calls, leads, meetings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { editCall, removeCall, type CallEdit } from "@/lib/call-ops";
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

  refresh();
  return { ok: true };
}

async function ownCall(id: string) {
  const admin = await requireAdmin();
  const call = await getDb().query.calls.findFirst({ where: eq(calls.id, id) });
  if (call && call.adminId !== admin.id && admin.role !== "super_admin") return { call, error: "You can only change your own calls." } as const;
  return { call, error: null } as const;
}

function refresh() {
  for (const path of ["/calls", "/leads", "/calendar", "/overview"]) revalidatePath(path);
}

// For a call logged by mistake: removes it, cancels the meeting it booked (if not held yet) and puts the lead back to New if it had no other calls.
export async function deleteCallAction(id: string): Promise<{ error?: string }> {
  const { call, error } = await ownCall(id);
  if (!call) return {};
  if (error) return { error };
  await removeCall(getDb(), id);
  refresh();
  return {};
}

export async function updateCallAction(id: string, input: CallEdit): Promise<{ error?: string }> {
  const { call, error } = await ownCall(id);
  if (!call) return { error: "This call no longer exists." };
  if (error) return { error };
  const result = await editCall(getDb(), id, input);
  if ("error" in result) return { error: result.error };
  refresh();
  return {};
}
