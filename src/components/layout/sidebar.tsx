"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/jwt";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || role === "superadmin");

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col p-4 md:flex">
      <div className="glass flex h-full flex-col p-4">
        <div className="flex items-center gap-2 px-2 py-2">
          <span className="text-2xl leading-none">🐦</span>
          <span className="text-lg font-semibold tracking-tight">Birdie</span>
        </div>

        <nav className="mt-5 flex flex-1 flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-accent text-white shadow-[0_8px_20px_rgba(58,125,93,0.25)]"
                    : "text-ink-soft hover:bg-black/5",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            );
          })}
        </nav>

        <p className="px-2 text-[11px] text-faint">Birdie · v0.1</p>
      </div>
    </aside>
  );
}
