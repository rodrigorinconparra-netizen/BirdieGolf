import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Check, AlertTriangle } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getCardData } from "@/lib/tournament-play";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>;
}) {
  const { id, participantId } = await params;
  const session = await getSession();
  if (!session) notFound();

  const data = await getCardData(Number(id), Number(participantId));
  if (!data) notFound();

  const played = data.holes.filter((h) => h.strokes != null);
  const totStrokes = played.reduce((s, h) => s + (h.strokes ?? 0), 0);
  const totPar = played.reduce((s, h) => s + (h.par ?? 0), 0);
  const totPutts = data.holes.reduce((s, h) => s + (h.putts ?? 0), 0);
  const toPar = totStrokes - totPar;
  const relLabel = played.length === 0 ? "—" : toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : `${toPar}`;
  const hasPutts = data.holes.some((h) => h.putts != null);

  return (
    <>
      <Link
        href={`/tournaments/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Torneo
      </Link>

      <PageHeader
        title={`Tarjeta de ${data.name}`}
        subtitle={`${played.length} hoyos`}
        action={
          data.signed ? (
            <Badge tone="positive">
              <Check className="h-3 w-3" /> Firmada
            </Badge>
          ) : undefined
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="glass p-4 text-center">
          <p className="text-2xl font-semibold">{played.length ? totStrokes : "—"}</p>
          <p className="text-[11px] text-faint">Golpes</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-semibold text-accent">{relLabel}</p>
          <p className="text-[11px] text-faint">Al par</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-semibold">{hasPutts ? totPutts : "—"}</p>
          <p className="text-[11px] text-faint">Putts</p>
        </div>
      </div>

      <div className="glass overflow-hidden p-0">
        <div className="grid grid-cols-[3rem_1fr_1fr_2.5rem] px-5 py-3 text-xs font-medium text-faint">
          <span>Hoyo</span>
          <span>Par</span>
          <span>Golpes</span>
          <span className="text-right">✓</span>
        </div>
        {data.holes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Aún no ha marcado ningún hoyo.</p>
        ) : (
          data.holes.map((h) => (
            <div
              key={h.holeNumber}
              className="grid grid-cols-[3rem_1fr_1fr_2.5rem] items-center border-t border-black/5 px-5 py-2.5 text-sm"
            >
              <span className="font-medium text-muted">{h.holeNumber}</span>
              <span>{h.par ?? "—"}</span>
              <span className="font-medium">{h.strokes ?? "—"}</span>
              <span className="flex justify-end">
                {h.verified ? (
                  <Check className="h-4 w-4 text-positive" />
                ) : h.mismatch ? (
                  <AlertTriangle className="h-4 w-4 text-negative" />
                ) : (
                  <span className="text-faint">·</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
