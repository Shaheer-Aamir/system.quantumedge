import { and, eq } from "drizzle-orm";
import { calls, meetings } from "@/db/schema";
import type { Db } from "@/db/types";
import { syncLeadStatus } from "./lead-sync";
import { OUTCOME_VALUES, type Outcome } from "./outcomes";
import { localInputToMs } from "./time";

// Removes a call that was logged by mistake. A meeting it booked that has not happened yet is removed too,
// and the lead goes back to New if this was its only call.
export async function removeCall(db: Db, callId: string) {
  const call = await db.query.calls.findFirst({ where: eq(calls.id, callId) });
  if (!call) return null;
  await db.delete(meetings).where(and(eq(meetings.callId, callId), eq(meetings.status, "scheduled")));
  await db.delete(calls).where(eq(calls.id, callId));
  const status = await syncLeadStatus(db, call.leadId);
  return { leadId: call.leadId, status };
}

export type CallEdit = { outcome: string; notes: string; calledAt: string; meetingAt?: string; meetingTitle?: string; meetingDuration?: number };

// Changes a logged call. Switching it to "Meeting booked" books a meeting, switching away cancels the one it booked.
export async function editCall(db: Db, callId: string, input: CallEdit): Promise<{ error: string } | { leadId: string; status: string | null }> {
  if (!OUTCOME_VALUES.includes(input.outcome)) return { error: "Choose how the call went." };
  const calledAt = localInputToMs(input.calledAt);
  if (!calledAt) return { error: "Enter a valid call time." };
  if (calledAt > Date.now() + 5 * 60_000) return { error: "The call time cannot be in the future." };

  const call = await db.query.calls.findFirst({ where: eq(calls.id, callId) });
  if (!call) return { error: "This call no longer exists." };

  const linked = await db.select().from(meetings).where(eq(meetings.callId, callId));
  let newMeeting: number | null = null;
  if (input.outcome === "meeting_booked" && linked.length === 0) {
    newMeeting = input.meetingAt ? localInputToMs(input.meetingAt) : null;
    if (!newMeeting) return { error: "Pick the date and time of the meeting." };
  }

  const now = Date.now();
  if (input.outcome !== "meeting_booked" && call.outcome === "meeting_booked") {
    await db.delete(meetings).where(and(eq(meetings.callId, callId), eq(meetings.status, "scheduled")));
  }
  if (newMeeting) {
    const duration = [15, 30, 45, 60, 90].includes(Number(input.meetingDuration)) ? Number(input.meetingDuration) : 30;
    await db.insert(meetings).values({
      id: crypto.randomUUID(), leadId: call.leadId, callId, adminId: call.adminId, title: (input.meetingTitle ?? "").trim().slice(0, 120) || "Intro call",
      startsAt: newMeeting, durationMin: duration, status: "scheduled", notes: null, createdAt: now, updatedAt: now,
    });
  }
  await db.update(calls).set({ outcome: input.outcome as Outcome, notes: input.notes.trim().slice(0, 1000) || null, calledAt }).where(eq(calls.id, callId));
  return { leadId: call.leadId, status: await syncLeadStatus(db, call.leadId) };
}
