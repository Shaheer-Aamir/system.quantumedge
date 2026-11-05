"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { admins, sessions } from "@/db/schema";
import { createSession, requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { EMAIL_RE, PHONE_RE } from "@/lib/phone";

export type FormState = { error?: string; ok?: boolean };

const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{2,39}$/;
const MIN_PASSWORD = 10;
const MAX_AVATAR = 200_000;

function checkDetails(fullName: string, email: string, phone: string) {
  if (fullName.length < 2 || fullName.length > 80) return "Enter a full name.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  if (!PHONE_RE.test(phone)) return "Enter a valid phone number, for example +92 300 1234567.";
  return null;
}

// ---- my profile ---------------------------------------------------------

export async function updateMyProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const fullName = get("fullName"), email = get("email"), phone = get("phone");
  const avatar = String(formData.get("avatar") ?? "");
  const problem = checkDetails(fullName, email, phone);
  if (problem) return { error: problem };
  if (avatar && (!avatar.startsWith("data:image/jpeg;base64,") || avatar.length > MAX_AVATAR)) return { error: "That photo could not be used. Try a different image." };

  await getDb().update(admins).set({ fullName, email, phone, avatar: avatar || null, profileComplete: true }).where(eq(admins.id, me.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changeMyPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters for the new password.` };
  if (next !== confirm) return { error: "The new passwords do not match." };

  const db = getDb();
  const row = await db.query.admins.findFirst({ where: eq(admins.id, me.id) });
  if (!row || !(await verifyPassword(current, row.passwordHash))) return { error: "Your current password is not correct." };

  await db.update(admins).set({ passwordHash: await hashPassword(next) }).where(eq(admins.id, me.id));
  await db.delete(sessions).where(eq(sessions.adminId, me.id)); // sign out everywhere else
  await createSession(me.id);
  return { ok: true };
}

// ---- admin management (super admin only) --------------------------------

export async function createAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!USERNAME_RE.test(username)) return { error: "The username needs 3 to 40 letters, numbers, spaces, dots, dashes or underscores." };
  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters for the password.` };

  const db = getDb();
  if (await db.query.admins.findFirst({ where: eq(admins.usernameLower, username.toLowerCase()) })) return { error: "That username is already taken." };

  await db.insert(admins).values({
    id: crypto.randomUUID(), username, usernameLower: username.toLowerCase(), passwordHash: await hashPassword(password),
    role: "admin", isActive: true, profileComplete: false, createdAt: Date.now(), createdBy: me.id,
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateAdminAction(id: string, data: { username: string; fullName: string; email: string; phone: string }): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const username = data.username.trim();
  if (!USERNAME_RE.test(username)) return { error: "The username needs 3 to 40 letters, numbers, spaces, dots, dashes or underscores." };
  const fullName = data.fullName.trim(), email = data.email.trim(), phone = data.phone.trim();
  if (fullName || email || phone) {
    const problem = checkDetails(fullName, email, phone);
    if (problem) return { error: problem };
  }
  const db = getDb();
  const clash = await db.query.admins.findFirst({ where: and(eq(admins.usernameLower, username.toLowerCase()), ne(admins.id, id)) });
  if (clash) return { error: "That username is already taken." };

  await db.update(admins).set({ username, usernameLower: username.toLowerCase(), fullName: fullName || null, email: email || null, phone: phone || null }).where(eq(admins.id, id));
  revalidatePath("/settings");
  return {};
}

export async function resetAdminPasswordAction(id: string, password: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters for the password.` };
  const db = getDb();
  await db.update(admins).set({ passwordHash: await hashPassword(password) }).where(eq(admins.id, id));
  await db.delete(sessions).where(eq(sessions.adminId, id)); // they must sign in again with the new password
  revalidatePath("/settings");
  return {};
}

export async function setAdminActiveAction(id: string, active: boolean): Promise<{ error?: string }> {
  const me = await requireSuperAdmin();
  if (id === me.id) return { error: "You cannot deactivate your own account." };
  const db = getDb();
  const target = await db.query.admins.findFirst({ where: eq(admins.id, id) });
  if (!target) return { error: "This admin no longer exists." };
  if (target.role === "super_admin") return { error: "The super admin account cannot be deactivated." };
  await db.update(admins).set({ isActive: active }).where(eq(admins.id, id));
  if (!active) await db.delete(sessions).where(eq(sessions.adminId, id));
  revalidatePath("/settings");
  return {};
}
