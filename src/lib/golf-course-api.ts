import "server-only";

/**
 * Client for the public GolfCourseAPI (https://golfcourseapi.com).
 * Auth: header `Authorization: Key <API_KEY>`.
 * Written defensively so small differences in the upstream JSON don't break import.
 */

const BASE = "https://api.golfcourseapi.com";
const YARD_TO_M = 0.9144;

export interface NormalizedHole {
  number: number;
  par: number;
  distanceMeters: number | null;
  strokeIndex: number | null;
}

export interface NormalizedCourse {
  externalId: string;
  name: string;
  club: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  holesCount: number;
  par: number | null;
  holes: NormalizedHole[];
}

export interface CourseSearchResult {
  externalId: string;
  name: string;
  club: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}

export function isGolfApiConfigured(): boolean {
  return Boolean(process.env.GOLF_COURSE_API_KEY);
}

function authHeaders(): HeadersInit {
  const key = process.env.GOLF_COURSE_API_KEY;
  if (!key) {
    throw new Error(
      "La API de campos no está configurada. Añade GOLF_COURSE_API_KEY en .env.local",
    );
  }
  return { Authorization: `Key ${key}` };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function pickBestTee(tees: any): any | null {
  if (!tees) return null;
  const groups = Object.values(tees).filter(Array.isArray) as any[][];
  let best: any | null = null;
  for (const group of groups) {
    for (const tee of group) {
      const count = tee?.holes?.length ?? 0;
      if (!best || count > (best.holes?.length ?? 0)) best = tee;
    }
  }
  return best;
}

function locationOf(raw: any) {
  const loc = raw.location ?? {};
  return {
    city: loc.city ?? null,
    region: loc.state ?? loc.region ?? null,
    country: loc.country ?? null,
  };
}

function normalizeCourse(raw: any): NormalizedCourse {
  const tee = pickBestTee(raw.tees);
  const rawHoles: any[] = tee?.holes ?? [];
  const holes: NormalizedHole[] = rawHoles.map((h, i) => ({
    number: i + 1,
    par: Number(h.par) || 4,
    distanceMeters: h.yardage ? Math.round(Number(h.yardage) * YARD_TO_M) : null,
    strokeIndex: h.handicap ? Number(h.handicap) : null,
  }));
  const parTotal =
    tee?.par_total ??
    (holes.length ? holes.reduce((sum, h) => sum + h.par, 0) : null);

  return {
    externalId: String(raw.id),
    name: raw.course_name || raw.club_name || "Campo sin nombre",
    club: raw.club_name ?? null,
    ...locationOf(raw),
    holesCount: holes.length || Number(raw.holes_count) || 18,
    par: parTotal ?? null,
    holes,
  };
}

export async function searchCourses(query: string): Promise<CourseSearchResult[]> {
  const res = await fetch(
    `${BASE}/v1/search?search_query=${encodeURIComponent(query)}`,
    { headers: authHeaders(), cache: "no-store" },
  );
  if (res.status === 401) throw new Error("API key de campos no válida (401).");
  if (!res.ok) throw new Error(`La búsqueda de campos falló (${res.status}).`);
  const data = await res.json();
  const courses: any[] = data.courses ?? data ?? [];
  return courses.map((c) => ({
    externalId: String(c.id),
    name: c.course_name || c.club_name || "Campo",
    club: c.club_name ?? null,
    ...locationOf(c),
  }));
}

export async function getCourse(externalId: string): Promise<NormalizedCourse> {
  const res = await fetch(`${BASE}/v1/courses/${externalId}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("API key de campos no válida (401).");
  if (!res.ok) throw new Error(`No se pudo obtener el campo (${res.status}).`);
  const data = await res.json();
  return normalizeCourse(data.course ?? data);
}
