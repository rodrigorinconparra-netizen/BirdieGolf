import { eq } from "drizzle-orm";
import { Trash2, Plus, Briefcase } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getBag, CLUB_KIND_LABEL, type ClubKind } from "@/lib/bag";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { addClubAction, deleteClubAction, updateHandicapAction } from "./actions";
import { FederationHandicap } from "@/components/federation-handicap";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  const bag = await getBag(session.userId);
  const initials = session.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <PageHeader title="Perfil" subtitle="Tus datos y tu bolsa de palos." />

      <div className="glass p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-lg font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{session.name}</p>
            <p className="truncate text-sm text-muted">{session.email}</p>
          </div>
          {session.role === "superadmin" ? (
            <Badge tone="accent" className="ml-auto">
              Superadmin
            </Badge>
          ) : null}
        </div>

        <form action={updateHandicapAction} className="mt-6 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Hándicap</span>
            <input
              name="handicap"
              type="number"
              step="0.1"
              defaultValue={user?.handicap ?? ""}
              placeholder="Ej. 18.4"
              className="field w-40"
            />
          </label>
          <button type="submit" className="btn-ghost">
            Guardar hándicap
          </button>
        </form>
      </div>

      <FederationHandicap savedLicense={user?.federationLicense ?? null} />

      <div className="glass p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
            <Briefcase className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold">Mi bolsa</h3>
            <p className="text-sm text-muted">{bag.length} palos</p>
          </div>
        </div>

        <ul className="mt-5 divide-y divide-black/5">
          {bag.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <Badge tone="neutral">{CLUB_KIND_LABEL[c.kind as ClubKind]}</Badge>
              </div>
              <form action={deleteClubAction}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  title="Quitar palo"
                  className="grid h-8 w-8 place-items-center rounded-xl text-faint transition hover:bg-negative/10 hover:text-negative"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form
          action={addClubAction}
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-black/5 pt-4"
        >
          <label className="block flex-1">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Añadir palo</span>
            <input name="name" required placeholder="Ej. Híbrido 3" className="field" />
          </label>
          <select name="kind" defaultValue="iron" className="field w-36">
            <option value="wood">Madera</option>
            <option value="hybrid">Híbrido</option>
            <option value="iron">Hierro</option>
            <option value="wedge">Wedge</option>
            <option value="putter">Putter</option>
          </select>
          <button type="submit" className="btn-primary">
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </form>
      </div>
    </>
  );
}
