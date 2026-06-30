import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// App is session/DB driven → render dynamically (avoids static prerender).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Birdie — Tu juego de golf bajo control",
  description:
    "Registra tus vueltas golpe a golpe, analiza tu juego con un dashboard profesional y mejora con un coach de IA.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Birdie",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf8f3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Let content extend under the notch / home indicator so safe-area insets work
  // when wrapped in the native (Capacitor) shell.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
