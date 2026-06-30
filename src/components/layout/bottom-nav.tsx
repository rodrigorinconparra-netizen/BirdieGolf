"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/jwt";

/** Mobile bottom bar (downbar): the main destinations. Secondary items live in the navbar menu. */
export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (i) => i.primary && (!i.adminOnly || role === "superadmin"),
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] md:hidden">
      <div className="glass flex items-center justify-around px-2 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition",
                active ? "text-accent" : "text-faint",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
