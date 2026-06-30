import { redirect } from "next/navigation";
import { Users, Shield, Flag, MapPin, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getAdminData } from "@/lib/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { changeUserRoleAction, deleteUserAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "superadmin") redirect("/dashboard");

  const data = await getAdminData();

  const stats = [
    { label: "Usuarios", value: data.users.length, icon: Users },
    { label: "Jugadores", value: data.players, icon: Users },
    { label: "Superadmins", value: data.admins, icon: Shield },
    { label: "Vueltas", value: data.totalRounds, icon: Flag },
    { label: "Campos", value: data.coursesCount, icon: MapPin },
  ];

  return (
    <>
      <PageHeader
        title="Administración"
        subtitle="Gestión de usuarios y roles. Panel exclusivo de superadmin."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="glass p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
              <s.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="glass overflow-hidden p-0">
        <div className="border-b border-black/5 px-5 py-4">
          <h3 className="font-semibold">Usuarios</h3>
        </div>

        <div className="divide-y divide-black/5">
          {data.users.map((u) => {
            const isSelf = u.id === session.userId;
            const isAdmin = u.role === "superadmin";
            const nextRole = isAdmin ? "player" : "superadmin";
            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{u.name}</span>
                    {isAdmin ? (
                      <Badge tone="accent">Superadmin</Badge>
                    ) : (
                      <Badge tone="neutral">Jugador</Badge>
                    )}
                    {isSelf ? <Badge tone="positive">Tú</Badge> : null}
                  </div>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                </div>

                <div className="hidden text-center sm:block">
                  <p className="text-sm font-medium">{u.roundsCount}</p>
                  <p className="text-[11px] text-faint">vueltas</p>
                </div>
                <div className="hidden text-center sm:block">
                  <p className="text-sm font-medium">
                    {u.handicap != null ? u.handicap.toFixed(1) : "—"}
                  </p>
                  <p className="text-[11px] text-faint">hcp</p>
                </div>

                <div className="flex items-center gap-2">
                  <form action={changeUserRoleAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="role" value={nextRole} />
                    <button
                      type="submit"
                      disabled={isSelf}
                      title={isAdmin ? "Quitar superadmin" : "Hacer superadmin"}
                      className="btn-ghost !px-3 !py-1.5 !text-xs disabled:opacity-40"
                    >
                      {isAdmin ? (
                        <>
                          <ShieldOff className="h-3.5 w-3.5" /> Jugador
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" /> Admin
                        </>
                      )}
                    </button>
                  </form>
                  <form action={deleteUserAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <button
                      type="submit"
                      disabled={isSelf}
                      title="Eliminar usuario"
                      className="grid h-8 w-8 place-items-center rounded-xl text-faint transition hover:bg-negative/10 hover:text-negative disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-faint"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-faint">
        No puedes cambiar tu propio rol ni eliminarte, y siempre debe quedar al menos un
        superadmin.
      </p>
    </>
  );
}
