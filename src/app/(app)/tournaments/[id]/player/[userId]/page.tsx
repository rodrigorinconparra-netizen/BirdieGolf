import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ScrollText } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import {
  getTournament,
  getLeagueRoundIds,
  getTournamentRoundIds,
  getLeagueStandings,
} from "@/lib/tournaments";
import { getDashboardDataForRounds } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { PlayerDashboard } from "@/components/player-dashboard";

export const dynamic = "force-dynamic";

export default async function PlayerTournamentDashboard({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const { id, userId } = await params;
  const tid = Number(id);
  const uid = Number(userId);
  const session = await getSession();
  if (!session) notFound();

  const data = await getTournament(tid, session.userId);
  if (!data) notFound();

  const { tournament: t, canManage, isMember } = data;
  const canView = isMember || canManage || t.visibility === "public";
  if (!canView) notFound();

  const isLeague = t.format === "league";

  // Resolve the player's name (league players aren't on the league row itself).
  let name = data.participants.find((p) => p.userId === uid)?.name ?? null;
  if (!name && isLeague) {
    const standings = await getLeagueStandings(t.id);
    name = standings.find((s) => s.userId === uid)?.name ?? null;
  }
  name = name ?? "Jugador";

  const roundIds = isLeague
    ? await getLeagueRoundIds(t.id, uid)
    : await getTournamentRoundIds(t.id, uid);

  const dash = await getDashboardDataForRounds(uid, roundIds);

  // For a single tournament, offer a link to the full scorecard.
  const participant = !isLeague ? (data.participants.find((p) => p.userId === uid) ?? null) : null;

  return (
    <>
      <Link
        href={`/tournaments/${t.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> {t.name}
      </Link>

      <PageHeader
        title={name}
        subtitle={
          isLeague
            ? `Rendimiento en la liga · ${roundIds.length} torneo(s) jugado(s)`
            : `Rendimiento en ${t.name}`
        }
        action={
          participant ? (
            <Link href={`/tournaments/${t.id}/card/${participant.id}`} className="btn-ghost">
              <ScrollText className="h-4 w-4" /> Ver tarjeta
            </Link>
          ) : null
        }
      />

      <PlayerDashboard data={dash} />
    </>
  );
}
