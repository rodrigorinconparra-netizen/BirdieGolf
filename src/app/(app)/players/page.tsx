"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Search, Loader2, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { searchUsersAction } from "@/app/(app)/social/actions";

interface Result {
  id: number;
  name: string;
  handicap: number | null;
  isFollowing: boolean;
}

export default function PlayersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const r = await searchUsersAction(query);
    setResults(r);
    setLoading(false);
  }

  return (
    <>
      <PageHeader title="Buscar jugadores" subtitle="Encuentra a otros golfistas y síguelos." />

      <form onSubmit={onSearch} className="glass flex items-center gap-2 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre del jugador…"
          className="field"
        />
        <button type="submit" disabled={loading} className="btn-primary !px-4">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>

      {results !== null && results.length === 0 && !loading ? (
        <p className="text-sm text-muted">Sin resultados.</p>
      ) : null}

      <div className="space-y-2">
        {results?.map((u) => {
          const initials = u.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          return (
            <Link
              key={u.id}
              href={`/players/${u.id}`}
              className="glass flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-semibold text-white">
                  {initials}
                </span>
                <div>
                  <p className="font-medium">{u.name}</p>
                  {u.handicap != null ? (
                    <p className="text-xs text-faint">Hándicap {u.handicap.toFixed(1)}</p>
                  ) : null}
                </div>
              </div>
              {u.isFollowing ? (
                <Badge tone="positive">
                  <Check className="h-3 w-3" /> Siguiendo
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}
