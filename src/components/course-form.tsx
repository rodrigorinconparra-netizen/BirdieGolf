"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  createManualCourse,
  updateCourse,
  type CourseFormState,
} from "@/app/(app)/courses/actions";

export interface CourseFormInitial {
  name?: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  holesCount?: number;
  holes?: { par: number; strokeIndex: number | null; distanceMeters: number | null }[];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export function CourseForm({
  initial,
  notice,
  submitLabel = "Guardar campo",
  courseId,
}: {
  initial?: CourseFormInitial;
  notice?: ReactNode;
  submitLabel?: string;
  /** When set, the form updates this course instead of creating a new one. */
  courseId?: number;
}) {
  const [count, setCount] = useState(initial?.holesCount ?? 18);
  const boundAction =
    courseId != null ? updateCourse.bind(null, courseId) : createManualCourse;
  const [state, action, pending] = useActionState<CourseFormState, FormData>(
    boundAction,
    {},
  );
  const holes = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <form action={action} className="space-y-5">
      {notice}

      <div className="glass space-y-4 p-6">
        <Field label="Nombre del campo *">
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ""}
            placeholder="Ej. Club de Golf La Dehesa"
            className="field"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ciudad">
            <input name="city" defaultValue={initial?.city ?? ""} className="field" />
          </Field>
          <Field label="Provincia / Región">
            <input name="region" defaultValue={initial?.region ?? ""} className="field" />
          </Field>
          <Field label="País">
            <input name="country" defaultValue={initial?.country ?? "España"} className="field" />
          </Field>
        </div>
        <Field label="Nº de hoyos">
          <select
            name="holesCount"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="field"
          >
            <option value={18}>18 hoyos</option>
            <option value={9}>9 hoyos</option>
          </select>
        </Field>
      </div>

      <div className="glass p-6">
        <h3 className="font-semibold">Hoyos</h3>
        <p className="text-sm text-muted">
          Par, distancia en metros y SI (índice de dificultad / hándicap del hoyo).
        </p>
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr] gap-2 px-1 text-xs font-medium text-faint">
            <span>Hoyo</span>
            <span>Par</span>
            <span>Dist (m)</span>
            <span>SI</span>
          </div>
          {holes.map((n) => {
            const h = initial?.holes?.[n - 1];
            return (
              <div key={n} className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-2">
                <span className="text-sm font-medium text-muted">{n}</span>
                <input
                  name={`par_${n}`}
                  type="number"
                  min={3}
                  max={6}
                  defaultValue={h?.par ?? 4}
                  className="field !py-2"
                />
                <input
                  name={`dist_${n}`}
                  type="number"
                  min={0}
                  defaultValue={h?.distanceMeters ?? undefined}
                  placeholder="—"
                  className="field !py-2"
                />
                <input
                  name={`si_${n}`}
                  type="number"
                  min={1}
                  max={18}
                  defaultValue={h?.strokeIndex ?? undefined}
                  placeholder="—"
                  className="field !py-2"
                />
              </div>
            );
          })}
        </div>
      </div>

      {state.error ? (
        <p className="rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Guardando…" : submitLabel}
        </button>
        <Link href="/courses" className="btn-ghost">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
