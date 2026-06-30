import Link from "next/link";
import { Flag, Plus, CircleDot } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listRounds } from "@/lib/rounds";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

function toPar(strokes: number | null, par: number | null) {
  if (strokes == null || par == null) return null;
  const diff = strokes - par;
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export default async function RoundsPage() {
  const session = await getSession();
  const items = session ? await listRounds(session.userId) : [];

  return (
    <>
      <PageHeader
        title="Vueltas"
        subtitle="Registra cada vuelta hoyo a hoyo y revisa tu progreso."
        action={
          <Link href="/rounds/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Nueva vuelta
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Aún no has registrado vueltas"
          description="Empieza tu primera vuelta y registra cada hoyo: golpes, calle, green y putts."
          action={
            <Link href="/rounds/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Registrar primera vuelta
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const rel = toPar(r.totalStrokes, r.coursePar);
            return (
              <Link
                key={r.id}
                href={`/rounds/${r.id}`}
                className="glass flex items-center justify-between gap-3 p-5 transition hover:-translate-y-0.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.courseName ?? "Campo"}</p>
                  <p className="text-sm text-muted">
                    {new Date(r.playedAt).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight">
                      {r.totalStrokes ?? "—"}
                    </p>
                    <p className="text-[11px] text-faint">Golpes</p>
                  </div>
                  {rel ? (
                    <div>
                      <p className="text-lg font-semibold text-accent">{rel}</p>
                      <p className="text-[11px] text-faint">al par</p>
                    </div>
                  ) : null}
                  <div className="hidden sm:block">
                    <p className="flex items-center gap-1 text-lg font-semibold">
                      <CircleDot className="h-4 w-4 text-faint" />
                      {r.totalPutts ?? "—"}
                    </p>
                    <p className="text-[11px] text-faint">Putts</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
