import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, User } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getPublicRound } from "@/lib/social";
import { PageHeader } from "@/components/ui/page-header";
import { RoundScorecard } from "@/components/round-scorecard";

export const dynamic = "force-dynamic";

export default async function PublicRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const data = await getPublicRound(Number(id));
  if (!data) notFound();

  const { round, holes } = data;
  const dateLabel = new Date(round.playedAt).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Link
        href="/feed"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Feed
      </Link>

      <PageHeader
        title={round.courseName ?? "Vuelta"}
        subtitle={`${round.userName ?? "Jugador"} · ${dateLabel}`}
        action={
          <Link href={`/players/${round.userId}`} className="btn-ghost">
            <User className="h-4 w-4" /> Ver perfil
          </Link>
        }
      />

      <RoundScorecard holes={holes} />
    </>
  );
}
