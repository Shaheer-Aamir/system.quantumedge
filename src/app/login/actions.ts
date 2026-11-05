"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { DUMMY_HASH, verifyPassword } from "@/lib/crypto";
import { clearLoginFailures, loginBlockedMinutes, recordLoginFailure } from "@/lib/rate-limit";

export type LoginState = { error?: string };

async function clientIp() {
  const h = await headers();
  // The host sets these itself (Netlify, then Cloudflare), so a visitor cannot fake them.
  return h.get("x-nf-client-connection-ip") ?? h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const db = getDb();
  const ip = await clientIp();
  const key = username.toLowerCase().slice(0, 60);

  const blocked = await loginBlockedMinutes(db, ip, key);
  if (blocked) return { error: `Too many failed attempts. Try again in ${blocked} minute${blocked === 1 ? "" : "s"}.` };

  const admin = await db.query.admins.findFirst({ where: eq(admins.usernameLower, username.toLowerCase()) });

  // Always run one hash check so unknown usernames take as long as wrong passwords.
  const valid = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !valid || !admin.isActive) {
    await recordLoginFailure(db, ip, key);
    return { error: "Username or password is incorrect." };
  }

  await clearLoginFailures(db, ip, key);
  await createSession(admin.id);
  redirect("/overview");
}
