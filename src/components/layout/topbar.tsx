import Link from "next/link";
import { LogOut, Bell } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { MobileNavMenu } from "@/components/layout/mobile-nav-menu";
import { unreadNotificationCount } from "@/lib/social";
import type { SessionPayload } from "@/lib/auth/jwt";

export async function Topbar({ user }: { user: SessionPayload }) {
  const unread = await unreadNotificationCount(user.userId);
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-6 px-4 pt-[calc(1rem_+_env(safe-area-inset-top))] sm:-mx-6 sm:px-6">
      <div className="glass flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MobileNavMenu role={user.role} />
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-xl leading-none">🐦</span>
            <span className="font-semibold tracking-tight">Birdie</span>
          </div>
          <p className="hidden text-sm text-muted md:block">
            Hola, <span className="font-medium text-ink">{user.name.split(" ")[0]}</span> 👋
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user.role === "superadmin" ? <Badge tone="accent">Superadmin</Badge> : null}
          <Link
            href="/notifications"
            title="Notificaciones"
            className="relative grid h-9 w-9 place-items-center rounded-full border border-black/8 bg-white/70 text-ink-soft transition hover:bg-white"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-negative px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
          <Link
            href="/profile"
            title="Tu perfil y bolsa"
            className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-semibold text-white transition hover:bg-accent-deep"
          >
            {initials}
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="btn-ghost h-9 w-9 !px-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
