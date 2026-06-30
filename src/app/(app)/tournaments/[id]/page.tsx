import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Clock,
  Users,
  Plus,
  Trash2,
  Lock,
  Trophy,
  Calendar,
  MapPin,
  Check,
  PenLine,
  CalendarClock,
  Send,
  Flag,
  ListChecks,
  Pencil,
  UserPlus,
  Shield,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import {
  getTournament,
  getLeagueChildren,
  getLeagueStandings,
  generateGroups,
} from "@/lib/tournaments";
import { getTournamentLeaderboard, getTournamentCardStatuses } from "@/lib/tournament-play";
import { signParticipantCardAction } from "../play-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { TournamentShare } from "@/components/tournament-share";
import {
  addSlotAction,
  deleteSlotAction,
  signUpToSlotAction,
  leaveSlotAction,
  joinTournamentAction,
  leaveTournamentAction,
  deleteTournamentAction,
  generatePairingsAction,
  publishPairingsAction,
  updateGroupAction,
  addGroupAction,
  deleteGroupAction,
  moveParticipantAction,
  removeParticipantAction,
  addOrganizerAction,
  removeOrganizerAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) notFound();

  let data = await getTournament(Number(id), session.userId);
  if (!data) notFound();

  // When registration closes, auto-generate the partidas (once).
  if (
    data.tournament.format !== "league" &&
    data.deadlinePassed &&
    data.groups.length === 0 &&
    data.participants.some((p) => p.slotId)
  ) {
    await generateGroups(data.tournament.id);
    data = await getTournament(Number(id), session.userId);
    if (!data) notFound();
  }

  const {
    tournament: t,
    course,
    ownerName,
    slots,
    participants,
    organizers,
    groups,
    me,
    parent,
    isOwner,
    canManage,
    isMember,
    registrationOpen,
    deadlinePassed,
    started,
    pairingsVisible,
  } = data;
  const invite = sp.invite ?? null;
  const canJoin = isMember || canManage || t.visibility === "public" || invite === t.inviteCode;
  const canView = canJoin || isMember;

  // ----- League container view -----
  if (t.format === "league") {
    if (!canView) {
      return (
        <>
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" /> Torneos
          </Link>
          <PageHeader title={t.name} subtitle="Liga privada" />
          <div className="glass flex items-center gap-2 p-5 text-sm text-muted">
            <Lock className="h-4 w-4" /> Liga privada. Necesitas un enlace de invitación.
          </div>
        </>
      );
    }
    const children = await getLeagueChildren(t.id);
    const standings = await getLeagueStandings(t.id);
    return (
      <>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" /> Torneos
        </Link>

        <PageHeader
          title={t.name}
          subtitle="Liga"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <TournamentShare tournamentId={t.id} code={t.inviteCode} name={t.name} />
              {canManage ? (
                <Link
                  href={`/tournaments/${t.id}/edit`}
                  title="Editar liga"
                  className="grid h-9 w-9 place-items-center rounded-2xl border border-black/10 text-ink-soft transition hover:bg-black/5"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              ) : null}
              {isOwner ? (
                <form action={deleteTournamentAction}>
                  <input type="hidden" name="tournamentId" value={t.id} />
                  <button
                    type="submit"
                    title="Eliminar liga"
                    className="grid h-9 w-9 place-items-center rounded-2xl border border-negative/20 text-negative transition hover:bg-negative/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              ) : null}
            </div>
          }
        />

        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">Liga</Badge>
          <Badge tone="neutral">{t.visibility === "private" ? "Privada" : "Pública"}</Badge>
          <Badge tone="neutral">{children.length} torneos</Badge>
          <Badge tone="neutral">Organiza: {ownerName}</Badge>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-soft">Torneos de la liga</h2>
            {canManage ? (
              <Link href={`/tournaments/new?league=${t.id}`} className="btn-primary">
                <Plus className="h-4 w-4" /> Crear torneo
              </Link>
            ) : null}
          </div>

          {children.length === 0 ? (
            <p className="text-sm text-muted">
              {canManage
                ? "Aún no hay torneos. Crea el primero con el botón de arriba."
                : "La liga aún no tiene torneos."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {children.map((c, i) => (
                <Link key={c.id} href={`/tournaments/${c.id}`} className="glass p-5 transition hover:-translate-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/10 text-xs font-semibold text-accent">
                      {i + 1}
                    </span>
                    <h3 className="font-semibold">{c.name}</h3>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {c.courseName ?? "Sin campo"}
                    </span>
                    {c.playDate ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(c.playDate).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {c.players}
                    </span>
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-soft">Clasificación de la liga</h2>
          <div className="glass overflow-hidden p-0">
            <div className="grid grid-cols-[2.5rem_1fr_5rem_5rem] px-5 py-3 text-xs font-medium text-faint">
              <span>#</span>
              <span>Jugador</span>
              <span className="text-right">Torneos</span>
              <span className="text-right">Puntos</span>
            </div>
            {standings.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Sin participantes todavía.</p>
            ) : (
              standings.map((s, i) => (
                <Link
                  key={s.userId}
                  href={`/tournaments/${t.id}/player/${s.userId}`}
                  className="grid grid-cols-[2.5rem_1fr_5rem_5rem] border-t border-black/5 px-5 py-3 text-sm transition hover:bg-black/[0.02]"
                >
                  <span className="text-muted">{i + 1}</span>
                  <span className="font-medium">
                    {s.name}
                    {s.userId === session.userId ? " (tú)" : ""}
                  </span>
                  <span className="text-right text-ink-soft">{s.events}</span>
                  <span className="text-right text-faint">—</span>
                </Link>
              ))
            )}
          </div>
          <p className="text-xs text-faint">
            Toca un jugador para ver su dashboard en la liga. La puntuación acumulada llegará con
            la Fase 2.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
            <Shield className="h-4 w-4" /> Organizadores
          </h2>
          <div className="glass divide-y divide-black/5 p-0">
            {organizers.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 px-5 py-3">
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{o.name ?? "Jugador"}</span>
                  {o.userId === t.ownerId ? (
                    <Badge tone="accent">Creador</Badge>
                  ) : (
                    <Badge tone="neutral">Organizador</Badge>
                  )}
                  {o.userId === session.userId ? (
                    <span className="text-xs text-faint">(tú)</span>
                  ) : null}
                </span>
                {isOwner && o.userId !== t.ownerId ? (
                  <form action={removeOrganizerAction}>
                    <input type="hidden" name="tournamentId" value={t.id} />
                    <input type="hidden" name="participantId" value={o.id} />
                    <button
                      type="submit"
                      title="Quitar como organizador"
                      className="grid h-8 w-8 place-items-center rounded-xl text-faint transition hover:bg-negative/10 hover:text-negative"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>

          {isOwner ? (
            <form action={addOrganizerAction} className="glass flex flex-wrap items-end gap-2 p-4">
              <input type="hidden" name="tournamentId" value={t.id} />
              <label className="block flex-1">
                <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Añadir organizador (email)
                </span>
                <input
                  name="email"
                  type="email"
                  placeholder="jugador@email.com"
                  className="field"
                />
              </label>
              <button type="submit" className="btn-primary">
                <UserPlus className="h-4 w-4" /> Añadir
              </button>
            </form>
          ) : null}
          {isOwner ? (
            <p className="text-xs text-faint">
              Un organizador puede crear y gestionar los torneos de la liga, pero no puede
              eliminar la liga ni cambiar los organizadores.
            </p>
          ) : null}
        </section>
      </>
    );
  }

  const dateLabel = t.playDate
    ? new Date(t.playDate).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;

  const playersOf = (slotId: number) =>
    participants
      .filter((p) => p.slotId === slotId)
      .map((p) => ({ participantId: p.id, userId: p.userId, name: p.name ?? "Jugador" }));

  const leaderboard = await getTournamentLeaderboard(t.id);
  const cardStatuses = canManage ? await getTournamentCardStatuses(t.id) : [];
  const SCORING_LABEL: Record<string, string> = {
    stroke: "Medal (golpes)",
    stroke_net: "Medal neto",
    stableford: "Stableford",
    stableford_net: "Stableford neto",
  };
  const fmtPar = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);
  const isStableford = leaderboard.format.startsWith("stableford");
  const isNet = leaderboard.format.endsWith("net");
  const lastColLabel = isStableford ? "Puntos" : isNet ? "Neto" : "Par";
  const fmtShort = (d: Date) =>
    new Date(d).toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <Link
        href={parent ? `/tournaments/${parent.id}` : "/tournaments"}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> {parent ? parent.name : "Torneos"}
      </Link>

      <PageHeader
        title={t.name}
        subtitle={[course?.name, dateLabel].filter(Boolean).join(" · ") || undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <TournamentShare tournamentId={t.id} code={t.inviteCode} name={t.name} />
            {isOwner ? (
              <form action={deleteTournamentAction}>
                <input type="hidden" name="tournamentId" value={t.id} />
                <button
                  type="submit"
                  title="Eliminar torneo"
                  className="grid h-9 w-9 place-items-center rounded-2xl border border-negative/20 text-negative transition hover:bg-negative/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{t.visibility === "private" ? "Privado" : "Público"}</Badge>
        <Badge tone="neutral">{parent ? "Torneo de liga" : "Torneo de un día"}</Badge>
        <Badge tone="accent">
          {t.startType === "shotgun"
            ? "Salidas a tiro"
            : `Progresivas · cada ${t.intervalMinutes} min`}
        </Badge>
        <Badge tone="neutral">
          <Users className="h-3 w-3" /> {participants.length} jugadores
        </Badge>
        <Badge tone="neutral">Organiza: {ownerName}</Badge>
      </div>

      {!isMember ? (
        canJoin ? (
          <form action={joinTournamentAction} className="glass flex items-center justify-between gap-3 p-5">
            <p className="text-sm text-muted">Aún no estás en este torneo.</p>
            <input type="hidden" name="tournamentId" value={t.id} />
            {invite ? <input type="hidden" name="invite" value={invite} /> : null}
            <button type="submit" className="btn-primary">
              <Trophy className="h-4 w-4" /> Unirme al torneo
            </button>
          </form>
        ) : (
          <div className="glass flex items-center gap-2 p-5 text-sm text-muted">
            <Lock className="h-4 w-4" /> Torneo privado. Necesitas un enlace de invitación para
            unirte.
          </div>
        )
      ) : null}

      {isMember && started ? (
        <Link
          href={`/tournaments/${t.id}/play`}
          className="glass flex items-center justify-between gap-3 p-5 transition hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
              <PenLine className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Mi tarjeta</p>
              <p className="text-sm text-muted">Entra a marcar tu tarjeta.</p>
            </div>
          </div>
          <span className="text-sm font-medium text-accent">Entrar →</span>
        </Link>
      ) : isMember && !started ? (
        <div className="glass flex items-center gap-2 p-5 text-sm text-muted">
          <CalendarClock className="h-4 w-4" /> El torneo aún no ha empezado. Podrás marcar tu
          tarjeta cuando comience
          {t.startsAt
            ? ` (${new Date(t.startsAt).toLocaleString("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })})`
            : ""}
          .
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-soft">
            {groups.length > 0 ? "Partidas" : "Turnos e inscripción"}
          </h2>
          <span className="text-xs text-faint">
            {registrationOpen
              ? `Inscripción abierta${t.registrationDeadline ? ` · cierra ${fmtShort(t.registrationDeadline)}` : ""}`
              : "Inscripción cerrada"}
          </span>
        </div>

        {groups.length === 0 ? (
          <>
            {slots.length === 0 ? (
              <p className="text-sm text-muted">
                {canManage ? "Añade turnos abajo." : "El organizador aún no ha creado turnos."}
              </p>
            ) : (
              <div className="space-y-3">
                {slots.map((slot) => {
                  const players = playersOf(slot.id);
                  const imHere = me?.slotId === slot.id;
                  return (
                    <div key={slot.id} className="glass p-5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-accent" />
                          <span className="text-lg font-semibold">{slot.startTime}</span>
                          <Badge tone="neutral">{players.length} inscritos</Badge>
                        </div>
                        {canManage ? (
                          <form action={deleteSlotAction}>
                            <input type="hidden" name="tournamentId" value={t.id} />
                            <input type="hidden" name="slotId" value={slot.id} />
                            <button
                              type="submit"
                              title="Eliminar turno"
                              className="grid h-8 w-8 place-items-center rounded-xl text-faint transition hover:bg-negative/10 hover:text-negative"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        ) : null}
                      </div>

                      {players.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {players.map((pl) => (
                            <span
                              key={pl.participantId}
                              className="rounded-full bg-white/70 px-2.5 py-0.5 text-sm"
                            >
                              {pl.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-faint">Aún nadie apuntado.</p>
                      )}

                      <div className="mt-4">
                        {imHere ? (
                          <form action={leaveSlotAction}>
                            <input type="hidden" name="tournamentId" value={t.id} />
                            <button type="submit" className="btn-ghost">
                              Estás en este turno · Quitarme
                            </button>
                          </form>
                        ) : canJoin && registrationOpen ? (
                          <form action={signUpToSlotAction}>
                            <input type="hidden" name="tournamentId" value={t.id} />
                            <input type="hidden" name="slotId" value={slot.id} />
                            {invite ? <input type="hidden" name="invite" value={invite} /> : null}
                            <button type="submit" className="btn-primary">
                              <Plus className="h-4 w-4" /> Apuntarme a este turno
                            </button>
                          </form>
                        ) : !registrationOpen ? (
                          <p className="text-xs text-faint">Inscripción cerrada.</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canManage ? (
              <div className="flex flex-wrap items-end gap-2">
                <form action={addSlotAction} className="glass flex items-end gap-2 p-4">
                  <input type="hidden" name="tournamentId" value={t.id} />
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-ink-soft">Nuevo turno</span>
                    <input
                      name="startTime"
                      placeholder="09:30"
                      pattern="\d{1,2}:\d{2}"
                      className="field w-32"
                    />
                  </label>
                  <button type="submit" className="btn-primary">
                    <Plus className="h-4 w-4" /> Añadir turno
                  </button>
                </form>
                {participants.some((p) => p.slotId) ? (
                  <form action={generatePairingsAction}>
                    <input type="hidden" name="tournamentId" value={t.id} />
                    <button type="submit" className="btn-ghost">
                      <ListChecks className="h-4 w-4" /> Generar partidas ahora
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </>
        ) : pairingsVisible || canManage ? (
          <>
            {canManage ? (
              <div className="glass flex flex-wrap items-center justify-between gap-2 p-4">
                <p className="text-sm text-muted">
                  {pairingsVisible
                    ? "Partidas publicadas (visibles para los jugadores)."
                    : "Partidas en borrador (no visibles aún para los jugadores)."}
                </p>
                <div className="flex gap-2">
                  <form action={generatePairingsAction}>
                    <input type="hidden" name="tournamentId" value={t.id} />
                    <button type="submit" className="btn-ghost">
                      <ListChecks className="h-4 w-4" /> Regenerar
                    </button>
                  </form>
                  {!pairingsVisible ? (
                    <form action={publishPairingsAction}>
                      <input type="hidden" name="tournamentId" value={t.id} />
                      <button type="submit" className="btn-primary">
                        <Send className="h-4 w-4" /> Publicar
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {groups.map((g, i) => {
                const players = participants.filter((p) => p.groupId === g.id);
                return (
                  <div key={g.id} className="glass p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/10 text-xs font-semibold text-accent">
                          {i + 1}
                        </span>
                        <span className="flex items-center gap-1 font-semibold">
                          {t.startType === "shotgun" ? (
                            <>
                              <Flag className="h-4 w-4 text-accent" /> Hoyo {g.startHole ?? "—"}
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 text-accent" /> {g.teeTime ?? "—"}
                            </>
                          )}
                        </span>
                      </div>
                      {canManage ? (
                        <form action={deleteGroupAction}>
                          <input type="hidden" name="tournamentId" value={t.id} />
                          <input type="hidden" name="groupId" value={g.id} />
                          <button
                            type="submit"
                            title="Eliminar partida"
                            className="grid h-8 w-8 place-items-center rounded-xl text-faint transition hover:bg-negative/10 hover:text-negative"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {players.length === 0 ? (
                        <p className="text-sm text-faint">Partida vacía.</p>
                      ) : (
                        players.map((pl) => (
                          <div key={pl.id} className="flex items-center justify-between gap-2">
                            <span className="text-sm">
                              {pl.name ?? "Jugador"}
                              {pl.userId === session.userId ? " (tú)" : ""}
                            </span>
                            {canManage ? (
                              <div className="flex items-center gap-1.5">
                                <form action={moveParticipantAction} className="flex items-center gap-1">
                                  <input type="hidden" name="tournamentId" value={t.id} />
                                  <input type="hidden" name="participantId" value={pl.id} />
                                  <select name="groupId" defaultValue={g.id} className="field !w-auto !py-1 !text-xs">
                                    {groups.map((gg, gi) => (
                                      <option key={gg.id} value={gg.id}>
                                        P{gi + 1} ·{" "}
                                        {t.startType === "shotgun" ? `H${gg.startHole ?? "-"}` : gg.teeTime ?? "-"}
                                      </option>
                                    ))}
                                  </select>
                                  <button type="submit" className="btn-ghost !px-2 !py-1 !text-xs">
                                    Mover
                                  </button>
                                </form>
                                <form action={removeParticipantAction}>
                                  <input type="hidden" name="tournamentId" value={t.id} />
                                  <input type="hidden" name="participantId" value={pl.id} />
                                  <button
                                    type="submit"
                                    title="Quitar del torneo"
                                    className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:text-negative"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>

                    {canManage ? (
                      <form
                        action={updateGroupAction}
                        className="mt-3 flex flex-wrap items-end gap-2 border-t border-black/5 pt-3"
                      >
                        <input type="hidden" name="tournamentId" value={t.id} />
                        <input type="hidden" name="groupId" value={g.id} />
                        <label className="block">
                          <span className="mb-1 block text-xs text-faint">Hora</span>
                          <input
                            name="teeTime"
                            defaultValue={g.teeTime ?? ""}
                            placeholder="09:30"
                            className="field w-28 !py-1.5 !text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-faint">Hoyo de salida</span>
                          <input
                            name="startHole"
                            type="number"
                            min={1}
                            max={18}
                            defaultValue={g.startHole ?? ""}
                            className="field w-24 !py-1.5 !text-sm"
                          />
                        </label>
                        <button type="submit" className="btn-ghost !py-1.5 !text-sm">
                          Guardar
                        </button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {canManage ? (
              <form action={addGroupAction} className="glass flex items-end gap-2 p-4">
                <input type="hidden" name="tournamentId" value={t.id} />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                    Añadir partida al turno
                  </span>
                  <select name="slotId" defaultValue={slots[0]?.id ?? ""} className="field">
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.startTime}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn-primary">
                  <Plus className="h-4 w-4" /> Añadir partida
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <div className="glass flex items-center gap-2 p-5 text-sm text-muted">
            <CalendarClock className="h-4 w-4" /> Las partidas se publicarán pronto.
          </div>
        )}
      </section>

      {/* Clasificación en vivo */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-soft">Clasificación</h2>
          <Badge tone="accent">{SCORING_LABEL[leaderboard.format]}</Badge>
        </div>
        <div className="glass overflow-hidden p-0">
          <div className="grid grid-cols-[2.5rem_1fr_3.5rem_4rem_3.5rem] px-5 py-3 text-xs font-medium text-faint">
            <span>#</span>
            <span>Jugador</span>
            <span className="text-right">Hoyos</span>
            <span className="text-right">Golpes</span>
            <span className="text-right">{lastColLabel}</span>
          </div>
          {leaderboard.rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Aún no hay nadie inscrito.</p>
          ) : (
            leaderboard.rows.map((r, i) => (
              <Link
                key={r.participantId}
                href={`/tournaments/${t.id}/player/${r.userId}`}
                className="grid grid-cols-[2.5rem_1fr_3.5rem_4rem_3.5rem] border-t border-black/5 px-5 py-3 text-sm transition hover:bg-black/[0.02]"
              >
                <span className="text-muted">{i + 1}</span>
                <span className="flex items-center gap-1.5 font-medium">
                  {r.name}
                  {r.userId === session.userId ? " (tú)" : ""}
                  {r.signed ? <Check className="h-3.5 w-3.5 text-positive" /> : null}
                </span>
                <span className="text-right text-ink-soft">{r.holesPlayed || "—"}</span>
                <span className="text-right font-medium">{r.strokes ?? "—"}</span>
                <span className="text-right font-semibold text-accent">
                  {r.holesPlayed === 0
                    ? "—"
                    : isStableford
                      ? (r.points ?? 0)
                      : isNet
                        ? fmtPar(r.netToPar ?? 0)
                        : fmtPar(r.toPar ?? 0)}
                </span>
              </Link>
            ))
          )}
        </div>
        <p className="text-xs text-faint">
          Toca un jugador para ver su dashboard (y desde ahí su tarjeta).
        </p>
      </section>

      {canManage && cardStatuses.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
            <PenLine className="h-4 w-4" /> Firmar tarjetas (organizador)
          </h2>
          <div className="glass divide-y divide-black/5 p-0">
            {cardStatuses.map((c) => (
              <div key={c.participantId} className="flex items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-faint">
                    {c.signed ? (
                      <span className="text-positive">Firmada ✓</span>
                    ) : c.allVerified ? (
                      <span className="text-accent">Verificada · lista para firmar</span>
                    ) : (
                      `Sin verificar · ${c.holesPlayed} hoyos`
                    )}
                  </p>
                </div>
                {c.signed ? (
                  c.roundId ? (
                    <Link href={`/rounds/${c.roundId}`} className="btn-ghost !py-1.5 !text-xs">
                      Ver vuelta
                    </Link>
                  ) : null
                ) : (
                  <form action={signParticipantCardAction}>
                    <input type="hidden" name="tournamentId" value={t.id} />
                    <input type="hidden" name="participantId" value={c.participantId} />
                    <button
                      type="submit"
                      disabled={!c.allVerified}
                      title={c.allVerified ? "" : "Todos los hoyos deben estar verificados"}
                      className="btn-primary !py-1.5 !text-xs disabled:opacity-40"
                    >
                      <PenLine className="h-3.5 w-3.5" /> Firmar
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-faint">
            Puedes firmar la tarjeta de un jugador cuando todos sus hoyos estén completos y
            verificados (coinciden con su marcador) — útil si se le olvidó firmar.
          </p>
        </section>
      ) : null}

      {isMember && !isOwner ? (
        <form action={leaveTournamentAction} className="pt-2">
          <input type="hidden" name="tournamentId" value={t.id} />
          <button type="submit" className="text-sm font-medium text-negative hover:underline">
            Salir del torneo
          </button>
        </form>
      ) : null}
    </>
  );
}
