"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, meetings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { syncLeadStatus } from "@/lib/lead-sync";
import { resolveLead } from "@/lib/leads";
import { MEETING_STATUS_VALUES, type MeetingStatus } from "@/lib/outcomes";
import { localInputToMs } from "@/lib/time";

export type MeetingState = { error?: string; ok?: boolean };

const DURATIONS = [15, 30, 45, 60, 90];

export async function createMeetingAction(_prev: MeetingState, formData: FormData): Promise<MeetingState> {
  const admin = await requireAdmin();

  const startsAt = localInputToMs(String(formData.get("meetingAt") ?? ""));
  if (!startsAt) return { error: "Pick the date and time of the meeting." };

  const title = String(formData.get("meetingTitle") ?? "").trim().slice(0, 120) || "Intro call";
  const duration = DURATIONS.includes(Number(formData.get("meetingDuration"))) ? Number(formData.get("meetingDuration")) : 30;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000) || null;

  const db = getDb();
  const resolved = await resolveLead(db, admin.id, formData);
  if ("error" in resolved) return { error: resolved.error };

  const now = Date.now();
  await db.insert(meetings).values({
    id: crypto.randomUUID(), leadId: resolved.id, callId: null, adminId: admin.id, title, startsAt,
    durationMin: duration, status: "scheduled", notes, createdAt: now, updatedAt: now,
  });
  await db.update(leads).set({ status: "meeting_booked", updatedAt: now }).where(eq(leads.id, resolved.id));

  revalidatePath("/calendar");
  revalidatePath("/leads");
  return { ok: true };
}

export async function updateMeetingAction(
  id: string,
  patch: { status?: string; startsAtLocal?: string },
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, id) });
  if (!meeting) return { error: "This meeting no longer exists." };
  if (meeting.adminId !== admin.id && admin.role !== "super_admin") return { error: "You can only change your own meetings." };

  const set: { status?: MeetingStatus; startsAt?: number; updatedAt: number } = { updatedAt: Date.now() };
  if (patch.status !== undefined) {
    if (!MEETING_STATUS_VALUES.includes(patch.status)) return { error: "Unknown status." };
    set.status = patch.status as MeetingStatus;
  }
  if (patch.startsAtLocal !== undefined) {
    const ms = localInputToMs(patch.startsAtLocal);
    if (!ms) return { error: "Pick a valid date and time." };
    set.startsAt = ms;
  }
  await db.update(meetings).set(set).where(eq(meetings.id, id));
  if (set.status) await syncLeadStatus(db, meeting.leadId); // a cancelled or no-show meeting no longer counts
  revalidatePath("/calendar");
  revalidatePath("/leads");
  return {};
}

export async function deleteMeetingAction(id: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, id) });
  if (!meeting) return {};
  if (meeting.adminId !== admin.id && admin.role !== "super_admin") return { error: "You can only delete your own meetings." };
  await db.delete(meetings).where(eq(meetings.id, id));
  await syncLeadStatus(db, meeting.leadId);
  revalidatePath("/calendar");
  revalidatePath("/leads");
  return {};
}
