"use client";

import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function ShareRoundButton({
  roundId,
  courseName,
}: {
  roundId: number;
  courseName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function share() {
    setLoading(true);
    try {
      const res = await fetch(`/rounds/${roundId}/share`);
      if (!res.ok) throw new Error("No se pudo generar la imagen");
      const blob = await res.blob();
      const file = new File([blob], `birdie-${roundId}.png`, { type: "image/png" });

      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Mi vuelta en Birdie",
          text: `Mi vuelta en ${courseName} 🏌️`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `birdie-${courseName.replace(/\s+/g, "-").toLowerCase()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silently ignore (user cancelled share, etc.)
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={share} disabled={loading} className="btn-primary">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      Compartir tarjeta
    </button>
  );
}
