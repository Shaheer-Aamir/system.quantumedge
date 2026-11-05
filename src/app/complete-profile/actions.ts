"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export type ProfileState = {
  error?: string;
  values?: { fullName: string; email: string; phone: string };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{6,19}$/;
const MAX_AVATAR_LENGTH = 200_000;

export async function completeProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const admin = await requireAdmin();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const avatar = String(formData.get("avatar") ?? "");
  const values = { fullName, email, phone };

  if (fullName.length < 2 || fullName.length > 80) return { error: "Enter your full name.", values };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", values };
  if (!PHONE_RE.test(phone)) return { error: "Enter a valid phone number, for example +92 300 1234567.", values };
  if (avatar && (!avatar.startsWith("data:image/jpeg;base64,") || avatar.length > MAX_AVATAR_LENGTH)) {
    return { error: "That photo could not be used. Try a different image.", values };
  }

  await getDb()
    .update(admins)
    .set({ fullName, email, phone, avatar: avatar || admin.avatar, profileComplete: true })
    .where(eq(admins.id, admin.id));

  redirect("/overview");
}
