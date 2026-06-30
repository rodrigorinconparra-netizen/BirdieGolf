import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getTournament } from "@/lib/tournaments";
import { listCourses } from "@/lib/courses";
import { PageHeader } from "@/components/ui/page-header";
import { updateLeagueAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditLeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const data = await getTournament(Number(id), session.userId);
  if (!data || !data.canManage) notFound();

  const t = data.tournament;
  const courses = (await listCourses()).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <Link
        href={`/tournaments/${t.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> {t.name}
      </Link>

      <PageHeader
        title="Editar liga"
        subtitle="Cambia el nombre y los valores por defecto de los torneos de la liga."
      />

      <form action={updateLeagueAction} className="glass space-y-5 p-6">
        <input type="hidden" name="tournamentId" value={t.id} />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Nombre *</span>
          <input name="name" required defaultValue={t.name} className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Visibilidad</span>
          <select name="visibility" defaultValue={t.visibility} className="field">
            <option value="public">Pública</option>
            <option value="private">Privada (solo con invitación)</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">
              Campo por defecto
            </span>
            <select
              name="courseId"
              defaultValue={t.courseId != null ? String(t.courseId) : ""}
              className="field"
            >
              <option value="">Sin campo</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">
              Salidas por defecto
            </span>
            <select name="startType" defaultValue={t.startType} className="field">
              <option value="progressive">Progresivas (por horarios)</option>
              <option value="shotgun">A tiro (todas a la vez)</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">
            Intervalo entre partidas (min)
          </span>
          <input
            type="number"
            name="intervalMinutes"
            min={1}
            defaultValue={t.intervalMinutes}
            className="field"
          />
          <span className="mt-1 block text-xs text-faint">
            Estos valores se pre-rellenan al crear cada torneo de la liga (puedes cambiarlos
            entonces).
          </span>
        </label>

        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            Guardar cambios
          </button>
          <Link href={`/tournaments/${t.id}`} className="btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
