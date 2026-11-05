import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getRate } from "@/lib/project-queries";
import { getTheme } from "@/lib/theme";
import { PageHeader } from "@/components/coming-soon";
import { RateControl } from "../projects/rate-control";
import { AdminsCard, type AdminRow } from "./admins-card";
import { AppearanceCard } from "./appearance-card";
import { PasswordCard } from "./password-card";
import { ProfileCard } from "./profile-card";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface/60 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-5 mt-1 text-sm text-muted">{description}</p>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const me = await requireAdmin();
  const isSuper = me.role === "super_admin";
  const db = getDb();
  const [theme, rate, rows] = await Promise.all([
    getTheme(), getRate(db),
    isSuper ? db.select().from(admins).orderBy(asc(admins.createdAt)) : Promise.resolve([]),
  ]);
  const people: AdminRow[] = rows.map((r) => ({
    id: r.id, username: r.username, fullName: r.fullName, email: r.email, phone: r.phone, avatar: r.avatar,
    role: r.role, isActive: r.isActive, profileComplete: r.profileComplete, createdAt: r.createdAt,
  }));

  return (
    <>
      <PageHeader title="Settings" description="Your profile, how the dashboard looks, and who can sign in." />
      <div className="space-y-6">
        <Section title="Your profile" description="This is how you appear on calls, meetings and projects.">
          <ProfileCard me={{ username: me.username, fullName: me.fullName ?? "", email: me.email ?? "", phone: me.phone ?? "", avatar: me.avatar }} />
        </Section>
        <Section title="Password" description="Choose a password only you know.">
          <PasswordCard />
        </Section>
        <Section title="Appearance" description="Applies to this browser.">
          <AppearanceCard initial={theme} />
        </Section>
        <Section title="Exchange rate" description="Used when you record new payments in Projects and earnings.">
          <RateControl rate={rate?.rate ?? null} updatedAt={rate?.updatedAt ?? null} />
        </Section>
        {isSuper && (
          <Section title="Admins" description="Create logins for your callers, update their details, reset passwords or turn off access.">
            <AdminsCard admins={people} meId={me.id} />
          </Section>
        )}
      </div>
    </>
  );
}
