import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus, Trash2, Flag, Wand2 } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getCourseWithHoles } from "@/lib/courses";
import { getCourseTees } from "@/lib/tees";
import { PageHeader } from "@/components/ui/page-header";
import {
  addTeeAction,
  updateTeeAction,
  deleteTeeAction,
  addStandardTeesAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const GENDER_LABEL: Record<string, string> = {
  men: "Caballeros",
  women: "Damas",
  any: "Mixta",
};

export default async function CourseTeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (session?.role !== "superadmin") notFound();

  const data = await getCourseWithHoles(Number(id));
  if (!data) notFound();
  const { course } = data;
  const tees = await getCourseTees(course.id);

  const holeNumbers = Array.from({ length: course.holesCount }, (_, i) => i + 1);
  const out = holeNumbers.slice(0, 9);
  const inHoles = holeNumbers.slice(9);

  return (
    <>
      <Link
        href={`/courses/${course.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> {course.name}
      </Link>

      <PageHeader
        title="Barras de salida"
        subtitle="Gestiona las barras del campo (Blancas, Amarillas, Azules, Rojas…) y sus metros por hoyo."
        action={
          <form action={addStandardTeesAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <button type="submit" className="btn-ghost">
              <Wand2 className="h-4 w-4" /> Añadir Amarillas y Rojas
            </button>
          </form>
        }
      />

      {tees.length === 0 ? (
        <div className="glass p-5 text-sm text-muted">
          Este campo aún no tiene barras. Añade la primera abajo.
        </div>
      ) : (
        <div className="space-y-5">
          {tees.map((tee) => (
            <form key={tee.id} action={updateTeeAction} className="glass space-y-4 p-5">
              <input type="hidden" name="teeId" value={tee.id} />
              <input type="hidden" name="courseId" value={course.id} />
              <input type="hidden" name="holesCount" value={course.holesCount} />

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <span
                    className="h-9 w-9 shrink-0 rounded-full border border-black/15"
                    style={{ backgroundColor: tee.color ?? "#e5e7eb" }}
                    title={tee.color ?? ""}
                  />
                  <label className="block">
                    <span className="mb-1 block text-xs text-faint">Nombre</span>
                    <input name="name" defaultValue={tee.name} required className="field w-36" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-faint">Color</span>
                    <input
                      type="color"
                      name="color"
                      defaultValue={tee.color ?? "#facc15"}
                      className="h-10 w-14 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-faint">Categoría</span>
                    <select name="gender" defaultValue={tee.gender} className="field w-32">
                      <option value="any">Mixta</option>
                      <option value="men">Caballeros</option>
                      <option value="women">Damas</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-faint">Valoración (CR)</span>
                    <input
                      name="courseRating"
                      type="number"
                      step="0.1"
                      defaultValue={tee.courseRating ?? ""}
                      className="field w-24"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-faint">Slope</span>
                    <input
                      name="slopeRating"
                      type="number"
                      defaultValue={tee.slopeRating ?? ""}
                      className="field w-20"
                    />
                  </label>
                </div>
                <span className="text-sm text-muted">
                  Total:{" "}
                  <span className="font-semibold text-ink">
                    {tee.totalMeters ? tee.totalMeters.toLocaleString("es-ES") : "—"}
                  </span>{" "}
                  m
                </span>
              </div>

              <MetersRow label="Ida" holes={out} distances={tee.distances} />
              {inHoles.length ? (
                <MetersRow label="Vuelta" holes={inHoles} distances={tee.distances} />
              ) : null}

              <div className="flex items-center gap-2 border-t border-black/5 pt-3">
                <button type="submit" className="btn-primary">
                  Guardar barra
                </button>
                <button
                  type="submit"
                  formAction={deleteTeeAction}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-negative/20 px-3 py-2 text-sm font-medium text-negative transition hover:bg-negative/10"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              </div>
            </form>
          ))}
        </div>
      )}

      <form action={addTeeAction} className="glass flex flex-wrap items-end gap-3 p-5">
        <input type="hidden" name="courseId" value={course.id} />
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-accent" />
          <h3 className="font-semibold">Añadir barra</h3>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Nombre</span>
          <input name="name" placeholder="Amarillas" required className="field w-36" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Color</span>
          <input
            type="color"
            name="color"
            defaultValue="#facc15"
            className="h-10 w-14 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Categoría</span>
          <select name="gender" defaultValue="any" className="field w-32">
            <option value="any">Mixta</option>
            <option value="men">Caballeros</option>
            <option value="women">Damas</option>
          </select>
        </label>
        <button type="submit" className="btn-primary">
          <Plus className="h-4 w-4" /> Añadir barra
        </button>
      </form>

      <p className="text-xs text-faint">
        Categorías: {GENDER_LABEL.men}, {GENDER_LABEL.women}, {GENDER_LABEL.any}. Los metros que
        dejes vacíos quedarán sin registrar.
      </p>
    </>
  );
}

function MetersRow({
  label,
  holes,
  distances,
}: {
  label: string;
  holes: number[];
  distances: Record<number, number | null>;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-faint">{label}</p>
      <div className="flex flex-wrap gap-2">
        {holes.map((n) => (
          <label key={n} className="block w-16">
            <span className="mb-0.5 block text-center text-[11px] text-faint">{n}</span>
            <input
              name={`m_${n}`}
              type="number"
              min={0}
              defaultValue={distances[n] ?? ""}
              className="field !px-2 !py-1.5 text-center text-sm"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

