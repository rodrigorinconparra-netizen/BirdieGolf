"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf8f3",
          color: "#1c1c1e",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: 0 }}>🐦</p>
          <h1 style={{ fontSize: 20, marginTop: 12 }}>Algo ha ido mal</h1>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 16,
              border: "none",
              background: "#3a7d5d",
              color: "white",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
