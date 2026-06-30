"use client";

import { useState } from "react";
import Link from "next/link";
import { createTournamentAction } from "@/app/(app)/tournaments/actions";

interface CourseOption {
  id: number;
  name: string;
}

interface TeeOpt {
  id: number;
  name: string;
  gender: string;
  courseRating: number | null;
  slopeRating: number | null;
}

export function TournamentCreateForm({
  leagueId,
  courses,
  teesByCourse,
  today,
  defCourse,
  defVisibility,
  defStart,
  defInterval,
}: {
  leagueId: number | null;
  courses: CourseOption[];
  teesByCourse: Record<number, TeeOpt[]>;
  today: string;
  defCourse: string;
  defVisibility: string;
  defStart: string;
  defInterval: number;
}) {
  const [format, setFormat] = useState<"single" | "league">("single");
  const [courseId, setCourseId] = useState<string>(defCourse);
  const [scoringFormat, setScoringFormat] = useState<string>("stroke");

  const inLeague = leagueId != null;
  // An "event" has schedule fields; a top-level league container does not.
  const isEvent = inLeague || format === "single";

  const isNet = scoringFormat.endsWith("_net");
  const courseTees = courseId ? (teesByCourse[Number(courseId)] ?? []) : [];

  return (
    <form action={createTournamentAction} className="glass space-y-5 p-6">
      {inLeague ? <input type="hidden" name="parentId" value={leagueId} /> : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Nombre *</span>
        <input
          name="name"
          required
          placeholder={inLeague ? "Ej. Jornada 1" : "Ej. Torneo de primavera"}
          className="field"
        />
      </label>

      {!inLeague ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Tipo</span>
          <select
            name="format"
            value={format}
            onChange={(e) => setFormat(e.target.value as "single" | "league")}
            className="field"
          >
            <option value="single">Torneo de un día</option>
            <option value="league">Liga (contenedor: dentro creas los torneos)</option>
          </select>
          <span className="mt-1 block text-xs text-faint">
            Si eliges Liga, crearás el contenedor y dentro añadirás los torneos (cada uno con su
            horario).
          </span>
        </label>
      ) : null}

      {/* Visibility: not asked for in-league events (they inherit the league's). */}
      {!inLeague ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Visibilidad</span>
          <select name="visibility" defaultValue={defVisibility} className="field">
            <option value="public">Público</option>
            <option value="private">Privado (solo con invitación)</option>
          </select>
        </label>
      ) : null}

      {isEvent ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Campo</span>
              <select
                name="courseId"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="field"
              >
                <option value="">Sin campo</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Fecha</span>
              <input type="date" name="playDate" defaultValue={today} className="field" />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Formato de juego</span>
            <select
              name="scoringFormat"
              value={scoringFormat}
              onChange={(e) => setScoringFormat(e.target.value)}
              className="field"
            >
              <option value="stroke">Medal — golpes brutos (gana el que menos golpes)</option>
              <option value="stroke_net">Medal neto — golpes menos hándicap</option>
              <option value="stableford">Stableford — puntos (par=2, birdie=3…)</option>
              <option value="stableford_net">Stableford neto — puntos con hándicap</option>
            </select>
            <span className="mt-1 block text-xs text-faint">
              Los formatos «neto» usan el hándicap, el slope/valoración de la barra y el índice de
              los hoyos (hándicap de campo).
            </span>
          </label>

          {isNet ? (
            courseTees.length > 0 ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Barra de juego (para el hándicap de campo)
                </span>
                <select name="teeId" defaultValue={String(courseTees[0].id)} className="field">
                  {courseTees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.slopeRating != null ? ` · Slope ${t.slopeRating}` : ""}
                      {t.courseRating != null ? ` · CR ${t.courseRating}` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-faint">
                  Hándicap de campo = índice × (slope / 113) + (valoración − par), repartido por el
                  índice de cada hoyo.
                </span>
              </label>
            ) : (
              <p className="rounded-2xl bg-warning/10 px-4 py-3 text-xs text-ink-soft">
                Este campo no tiene barras con slope/valoración. El neto usará el hándicap del jugador
                sin ajuste de slope. Añade las barras en el campo para un cálculo exacto.
              </p>
            )
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Salidas</span>
              <select name="startType" defaultValue={defStart} className="field">
                <option value="progressive">Progresivas (por horarios)</option>
                <option value="shotgun">A tiro (todas a la vez)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                Intervalo entre partidas (min)
              </span>
              <input
                type="number"
                name="intervalMinutes"
                min={1}
                defaultValue={defInterval}
                className="field"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                Inicio del torneo
              </span>
              <input type="datetime-local" name="startsAt" className="field" />
              <span className="mt-1 block text-xs text-faint">
                La sección «Mi tarjeta» aparece cuando el torneo empieza.
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                Cierre de inscripción
              </span>
              <input type="datetime-local" name="registrationDeadline" className="field" />
              <span className="mt-1 block text-xs text-faint">
                Al cerrarse se generan las partidas automáticamente.
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                Publicación de partidas
              </span>
              <select name="pairingsMode" defaultValue="auto" className="field">
                <option value="auto">Automática (en una fecha)</option>
                <option value="manual">Manual (la publica el organizador)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                Fecha de publicación (si automática)
              </span>
              <input type="datetime-local" name="pairingsPublishAt" className="field" />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">
              Turnos (horas separadas por coma)
            </span>
            <input name="slots" placeholder="09:30, 15:30" className="field" />
            <span className="mt-1 block text-xs text-faint">
              Cada turno es una tanda de salidas a la que la gente se apunta. Podrás añadir más
              después.
            </span>
          </label>
        </>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          {inLeague ? "Crear torneo en la liga" : "Crear"}
        </button>
        <Link href={inLeague ? `/tournaments/${leagueId}` : "/tournaments"} className="btn-ghost">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
