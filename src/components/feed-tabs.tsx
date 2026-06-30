"use client";

import { useState } from "react";
import { Loader2, Navigation, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoundFeedCard } from "@/components/round-feed-card";
import { loadPublicFeedAction } from "@/app/(app)/social/actions";
import type { FeedRound } from "@/lib/social";

export function FeedTabs({ following }: { following: FeedRound[] }) {
  const [tab, setTab] = useState<"following" | "public">("following");
  const [pub, setPub] = useState<FeedRound[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [located, setLocated] = useState(false);

  async function loadPublic() {
    setLoading(true);
    const finish = async (lat: number | null, lon: number | null) => {
      const r = await loadPublicFeedAction(lat, lon);
      setPub(r);
      setLocated(lat != null);
      setLoading(false);
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => finish(pos.coords.latitude, pos.coords.longitude),
        () => finish(null, null),
        { timeout: 8000 },
      );
    } else {
      finish(null, null);
    }
  }

  function switchTab(t: "following" | "public") {
    setTab(t);
    if (t === "public" && pub === null && !loading) void loadPublic();
  }

  return (
    <div className="space-y-4">
      <div className="glass inline-flex gap-1 p-1">
        {(["following", "public"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              tab === t ? "bg-accent text-white" : "text-ink-soft hover:bg-black/5",
            )}
          >
            {t === "following" ? "Siguiendo" : "Público"}
          </button>
        ))}
      </div>

      {tab === "following" ? (
        following.length === 0 ? (
          <div className="glass flex flex-col items-center gap-2 p-10 text-center text-sm text-muted">
            <Users className="h-6 w-6 text-faint" />
            Sigue a otros jugadores para ver aquí sus vueltas públicas.
          </div>
        ) : (
          <div className="space-y-3">
            {following.map((r) => (
              <RoundFeedCard key={r.roundId} r={r} />
            ))}
          </div>
        )
      ) : loading ? (
        <div className="glass flex items-center justify-center gap-2 p-10 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando vueltas cerca de ti…
        </div>
      ) : pub && pub.length ? (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs text-faint">
            <Navigation className="h-3.5 w-3.5" />
            {located
              ? "Ordenadas por el campo más cercano a tu ubicación."
              : "Sin ubicación: mostrando las más recientes."}
          </p>
          {pub.map((r) => (
            <RoundFeedCard key={r.roundId} r={r} />
          ))}
        </div>
      ) : (
        <div className="glass p-10 text-center text-sm text-muted">
          Aún no hay vueltas públicas. ¡Sé el primero en publicar una!
        </div>
      )}
    </div>
  );
}
