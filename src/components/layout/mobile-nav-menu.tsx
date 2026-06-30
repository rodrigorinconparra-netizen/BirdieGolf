"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/jwt";

/** Mobile navigation: lives in the top bar (navbar) as a menu button. */
export function MobileNavMenu({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere outside the menu, or pressing Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The bottom bar holds the primary items; the navbar menu holds the rest.
  const items = NAV_ITEMS.filter(
    (i) => !i.primary && (!i.adminOnly || role === "superadmin"),
  );
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={(e) => {
          setOpen((o) => !o);
          e.currentTarget.blur();
        }}
        aria-label="Menú"
        aria-expanded={open}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl border border-black/8 text-ink-soft outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-accent/40",
          open ? "bg-white text-accent" : "bg-white/70",
        )}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open ? (
        <>
          <div className="absolute left-0 top-full z-50 mt-2 w-64 origin-top-left animate-[menuIn_140ms_ease-out]">
            <div className="max-h-[75vh] space-y-0.5 overflow-auto rounded-2xl border border-black/10 bg-white p-1.5 shadow-[0_18px_44px_rgba(28,28,30,0.18)]">
              {items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      active
                        ? "bg-accent text-white shadow-[0_6px_16px_rgba(58,125,93,0.28)]"
                        : "text-ink-soft hover:bg-sand-deep/40",
                    )}
                  >
                    <Icon
                      className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-muted")}
                    />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
