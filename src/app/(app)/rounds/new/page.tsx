import Link from "next/link";
import { ChevronLeft, MapPin } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listCourses } from "@/lib/courses";
import { listPlayers } from "@/lib/social";
import { getTeesByCourse } from "@/lib/tees";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RoundCreateForm } from "@/components/round-create-form";

export const dynamic = "force-dynamic";

export default async function NewRoundPage() {
  const session = await getSession();
  const courses = await listCourses();
  const teesByCourse = await getTeesByCourse();
  const players = session ? await listPlayers(session.userId) : [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link
        href="/rounds"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Vueltas
      </Link>

      <PageHeader title="Nueva vuelta" subtitle="Elige el campo y la fecha para empezar." />

      {courses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Primero necesitas un campo"
          description="Importa o crea un campo para poder asociarlo a tu vuelta."
          action={
            <Link href="/courses/import" className="btn-primary">
              Añadir un campo
            </Link>
          }
        />
      ) : (
        <RoundCreateForm
          courses={courses}
          teesByCourse={teesByCourse}
          players={players}
          today={today}
        />
      )}
    </>
  );
}
