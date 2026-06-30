import { ImageResponse } from "next/og";
import { getSession } from "@/lib/auth/session";
import { getRound } from "@/lib/rounds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INK = "#1c1c1e";
const MUTED = "#6e6e73";
const FAINT = "#a1a1a6";
const ACCENT = "#3a7d5d";
const GREEN = "#2faf5a";
const AMBER = "#b9810a";
const RED = "#e5484d";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response("No autorizado", { status: 401 });
  const data = await getRound(Number(id), session.userId);
  if (!data) return new Response("No encontrada", { status: 404 });

  const { round, course, holes } = data;
  const played = holes.filter((h) => h.strokes != null);
  const totStrokes = played.reduce((s, h) => s + (h.strokes ?? 0), 0);
  const parPlayed = played.reduce((s, h) => s + (h.par ?? 0), 0);
  const toPar = totStrokes - parPlayed;
  const relLabel = toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : `${toPar}`;
  const totPutts = holes.reduce((s, h) => s + (h.putts ?? 0), 0);
  const gir = played.filter((h) => h.greenInRegulation).length;
  const fwHoles = played.filter((h) => (h.par ?? 4) >= 4 && h.fairway);
  const fwHit = fwHoles.filter((h) => h.fairway === "hit").length;
  const front = holes.filter((h) => h.holeNumber <= 9);
  const back = holes.filter((h) => h.holeNumber > 9);
  const outStrokes = front.reduce((s, h) => s + (h.strokes ?? 0), 0);
  const inStrokes = back.reduce((s, h) => s + (h.strokes ?? 0), 0);
  const rels = played.map((h) => (h.strokes ?? 0) - (h.par ?? 0));
  const birdies = rels.filter((r) => r <= -1).length;
  const pars = rels.filter((r) => r === 0).length;
  const bogeys = rels.filter((r) => r === 1).length;
  const doubles = rels.filter((r) => r >= 2).length;
  const dateLabel = new Date(round.playedAt).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const scoreColor = (rel: number) =>
    rel <= -1 ? GREEN : rel === 0 ? INK : rel === 1 ? AMBER : RED;

  const holeBox = (h: (typeof holes)[number]) => {
    const rel = h.strokes != null && h.par != null ? h.strokes - h.par : 0;
    const hasScore = h.strokes != null;
    const border =
      rel <= -1
        ? `4px solid ${GREEN}`
        : rel === 1
          ? `4px solid ${AMBER}`
          : rel >= 2
            ? `4px solid ${RED}`
            : "4px solid transparent";
    return (
      <div
        key={h.holeNumber}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 80 }}
      >
        <span style={{ fontSize: 22, color: FAINT }}>{h.holeNumber}</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 62,
            height: 62,
            marginTop: 6,
            borderRadius: rel <= -1 ? 40 : 12,
            border,
            background: "rgba(255,255,255,0.55)",
          }}
        >
          <span style={{ fontSize: 36, fontWeight: 700, color: scoreColor(rel) }}>
            {hasScore ? h.strokes : "–"}
          </span>
        </div>
      </div>
    );
  };

  const totalBox = (label: string, value: number) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 96,
      }}
    >
      <span style={{ fontSize: 22, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 40, fontWeight: 700, color: ACCENT, marginTop: 6 }}>{value}</span>
    </div>
  );

  const distBox = (color: string, label: string, value: number) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        alignItems: "center",
        background: "rgba(255,255,255,0.5)",
        borderRadius: 24,
        padding: "24px 0",
      }}
    >
      <span style={{ fontSize: 56, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 24, color: MUTED, marginTop: 2 }}>{label}</span>
    </div>
  );

  const statBox = (label: string, value: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(255,255,255,0.8)",
        borderRadius: 28,
        padding: "26px 28px",
      }}
    >
      <span style={{ fontSize: 52, fontWeight: 700, color: INK }}>{value}</span>
      <span style={{ fontSize: 26, color: MUTED, marginTop: 4 }}>{label}</span>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 80,
          background: "linear-gradient(150deg, #faf8f3 0%, #eef4f0 55%, #e7efe9 100%)",
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{ display: "flex", width: 48, height: 48, borderRadius: 16, background: ACCENT, marginRight: 18 }}
            />
            <span style={{ fontSize: 44, fontWeight: 700 }}>Birdie</span>
          </div>
          <span style={{ fontSize: 26, color: MUTED, letterSpacing: 3 }}>TARJETA DE LA VUELTA</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 64 }}>
          <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>
            {course?.name ?? "Mi vuelta"}
          </span>
          <span style={{ fontSize: 34, color: MUTED, marginTop: 10 }}>
            {dateLabel} · Par {parPlayed}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 50 }}>
          <span style={{ fontSize: 240, fontWeight: 800, lineHeight: 0.9 }}>{totStrokes}</span>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 36, marginBottom: 28 }}>
            <span style={{ fontSize: 56, fontWeight: 800, color: ACCENT }}>{relLabel}</span>
            <span style={{ fontSize: 30, color: MUTED }}>golpes · al par</span>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 44 }}>
          {statBox("Putts", String(totPutts))}
          <div style={{ display: "flex", width: 20 }} />
          {statBox("Greens", `${gir}/18`)}
          <div style={{ display: "flex", width: 20 }} />
          {statBox("Calles", `${fwHit}/${fwHoles.length}`)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            {front.map(holeBox)}
            {totalBox("OUT", outStrokes)}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {back.map(holeBox)}
            {totalBox("IN", inStrokes)}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 56 }}>
          {distBox(GREEN, "Birdies", birdies)}
          <div style={{ display: "flex", width: 18 }} />
          {distBox(ACCENT, "Pares", pars)}
          <div style={{ display: "flex", width: 18 }} />
          {distBox(AMBER, "Bogeys", bogeys)}
          <div style={{ display: "flex", width: 18 }} />
          {distBox(RED, "Dobles+", doubles)}
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 28, color: FAINT }}>
            Birdie · tu juego de golf bajo control
          </span>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
