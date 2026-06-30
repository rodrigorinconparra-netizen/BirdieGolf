"use client";

import { useActionState } from "react";
import { BadgeCheck, RefreshCw, AlertCircle, ShieldCheck } from "lucide-react";
import {
  syncFederatedHandicapAction,
  type FederationState,
} from "@/app/(app)/profile/actions";

export function FederationHandicap({ savedLicense }: { savedLicense: string | null }) {
  const [state, formAction, pending] = useActionState<FederationState, FormData>(
    syncFederatedHandicapAction,
    {},
  );

  return (
    <div className="glass p-6">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold">Hándicap federativo (RFEG)</h3>
          <p className="text-sm text-muted">
            Introduce tu número de licencia para traer tu hándicap exacto oficial.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">
            Número de licencia
          </span>
          <input
            name="license"
            required
            defaultValue={savedLicense ?? ""}
            placeholder="Ej. AB123456"
            className="field w-56"
          />
        </label>
        <button type="submit" disabled={pending} className="btn-primary">
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Consultando…" : "Sincronizar hándicap"}
        </button>
      </form>

      {state.error ? (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-negative/10 px-4 py-3 text-sm text-negative">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <div className="mt-4 rounded-2xl border border-positive/20 bg-positive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-positive">
            <BadgeCheck className="h-4 w-4" />
            {state.saved
              ? "Hándicap sincronizado y guardado en tu perfil."
              : "Licencia encontrada (sin hándicap numérico que guardar)."}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <Field label="Federado" value={state.name} />
            <Field label="Hándicap exacto" value={state.handicapLabel} strong />
            <Field label="Hándicap mundial" value={state.worldHandicapLabel} />
            <Field label="Estado" value={state.status} />
            <Field label="Última modificación" value={state.updatedAt} />
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value?: string | null;
  strong?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-faint">{label}</dt>
      <dd className={strong ? "text-base font-semibold text-ink" : "text-ink-soft"}>{value}</dd>
    </div>
  );
}
