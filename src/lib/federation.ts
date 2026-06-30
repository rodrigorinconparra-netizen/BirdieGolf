import "server-only";

/**
 * Federated handicap lookup via the RFEG (Real Federación Española de Golf)
 * public handicap consultation service.
 *
 * The page `ServicioHandicap.aspx?HLic=<license>` renders, server-side, a results
 * grid (`gvSearchResult`) with one row per match: Nombre, Licencia, Hándicap,
 * Estado, Modificación. No login needed. An unknown license yields no data rows.
 */

const BASE = "https://rfegolf.es/PaginasServicios/ServicioHandicap.aspx";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export interface FederatedHandicap {
  license: string;
  name: string;
  /** Exact handicap as shown (e.g. "12,4" or "+1,5"). */
  handicapLabel: string;
  /** Parsed exact handicap (plus handicaps are negative). null if not a number. */
  handicap: number | null;
  worldHandicapLabel: string | null;
  status: string | null;
  updatedAt: string | null;
}

export type FederatedLookup =
  | { ok: true; data: FederatedHandicap }
  | { ok: false; error: string };

/** Decode the few HTML entities the RFEG grid uses (numeric + common named). */
function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&amp;/gi, "&");
}

/** Strip tags + decode + collapse whitespace of an HTML fragment. */
function text(html: string): string {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

interface GridRow {
  name: string;
  license: string;
  handicap: string;
  status: string;
  updatedAt: string;
}

/** Parse the data rows of the gvSearchResult grid. */
function parseRows(html: string): GridRow[] {
  const tIdx = html.indexOf("gvSearchResult");
  if (tIdx < 0) return [];
  const tEnd = html.indexOf("</table>", tIdx);
  const table = html.slice(tIdx, tEnd < 0 ? undefined : tEnd);

  const rows: GridRow[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(table)) !== null) {
    const tr = m[1];
    if (/<th[\s>]/i.test(tr)) continue; // header row
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => text(c[1]));
    // Layout: [spacer, Nombre, Licencia, Hándicap, Estado, Modificación, spacer]
    if (cells.length < 6) continue;
    rows.push({
      name: cells[1],
      license: cells[2],
      handicap: cells[3],
      status: cells[4],
      updatedAt: cells[5],
    });
  }
  return rows;
}

/** Parse "12,4" / "+1,5" into a number; plus handicaps become negative. */
function parseHandicap(label: string): number | null {
  const m = label.match(/([+-]?)\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[2].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return m[1] === "+" ? -n : n;
}

export async function fetchFederatedHandicap(
  licenseRaw: string,
): Promise<FederatedLookup> {
  const license = licenseRaw.trim();
  if (!license) return { ok: false, error: "Introduce un número de licencia." };

  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${BASE}?HLic=${encodeURIComponent(license)}`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `La federación no respondió (${res.status}).` };
    }
    html = await res.text();
  } catch {
    return {
      ok: false,
      error: "No se pudo conectar con la federación. Inténtalo de nuevo en unos segundos.",
    };
  }

  const rows = parseRows(html);
  // The RFEG search matches partially, so require an EXACT license match to avoid
  // returning the wrong player.
  const norm = (s: string) => s.replace(/\s+/g, "");
  const row = rows.find((r) => norm(r.license) === norm(license));
  if (!row) {
    return { ok: false, error: "No se encontró ninguna licencia con ese número." };
  }

  return {
    ok: true,
    data: {
      license: row.license || license,
      name: row.name,
      handicapLabel: row.handicap,
      handicap: parseHandicap(row.handicap),
      worldHandicapLabel: null,
      status: row.status || null,
      updatedAt: row.updatedAt || null,
    },
  };
}
