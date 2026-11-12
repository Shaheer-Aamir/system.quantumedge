import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const admins = sqliteTable(
  "admins",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    usernameLower: text("username_lower").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["super_admin", "admin"] }).notNull().default("admin"),
    fullName: text("full_name"),
    email: text("email"),
    phone: text("phone"),
    avatar: text("avatar"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    profileComplete: integer("profile_complete", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by"),
  },
  (t) => [uniqueIndex("admins_username_lower_idx").on(t.usernameLower)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // SHA-256 of the cookie token
    adminId: text("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("sessions_admin_idx").on(t.adminId), index("sessions_expires_idx").on(t.expiresAt)],
);

export type Admin = typeof admins.$inferSelect;

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    company: text("company"),
    contactName: text("contact_name"),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    email: text("email"),
    status: text("status", { enum: ["new", "contacted", "meeting_booked", "closed", "dead"] }).notNull().default("new"),
    notes: text("notes"),
    extra: text("extra"), // JSON object of imported columns that were not mapped
    assignedTo: text("assigned_to").references(() => admins.id, { onDelete: "set null" }),
    source: text("source", { enum: ["manual", "import"] }).notNull().default("manual"),
    createdBy: text("created_by").references(() => admins.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("leads_phone_idx").on(t.phoneNormalized),
    index("leads_status_idx").on(t.status),
    index("leads_assigned_idx").on(t.assignedTo),
  ],
);

export const calls = sqliteTable(
  "calls",
  {
    id: text("id").primaryKey(),
    adminId: text("admin_id").notNull().references(() => admins.id),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    outcome: text("outcome", { enum: ["no_answer", "failed", "couldnt_talk", "not_interested", "follow_up", "meeting_booked"] }).notNull(),
    notes: text("notes"),
    calledAt: integer("called_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("calls_called_at_idx").on(t.calledAt), index("calls_admin_idx").on(t.adminId), index("calls_lead_idx").on(t.leadId)],
);

export const meetings = sqliteTable(
  "meetings",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    callId: text("call_id").references(() => calls.id, { onDelete: "set null" }),
    adminId: text("admin_id").notNull().references(() => admins.id),
    title: text("title").notNull(),
    startsAt: integer("starts_at").notNull(),
    durationMin: integer("duration_min").notNull().default(30),
    status: text("status", { enum: ["scheduled", "completed", "no_show", "cancelled"] }).notNull().default("scheduled"),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("meetings_starts_idx").on(t.startsAt), index("meetings_admin_idx").on(t.adminId)],
);

export const scripts = sqliteTable("scripts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull().default(""),
  createdBy: text("created_by").references(() => admins.id, { onDelete: "set null" }),
  updatedBy: text("updated_by").references(() => admins.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    client: text("client"),
    status: text("status", { enum: ["ongoing", "completed", "on_hold", "cancelled"] }).notNull().default("ongoing"),
    agreedCents: integer("agreed_cents").notNull().default(0),
    upfrontCents: integer("upfront_cents").notNull().default(0), // part of the agreed amount charged upfront
    ownerId: text("owner_id").references(() => admins.id),
    startedAt: integer("started_at"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => admins.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("projects_status_idx").on(t.status), index("projects_owner_idx").on(t.ownerId)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    rate: real("rate").notNull(), // PKR per 1 USD when the payment was received
    receivedAt: integer("received_at").notNull(),
    note: text("note"),
    createdBy: text("created_by").references(() => admins.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("payments_project_idx").on(t.projectId), index("payments_received_idx").on(t.receivedAt)],
);

export const loginFailures = sqliteTable(
  "login_failures",
  {
    id: text("id").primaryKey(),
    ip: text("ip").notNull(),
    usernameLower: text("username_lower").notNull(),
    at: integer("at").notNull(),
  },
  (t) => [index("login_failures_pair_idx").on(t.ip, t.usernameLower, t.at), index("login_failures_at_idx").on(t.at)],
);
