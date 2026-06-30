import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center p-6 text-center">
      <div className="glass p-8">
        <p className="text-5xl leading-none">🐦</p>
        <h1 className="mt-3 text-xl font-semibold">Página no encontrada</h1>
        <p className="mt-1 text-sm text-muted">No hemos encontrado lo que buscabas.</p>
        <Link href="/dashboard" className="btn-primary mt-5">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
