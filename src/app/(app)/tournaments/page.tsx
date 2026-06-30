import Link from "next/link";
import { Trophy, Plus } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listTournaments } from "@/lib/tournaments";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TournamentList } from "@/components/tournament-list";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const session = await getSession();
  const items = session ? await listTournaments(session.userId) : [];

  return (
    <>
      <PageHeader
        title="Torneos"
        subtitle="Crea torneos de un día o ligas, apúntate a turnos y compite."
        action={
          <Link href="/tournaments/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Crear torneo
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Aún no hay torneos"
          description="Crea tu primer torneo e invita a tus amigos por enlace o WhatsApp."
          action={
            <Link href="/tournaments/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Crear torneo
            </Link>
          }
        />
      ) : (
        <TournamentList items={items} />
      )}
    </>
  );
}
