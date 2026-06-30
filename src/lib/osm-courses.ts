import "server-only";
import esCourses from "@/data/es-courses.json";

/**
 * Golf course lookup.
 * - SEARCH: instant, local, reliable — against a bundled snapshot of the ~660
 *   Spanish golf courses from OpenStreetMap (src/data/es-courses.json).
 * - HOLES (on import): one Overpass call to read per-hole par/handicap that
 *   fall inside the course polygon (best-effort; the user confirms in the form).
 */

const OVERPASS = "https://overpass-api.de/api/interpreter";
const UA = "BirdieGolfApp/0.1 (personal golf tracker)";

export type OsmType = "node" | "way" | "relation";

export interface OsmSearchResult {
  osmType: OsmType;
  osmId: number;
  name: string;
  city: string | null;
  region: string | null;
  country: string | null;
  holesCount: number | null;
}

export interface PrefillHole {
  number: number;
  par: number;
  strokeIndex: number | null;
  distanceMeters: number | null;
}

export interface OsmCoursePrefill {
  externalId: string;
  name: string;
  city: string | null;
  region: string | null;
  country: string | null;
  holesCount: number;
  holes: PrefillHole[];
  hasHoleData: boolean;
}

interface LocalCourse {
  osmType: OsmType;
  osmId: number;
  name: string;
  city: string | null;
  region: string | null;
  lat: number | null;
  lon: number | null;
}

const COURSES = esCourses as LocalCourse[];

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Instant local search over the bundled Spanish course list. */
export async function searchOsmCourses(query: string): Promise<OsmSearchResult[]> {
  const q = strip(query);
  if (q.length < 2) return [];
  const matches = COURSES.filter((c) => strip(c.name).includes(q));
  matches.sort((a, b) => {
    const aStart = strip(a.name).startsWith(q) ? 0 : 1;
    const bStart = strip(b.name).startsWith(q) ? 0 : 1;
    return aStart - bStart || a.name.localeCompare(b.name, "es");
  });
  return matches.slice(0, 25).map((c) => ({
    osmType: c.osmType,
    osmId: c.osmId,
    name: c.name,
    city: c.city,
    region: c.region,
    country: "España",
    holesCount: null,
  }));
}

/* ---- Holes via Overpass (only when importing one course) ---- */
/* eslint-disable @typescript-eslint/no-explicit-any */

async function overpass(query: string): Promise<any> {
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: "data=" + encodeURIComponent(query),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenStreetMap no respondió (${res.status}).`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("OpenStreetMap está ocupado, inténtalo de nuevo en unos segundos.");
  }
}

function localById(osmType: OsmType, osmId: number): LocalCourse | undefined {
  return COURSES.find((c) => c.osmType === osmType && c.osmId === osmId);
}

/** Length of a polyline (array of {lat,lon}) in metres, via haversine. */
function polylineMeters(geom: { lat: number; lon: number }[]): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  let len = 0;
  for (let i = 1; i < geom.length; i++) {
    const a = geom[i - 1];
    const b = geom[i];
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    len += 2 * R * Math.asin(Math.sqrt(s));
  }
  return len;
}

export async function getOsmCoursePrefill(
  osmType: OsmType,
  osmId: number,
): Promise<OsmCoursePrefill> {
  const base = localById(osmType, osmId);
  const selector = osmType === "relation" ? `relation(${osmId})` : `way(${osmId})`;
  // `out tags geom` so hole ways carry their geometry → we can derive distance.
  const q = `[out:json][timeout:60];${selector}->.c;.c map_to_area->.a;(way["golf"="hole"](area.a);node["golf"="hole"](area.a););out tags geom;`;

  let holesWithPar: {
    ref: number;
    par: number;
    si: number | null;
    dist: number | null;
  }[] = [];
  try {
    const data = await overpass(q);
    const els: any[] = data.elements ?? [];
    const seen = new Set<number>();
    holesWithPar = els
      .filter((e) => e.tags?.golf === "hole")
      .map((h) => {
        const tagDist = parseInt(
          h.tags.dist ?? h.tags.distance ?? h.tags.length ?? "",
          10,
        );
        const geomLen = Array.isArray(h.geometry)
          ? Math.round(polylineMeters(h.geometry))
          : 0;
        const dist = geomLen >= 30 ? geomLen : Number.isFinite(tagDist) ? tagDist : null;
        return {
          ref: parseInt(h.tags.ref, 10),
          par: h.tags.par ? parseInt(h.tags.par, 10) : NaN,
          si: h.tags.handicap ? parseInt(h.tags.handicap, 10) : null,
          dist,
        };
      })
      .filter((h) => Number.isFinite(h.ref) && Number.isFinite(h.par))
      .sort((a, b) => a.ref - b.ref)
      .filter((h) => (seen.has(h.ref) ? false : seen.add(h.ref)));
  } catch {
    // If Overpass is busy, still let the user create the course manually.
    holesWithPar = [];
  }

  const hasHoleData = holesWithPar.length >= 9;
  const holesCount = hasHoleData && holesWithPar.length <= 9 ? 9 : 18;

  const holes: PrefillHole[] = Array.from({ length: holesCount }, (_, i) => {
    const number = i + 1;
    const match = hasHoleData ? holesWithPar.find((h) => h.ref === number) : undefined;
    return {
      number,
      par: match?.par ?? 4,
      strokeIndex: match?.si ?? null,
      distanceMeters: match?.dist ?? null,
    };
  });

  return {
    externalId: `osm:${osmType}/${osmId}`,
    name: base?.name ?? "Campo de golf",
    city: base?.city ?? null,
    region: base?.region ?? null,
    country: "España",
    holesCount,
    holes,
    hasHoleData,
  };
}
