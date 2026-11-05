"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { admins, payments, projects, settings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { RATE_KEY, parseMoneyToCents, parseRate } from "@/lib/money";
import { PROJECT_STATUS_VALUES, type ProjectStatus } from "@/lib/project-status";
import { dayRange, isYmd } from "@/lib/time";
import { listAdmins } from "@/lib/queries";

type Result = { error?: string };
export type ProjectInput = { name: string; client: string; status: string; agreed: string; upfront: string; startedOn: string; ownerId: string; notes: string };
export type PaymentInput = { amount: string; date: string; rate: string; note: string };

async function clean(i: ProjectInput, me: string) {
  const name = i.name.trim();
  if (!name || name.length > 120) return { error: "Enter a project name under 120 characters." } as const;
  if (!PROJECT_STATUS_VALUES.includes(i.status)) return { error: "Choose a status." } as const;
  const agreed = i.agreed.trim() === "" ? 0 : parseMoneyToCents(i.agreed);
  if (agreed === null) return { error: "Enter the agreed amount in USD, for example 1500 or 1500.50." } as const;
  const upfront = i.upfront.trim() === "" ? 0 : parseMoneyToCents(i.upfront);
  if (upfront === null) return { error: "Enter the upfront amount in USD, for example 500." } as const;
  if (upfront > 0 && agreed === 0) return { error: "Enter the total agreed amount before the upfront amount." } as const;
  if (upfront > agreed) return { error: "The upfront amount cannot be more than the total agreed amount." } as const;
  if (i.startedOn && !isYmd(i.startedOn)) return { error: "Enter a valid start date." } as const;
  const ids = (await listAdmins()).map((a) => a.id);
  return {
    value: {
      name, client: i.client.trim().slice(0, 120) || null, status: i.status as ProjectStatus, agreedCents: agreed, upfrontCents: upfront,
      startedAt: i.startedOn ? dayRange(i.startedOn)[0] + 12 * 3_600_000 : null,
      ownerId: ids.includes(i.ownerId) ? i.ownerId : me, notes: i.notes.trim().slice(0, 1000) || null,
    },
  } as const;
}

function cleanPayment(i: PaymentInput) {
  const cents = parseMoneyToCents(i.amount);
  if (!cents) return { error: "Enter the amount received in USD, for example 500 or 500.50." } as const;
  const rate = parseRate(i.rate);
  if (!rate) return { error: "Enter the USD to PKR rate, for example 280.50." } as const;
  if (!isYmd(i.date)) return { error: "Pick the date the money was received." } as const;
  const receivedAt = dayRange(i.date)[0] + 12 * 3_600_000;
  if (receivedAt > Date.now() + 86_400_000) return { error: "The payment date cannot be in the future." } as const;
  return { value: { amountCents: cents, rate, receivedAt, note: i.note.trim().slice(0, 300) || null } } as const;
}

async function manageable(projectId: string) {
  const admin = await requireAdmin();
  const project = await getDb().query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return { admin, project: null, allowed: false };
  return { admin, project, allowed: admin.role === "super_admin" || project.ownerId === admin.id || project.createdBy === admin.id };
}

// If upfrontPayment is given, the upfront amount has already been received and is recorded as the first payment.
export async function createProjectAction(input: ProjectInput, upfrontPayment: { date: string; rate: string } | null): Promise<Result> {
  const admin = await requireAdmin();
  const c = await clean(input, admin.id);
  if ("error" in c) return { error: c.error };

  let first: ReturnType<typeof cleanPayment> | null = null;
  if (upfrontPayment && c.value.upfrontCents > 0) {
    first = cleanPayment({ amount: String(c.value.upfrontCents / 100), date: upfrontPayment.date, rate: upfrontPayment.rate, note: "Upfront payment" });
    if ("error" in first) return { error: first.error };
  }

  const db = getDb();
  const now = Date.now();
  const projectId = crypto.randomUUID();
  await db.insert(projects).values({ id: projectId, ...c.value, createdBy: admin.id, createdAt: now, updatedAt: now });
  if (first && "value" in first) {
    await db.insert(payments).values({ id: crypto.randomUUID(), projectId, ...first.value, createdBy: admin.id, createdAt: now });
  }
  revalidatePath("/projects");
  return {};
}

export async function updateProjectAction(id: string, input: ProjectInput): Promise<Result> {
  const { admin, project, allowed } = await manageable(id);
  if (!project) return { error: "This project no longer exists." };
  if (!allowed) return { error: "Only the project owner or the super admin can change this project." };
  const c = await clean(input, admin.id);
  if ("error" in c) return { error: c.error };
  await getDb().update(projects).set({ ...c.value, updatedAt: Date.now() }).where(eq(projects.id, id));
  revalidatePath("/projects");
  return {};
}

export async function deleteProjectAction(id: string): Promise<Result> {
  const { project, allowed } = await manageable(id);
  if (!project) return {};
  if (!allowed) return { error: "Only the project owner or the super admin can delete this project." };
  await getDb().delete(projects).where(eq(projects.id, id));
  revalidatePath("/projects");
  return {};
}

export async function getProjectPaymentsAction(projectId: string) {
  await requireAdmin();
  const rows = await getDb()
    .select({ pay: payments, name: admins.fullName, user: admins.username })
    .from(payments).leftJoin(admins, eq(payments.createdBy, admins.id))
    .where(eq(payments.projectId, projectId)).orderBy(desc(payments.receivedAt));
  return rows.map(({ pay, name, user }) => ({
    id: pay.id, amountCents: pay.amountCents, rate: pay.rate, receivedAt: pay.receivedAt, note: pay.note, addedBy: name ?? user ?? "Unknown",
  }));
}

export async function addPaymentAction(projectId: string, input: PaymentInput): Promise<Result> {
  const { admin, project, allowed } = await manageable(projectId);
  if (!project) return { error: "This project no longer exists." };
  if (!allowed) return { error: "Only the project owner or the super admin can add payments." };
  const c = cleanPayment(input);
  if ("error" in c) return { error: c.error };
  await getDb().insert(payments).values({ id: crypto.randomUUID(), projectId, ...c.value, createdBy: admin.id, createdAt: Date.now() });
  revalidatePath("/projects");
  return {};
}

export async function updatePaymentAction(id: string, input: PaymentInput): Promise<Result> {
  const admin = await requireAdmin();
  const db = getDb();
  const pay = await db.query.payments.findFirst({ where: eq(payments.id, id) });
  if (!pay) return { error: "This payment no longer exists." };
  const { allowed } = await manageable(pay.projectId);
  if (!allowed && pay.createdBy !== admin.id) return { error: "Only the project owner or the super admin can change payments." };
  const c = cleanPayment(input);
  if ("error" in c) return { error: c.error };
  await db.update(payments).set(c.value).where(eq(payments.id, id));
  revalidatePath("/projects");
  return {};
}

export async function deletePaymentAction(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const db = getDb();
  const pay = await db.query.payments.findFirst({ where: eq(payments.id, id) });
  if (!pay) return {};
  const { allowed } = await manageable(pay.projectId);
  if (!allowed && pay.createdBy !== admin.id) return { error: "Only the project owner or the super admin can delete payments." };
  await db.delete(payments).where(eq(payments.id, id));
  revalidatePath("/projects");
  return {};
}

export async function setRateAction(input: string): Promise<Result> {
  await requireAdmin();
  const rate = parseRate(input);
  if (!rate) return { error: "Enter a rate between 1 and 10,000, for example 280.50." };
  const now = Date.now();
  await getDb().insert(settings).values({ key: RATE_KEY, value: String(rate), updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(rate), updatedAt: now } });
  revalidatePath("/projects");
  revalidatePath("/settings");
  return {};
}
