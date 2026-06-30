export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="text-4xl leading-none">🐦</span>
          <h1 className="text-2xl font-semibold tracking-tight">Birdie</h1>
          <p className="text-sm text-muted">Tu juego de golf, bajo control.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
