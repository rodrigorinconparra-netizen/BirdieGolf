import Link from "next/link";
import { Bell, Check, Flag, Trophy, Users, type LucideIcon } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listNotifications } from "@/lib/social";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { markNotificationsReadAction } from "../social/actions";

export const dynamic = "force-dynamic";

function timeAgo(d: Date): string {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];

/** Message, link and icon for a notification, by type. */
function describe(n: NotificationRow): { text: string; href: string | null; icon: LucideIcon } {
  const actor = n.actorName ?? "Alguien";
  switch (n.type) {
    case "round_created":
      return {
        text: `${actor} ha registrado una vuelta nueva`,
        href: n.actorId ? `/players/${n.actorId}` : null,
        icon: Flag,
      };
    case "added_to_round":
      return {
        text: `${actor} te ha añadido a una vuelta. Márcate para guardarla en tus vueltas.`,
        href: n.roundId ? `/rounds/${n.roundId}` : null,
        icon: Users,
      };
    case "tournament_created":
      return {
        text: `${actor} ha creado un torneo en una liga${n.tournamentName ? `: ${n.tournamentName}` : ""}`,
        href: n.tournamentId ? `/tournaments/${n.tournamentId}` : null,
        icon: Trophy,
      };
    case "round_published":
    default:
      return {
        text: `${actor} ha publicado una vuelta`,
        href: n.roundId ? `/feed/round/${n.roundId}` : null,
        icon: Bell,
      };
  }
}

export default async function NotificationsPage() {
  const session = await getSession();
  const items = session ? await listNotifications(session.userId) : [];
  const hasUnread = items.some((n) => !n.read);

  return (
    <>
      <PageHeader
        title="Notificaciones"
        action={
          hasUnread ? (
            <form action={markNotificationsReadAction}>
              <button type="submit" className="btn-ghost">
                <Check className="h-4 w-4" /> Marcar leídas
              </button>
            </form>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sin notificaciones"
          description="Aquí verás cuando alguien a quien sigues registra una vuelta o cuando se crea un torneo en una liga tuya."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const { text, href, icon: Icon } = describe(n);
            const body = (
              <div
                className={
                  "glass flex items-center gap-3 p-4 " +
                  (n.read ? "" : "border-accent/30 bg-accent/[0.04]")
                }
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{text}</p>
                  <p className="text-xs text-faint">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
              </div>
            );
            return href ? (
              <Link key={n.id} href={href} className="block">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
