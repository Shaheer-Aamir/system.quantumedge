import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getTheme } from "@/lib/theme";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin.profileComplete) redirect("/complete-profile");
  const theme = await getTheme();

  return (
    <div className="min-h-screen">
      <Sidebar
        admin={{
          name: admin.fullName ?? admin.username,
          roleLabel: admin.role === "super_admin" ? "Super admin" : "Admin",
          avatar: admin.avatar,
        }}
        theme={theme}
      />
      <div className="lg:pl-72">
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
