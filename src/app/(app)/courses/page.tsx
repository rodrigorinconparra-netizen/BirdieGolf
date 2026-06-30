import Link from "next/link";
import { MapPin, Search, Plus, Flag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/session";
import { listCourses } from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const session = await getSession();
  const isAdmin = session?.role === "superadmin";
  const items = await listCourses();

  return (
    <>
      <PageHeader
        title="Campos"
        subtitle={
          isAdmin
            ? "Importa campos o créalos manualmente con sus hoyos, par y distancias."
            : "Campos disponibles para asociar a tus vueltas."
        }
        action={
          isAdmin ? (
            <div className="flex gap-2">
              <Link href="/courses/import" className="btn-ghost">
                <Search className="h-4 w-4" /> Importar
              </Link>
              <Link href="/courses/new" className="btn-primary">
                <Plus className="h-4 w-4" /> Campo manual
              </Link>
            </div>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Todavía no hay campos"
          description={
            isAdmin
              ? "Añade el primer campo para poder asociarlo a las vueltas."
              : "Aún no hay campos disponibles. Pídele a un administrador que añada el tuyo."
          }
          action={
            isAdmin ? (
              <Link href="/courses/new" className="btn-primary">
                <Plus className="h-4 w-4" /> Añadir campo
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${c.id}`}
              className="glass p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{c.name}</h3>
                <Badge tone={c.source === "api" ? "accent" : "neutral"}>
                  {c.source === "api" ? "API" : "Manual"}
                </Badge>
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
                <MapPin className="h-3.5 w-3.5" />
                {[c.city, c.region, c.country].filter(Boolean).join(", ") || "Sin ubicación"}
              </p>
              <div className="mt-4 flex gap-4 text-sm text-ink-soft">
                <span className="flex items-center gap-1">
                  <Flag className="h-3.5 w-3.5 text-accent" />
                  {c.holesCount} hoyos
                </span>
                {c.par ? <span>Par {c.par}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
