import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ProfileForm } from "./profile-form";

export default async function CompleteProfilePage() {
  const admin = await requireAdmin();
  if (admin.profileComplete) redirect("/overview");

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{ background: "radial-gradient(ellipse 70% 55% at 50% 0%, var(--glow), transparent 70%), var(--bg)" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Logo height={56} />
          <p className="text-sm text-muted">Cold Calling Tracker</p>
        </div>
        <section className="relative overflow-hidden rounded-2xl border border-line bg-surface/70 p-8 backdrop-blur">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ice to-transparent" />
          <h1 className="text-2xl font-semibold">Complete your profile</h1>
          <p className="mb-7 mt-2 text-sm text-muted">Your calls and meetings are tagged with these details.</p>
          <ProfileForm
            username={admin.username}
            defaults={{ fullName: admin.fullName ?? "", email: admin.email ?? "", phone: admin.phone ?? "", avatar: admin.avatar }}
          />
        </section>
      </div>
    </main>
  );
}
