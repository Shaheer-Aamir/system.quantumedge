import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { admins, payments, projects, settings } from "@/db/schema";
import { RATE_KEY } from "./money";
import type { Db } from "@/db/types";



const collectedCents = sql<number>`coalesce((select sum(${payments.amountCents}) from ${payments} where ${payments.projectId} = ${projects.id}), 0)`;
const collectedPkrCents = sql<number>`coalesce((select sum(${payments.amountCents} * ${payments.rate}) from ${payments} where ${payments.projectId} = ${projects.id}), 0)`;
const lastPaidAt = sql<number | null>`(select max(${payments.receivedAt}) from ${payments} where ${payments.projectId} = ${projects.id})`;

export async function getRate(db: Db) {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, RATE_KEY) });
  return row ? { rate: Number(row.value), updatedAt: row.updatedAt } : null;
}

export async function listProjects(db: Db, ownerId: string) {
  return db
    .select({ p: projects, ownerName: admins.fullName, ownerUser: admins.username, collectedCents, collectedPkrCents, lastPaidAt })
    .from(projects)
    .leftJoin(admins, eq(projects.ownerId, admins.id))
    .where(ownerId ? eq(projects.ownerId, ownerId) : undefined)
    .orderBy(desc(projects.createdAt));
}

export async function paymentTotals(db: Db, ownerId: string, from?: number, to?: number) {
  const [row] = await db
    .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`, pkrCents: sql<number>`coalesce(sum(${payments.amountCents} * ${payments.rate}), 0)`, n: sql<number>`count(*)` })
    .from(payments)
    .innerJoin(projects, eq(payments.projectId, projects.id))
    .where(and(from !== undefined ? gte(payments.receivedAt, from) : undefined, to !== undefined ? lt(payments.receivedAt, to) : undefined, ownerId ? eq(projects.ownerId, ownerId) : undefined));
  return { cents: Number(row.cents), pkr: Number(row.pkrCents) / 100, count: Number(row.n) };
}

export async function paymentsInRange(db: Db, ownerId: string, from: number, to: number) {
  return db
    .select({ pay: payments, project: projects.name, client: projects.client, addedBy: admins.fullName, addedUser: admins.username })
    .from(payments)
    .innerJoin(projects, eq(payments.projectId, projects.id))
    .leftJoin(admins, eq(payments.createdBy, admins.id))
    .where(and(gte(payments.receivedAt, from), lt(payments.receivedAt, to), ownerId ? eq(projects.ownerId, ownerId) : undefined))
    .orderBy(desc(payments.receivedAt));
}
