import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Birdie — Tu juego de golf bajo control",
    short_name: "Birdie",
    description:
      "Registra tus vueltas golpe a golpe, analiza tu juego y mejora con un coach de IA.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#3a7d5d",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
