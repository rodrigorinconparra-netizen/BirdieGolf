import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, UserPlus, UserCheck, Bell, BellOff, Flag } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/social";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RoundFeedCard } from "@/components/round-feed-card";
import { followAction, unfollowAction, toggleNotifyAction } from "@/app/(app)/social/actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const p = await getProfile(Number(id), session.userId);
  if (!p) notFound();

  const initials = p.user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <Link
        href="/feed"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Feed
      </Link>

      <div className="glass p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-xl font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{p.user.name}</h1>
            <p className="text-sm text-muted">
              {p.user.handicap != null ? `Hándicap ${p.user.handicap.toFixed(1)} · ` : ""}
              {p.publicRoundCount} vueltas públicas
            </p>
          </div>

          {!p.isSelf ? (
            <div className="flex items-center gap-2">
              {p.isFollowing ? (
                <form action={unfollowAction}>
                  <input type="hidden" name="userId" value={p.user.id} />
                  <button type="submit" className="btn-ghost">
                    <UserCheck className="h-4 w-4" /> Siguiendo
                  </button>
                </form>
              ) : (
                <form action={followAction}>
                  <input type="hidden" name="userId" value={p.user.id} />
                  <button type="submit" className="btn-primary">
                    <UserPlus className="h-4 w-4" /> Seguir
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex gap-6 text-sm">
          <span>
            <span className="font-semibold">{p.followers}</span>{" "}
            <span className="text-muted">seguidores</span>
          </span>
          <span>
            <span className="font-semibold">{p.following}</span>{" "}
            <span className="text-muted">siguiendo</span>
          </span>
          {p.avgStrokes != null ? (
            <span>
              <span className="font-semibold">{p.avgStrokes}</span>{" "}
              <span className="text-muted">media</span>
            </span>
          ) : null}
        </div>
      </div>

      {!p.isSelf && p.isFollowing ? (
        <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span
              className={
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                (p.notify ? "bg-accent/10 text-accent" : "bg-black/5 text-muted")
              }
            >
              {p.notify ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-sm font-medium">
                {p.notify ? "Avisos activados" : "¿Quieres recibir avisos?"}
              </p>
              <p className="text-xs text-muted">
                {p.notify
                  ? `Te avisaremos cuando ${p.user.name} registre o publique una vuelta.`
                  : `Activa los avisos para enterarte cuando ${p.user.name} registre o publique una vuelta.`}
              </p>
            </div>
          </div>
          <form action={toggleNotifyAction}>
            <input type="hidden" name="userId" value={p.user.id} />
            <input type="hidden" name="notify" value={String(!p.notify)} />
            <button type="submit" className={p.notify ? "btn-ghost" : "btn-primary"}>
              {p.notify ? (
                <>
                  <BellOff className="h-4 w-4" /> Desactivar avisos
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" /> Activar avisos
                </>
              )}
            </button>
          </form>
        </div>
      ) : null}

      <h2 className="text-sm font-semibold text-ink-soft">Vueltas publicadas</h2>
      {p.feed.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Sin vueltas públicas"
          description={
            p.isSelf
              ? "Haz pública una vuelta desde su página para que aparezca en tu perfil."
              : "Este jugador aún no ha publicado vueltas."
          }
        />
      ) : (
        <div className="space-y-3">
          {p.feed.map((r) => (
            <RoundFeedCard key={r.roundId} r={r} showUser={false} />
          ))}
        </div>
      )}
    </>
  );
}
