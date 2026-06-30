import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Trash2, Flag, Pencil, Milestone } from "lucide-react";
import { getCourseWithHoles } from "@/lib/courses";
import { getCourseTees } from "@/lib/tees";
import { getSession } from "@/lib/auth/session";
import { deleteCourse } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const isAdmin = session?.role === "superadmin";
  const data = await getCourseWithHoles(Number(id));
  if (!data) notFound();

  const { course, holes } = data;
  const place = [course.city, course.region, course.country].filter(Boolean).join(", ");
  const totalDistance = holes.reduce((s, h) => s + (h.distanceMeters ?? 0), 0);
  const tees = await getCourseTees(course.id);
  const genderLabel: Record<string, string> = {
    men: "Caballeros",
    women: "Damas",
    any: "Mixta",
  };

  return (
    <>
      <Link
        href="/courses"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Campos
      </Link>

      <PageHeader
        title={course.name}
        subtitle={place || undefined}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={course.source === "api" ? "accent" : "neutral"}>
              {course.source === "api" ? "Importado" : "Manual"}
            </Badge>
            {isAdmin ? (
              <Link href={`/courses/${course.id}/edit`} className="btn-ghost">
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass p-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
            <Flag className="h-5 w-5" />
          </span>
          <p className="mt-3 text-2xl font-semibold">{course.holesCount}</p>
          <p className="text-sm text-muted">Hoyos</p>
        </div>
        <div className="glass p-5">
          <p className="text-2xl font-semibold">{course.par ?? "—"}</p>
          <p className="text-sm text-muted">Par total</p>
        </div>
        <div className="glass p-5">
          <p className="text-2xl font-semibold">
            {totalDistance ? totalDistance.toLocaleString("es-ES") : "—"}
            {totalDistance ? <span className="text-sm text-faint"> m</span> : null}
          </p>
          <p className="text-sm text-muted">Distancia total</p>
        </div>
      </div>

      <div className="glass overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-black/5 px-5 py-4">
          <MapPin className="h-4 w-4 text-accent" />
          <h3 className="font-semibold">Recorrido</h3>
        </div>
        {holes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Este campo no tiene hoyos registrados.</p>
        ) : (
          <div className="grid grid-cols-[3rem_1fr_1fr_1fr] text-sm">
            <div className="contents text-xs font-medium text-faint">
              <span className="px-5 py-2">Hoyo</span>
              <span className="px-3 py-2">Par</span>
              <span className="px-3 py-2">Dist (m)</span>
              <span className="px-3 py-2">SI</span>
            </div>
            {holes.map((h) => (
              <div key={h.id} className="contents">
                <span className="border-t border-black/5 px-5 py-2.5 font-medium text-muted">
                  {h.number}
                </span>
                <span className="border-t border-black/5 px-3 py-2.5">{h.par}</span>
                <span className="border-t border-black/5 px-3 py-2.5">
                  {h.distanceMeters ?? "—"}
                </span>
                <span className="border-t border-black/5 px-3 py-2.5">
                  {h.strokeIndex ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-black/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <Milestone className="h-4 w-4 text-accent" />
            <h3 className="font-semibold">Barras de salida</h3>
          </div>
          {isAdmin ? (
            <Link href={`/courses/${course.id}/tees`} className="btn-ghost">
              <Pencil className="h-4 w-4" /> Editar barras
            </Link>
          ) : null}
        </div>
        {tees.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">
            Este campo aún no tiene barras de salida registradas.
            {isAdmin ? " Añádelas con «Editar barras»." : ""}
          </p>
        ) : (
          <div className="divide-y divide-black/5">
            {tees.map((tee) => (
              <div key={tee.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="flex items-center gap-2.5">
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-black/15"
                    style={{ backgroundColor: tee.color ?? "#e5e7eb" }}
                  />
                  <span className="font-medium">{tee.name}</span>
                  <Badge tone="neutral">{genderLabel[tee.gender]}</Badge>
                  {tee.slopeRating ? (
                    <span className="text-xs text-faint">
                      CR {tee.courseRating ?? "—"} · Slope {tee.slopeRating}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm text-muted">
                  {tee.totalMeters ? (
                    <>
                      <span className="font-semibold text-ink">
                        {tee.totalMeters.toLocaleString("es-ES")}
                      </span>{" "}
                      m
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin ? (
        <form action={deleteCourse}>
          <input type="hidden" name="id" value={course.id} />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-2xl border border-negative/20 bg-negative/5 px-4 py-2.5 text-sm font-medium text-negative transition hover:bg-negative/10"
          >
            <Trash2 className="h-4 w-4" /> Eliminar campo
          </button>
        </form>
      ) : null}
    </>
  );
}
