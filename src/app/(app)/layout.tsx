import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Topbar } from "@/components/layout/topbar";
import { PushRegistrar } from "@/components/push-registrar";

// The whole authenticated area depends on the session cookie → always dynamic.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="min-h-full">
      <Sidebar role={user.role} />
      <div className="md:pl-64">
        <div className="mx-auto max-w-6xl px-4 pb-[calc(7rem_+_env(safe-area-inset-bottom))] sm:px-6 md:pb-12">
          <Topbar user={user} />
          <main className="space-y-6">{children}</main>
        </div>
      </div>
      <BottomNav role={user.role} />
      <PushRegistrar />
    </div>
  );
}
