import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCourseWithHoles } from "@/lib/courses";
import { PageHeader } from "@/components/ui/page-header";
import { CourseForm, type CourseFormInitial } from "@/components/course-form";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = Number(id);
  const data = await getCourseWithHoles(courseId);
  if (!data) notFound();

  const { course, holes } = data;
  const initial: CourseFormInitial = {
    name: course.name,
    city: course.city,
    region: course.region,
    country: course.country,
    holesCount: course.holesCount,
    holes: Array.from({ length: course.holesCount }, (_, i) => {
      const h = holes.find((x) => x.number === i + 1);
      return {
        par: h?.par ?? 4,
        strokeIndex: h?.strokeIndex ?? null,
        distanceMeters: h?.distanceMeters ?? null,
      };
    }),
  };

  return (
    <>
      <Link
        href={`/courses/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> {course.name}
      </Link>

      <PageHeader title="Editar campo" subtitle="Modifica los datos y los hoyos del campo." />

      <CourseForm courseId={courseId} initial={initial} submitLabel="Guardar cambios" />
    </>
  );
}
