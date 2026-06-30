import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CourseForm } from "@/components/course-form";

export default function NewCoursePage() {
  return (
    <>
      <Link
        href="/courses"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Campos
      </Link>

      <PageHeader title="Nuevo campo" subtitle="Crea un campo manualmente con sus hoyos." />

      <CourseForm />
    </>
  );
}
