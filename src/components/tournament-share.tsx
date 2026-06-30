"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function TournamentShare({
  tournamentId,
  code,
  name,
}: {
  tournamentId: number;
  code: string;
  name: string;
}) {
  const [copied, setCopied] = useState(false);

  function inviteUrl() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/tournaments/${tournamentId}?invite=${code}`;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  const waText = `¡Únete a mi torneo "${name}" en Birdie! ${inviteUrl()}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div className="flex gap-2">
      <button type="button" onClick={copy} className="btn-ghost">
        {copied ? <Check className="h-4 w-4 text-positive" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado" : "Copiar enlace"}
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary"
        style={{ background: "#25D366" }}
      >
        WhatsApp
      </a>
    </div>
  );
}
