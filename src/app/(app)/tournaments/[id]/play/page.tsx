import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getPlayState } from "@/lib/tournament-play";
import { PageHeader } from "@/components/ui/page-header";
import { TournamentScorecard } from "@/components/tournament-scorecard";

export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournamentId = Number(id);
  const session = await getSession();
  if (!session) notFound();

  const state = await getPlayState(tournamentId, session.userId);

  const back = (
    <Link
      href={`/tournaments/${tournamentId}`}
      className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
    >
      <ChevronLeft className="h-4 w-4" /> Torneo
    </Link>
  );

  if (state.status === "not_member") {
    return (
      <>
        {back}
        <PageHeader title="Mi tarjeta" />
        <div className="glass p-6 text-sm text-muted">No estás inscrito en este torneo.</div>
      </>
    );
  }
  if (state.status === "no_slot") {
    return (
      <>
        {back}
        <PageHeader title="Mi tarjeta" />
        <div className="glass p-6 text-sm text-muted">
          Apúntate primero a un turno desde la página del torneo.
        </div>
      </>
    );
  }
  if (state.status === "not_started") {
    return (
      <>
        {back}
        <PageHeader title="Mi tarjeta" />
        <div className="glass flex items-center gap-2 p-6 text-sm text-muted">
          <Clock className="h-4 w-4" /> El torneo aún no ha empezado.
          {state.startsAtLabel ? ` Empieza el ${state.startsAtLabel}.` : ""}
        </div>
      </>
    );
  }
  if (state.status === "no_group") {
    return (
      <>
        {back}
        <PageHeader title="Mi tarjeta" />
        <div className="glass flex items-center gap-2 p-6 text-sm text-muted">
          <Clock className="h-4 w-4" /> Aún no tienes partida asignada. Cuando se cierre la
          inscripción y se generen las partidas, podrás marcar tu tarjeta.
        </div>
      </>
    );
  }

  return (
    <>
      {back}
      <PageHeader
        title="Mi tarjeta"
        subtitle={state.teeTimeLabel ? `Tu salida: ${state.teeTimeLabel}` : undefined}
      />
      <TournamentScorecard
        tournamentId={state.tournamentId}
        participantId={state.participantId}
        group={state.group}
        marker={state.marker}
        holes={state.holes}
        bag={state.bag}
        wantsDetail={state.wantsDetail}
        signed={state.signed}
        savedRoundId={state.roundId}
      />
    </>
  );
}
