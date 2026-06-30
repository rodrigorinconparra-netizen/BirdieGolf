import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { listCourses } from "@/lib/courses";
import { getTournamentDefaults } from "@/lib/tournaments";
import { getTeesByCourse } from "@/lib/tees";
import { PageHeader } from "@/components/ui/page-header";
import { TournamentCreateForm } from "@/components/tournament-create-form";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>;
}) {
  const sp = await searchParams;
  const leagueId = sp.league ? Number(sp.league) : null;
  const courses = (await listCourses()).map((c) => ({ id: c.id, name: c.name }));
  const teesByCourse = await getTeesByCourse();
  const today = new Date().toISOString().slice(0, 10);

  // When creating inside a league, pre-fill with the league's saved defaults.
  const defaults = leagueId ? await getTournamentDefaults(leagueId) : null;

  return (
    <>
      <Link
        href={leagueId ? `/tournaments/${leagueId}` : "/tournaments"}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> {leagueId ? "Liga" : "Torneos"}
      </Link>

      <PageHeader
        title={leagueId ? "Nuevo torneo de la liga" : "Crear torneo"}
        subtitle={
          leagueId
            ? "Formará parte de la liga (solo participan sus miembros). Hemos pre-rellenado los valores por defecto."
            : "Crea un torneo de un día o una liga e invita a quien quieras."
        }
      />

      <TournamentCreateForm
        leagueId={leagueId}
        courses={courses}
        teesByCourse={teesByCourse}
        today={today}
        defCourse={defaults?.courseId != null ? String(defaults.courseId) : ""}
        defVisibility={defaults?.visibility ?? "public"}
        defStart={defaults?.startType ?? "progressive"}
        defInterval={defaults?.intervalMinutes ?? 10}
      />
    </>
  );
}
