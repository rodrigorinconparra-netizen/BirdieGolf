import Link from "next/link";
import { MapPin, CircleDot, Navigation } from "lucide-react";
import type { FeedRound } from "@/lib/social";

export function RoundFeedCard({ r, showUser = true }: { r: FeedRound; showUser?: boolean }) {
  const toPar =
    r.totalStrokes != null && r.coursePar != null ? r.totalStrokes - r.coursePar : null;
  const rel = toPar == null ? null : toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : `${toPar}`;
  const initials = r.userName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link href={`/feed/round/${r.roundId}`} className="glass block p-5 transition hover:-translate-y-0.5">
      {showUser ? (
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="font-medium">{r.userName}</span>
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate font-semibold">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
            {r.courseName ?? "Campo"}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {new Date(r.playedAt).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-faint">
            {r.totalPutts != null ? (
              <span className="flex items-center gap-1">
                <CircleDot className="h-3 w-3" /> {r.totalPutts} putts
              </span>
            ) : null}
            {r.distanceKm != null ? (
              <span className="flex items-center gap-1">
                <Navigation className="h-3 w-3" /> a {r.distanceKm} km
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tracking-tight">{r.totalStrokes ?? "—"}</p>
          {rel ? <p className="text-sm font-semibold text-accent">{rel}</p> : null}
        </div>
      </div>
    </Link>
  );
}
