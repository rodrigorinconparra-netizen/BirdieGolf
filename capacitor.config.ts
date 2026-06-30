import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Birdie is a server-rendered Next.js app (DB, auth, server actions, AI), so it
 * cannot be statically exported. The native shell (iOS/Android) loads the
 * DEPLOYED site over HTTPS.
 *
 * Before building/syncing the native apps, set your production URL:
 *   - edit `server.url` below, or
 *   - set the env var:  CAP_SERVER_URL=https://tu-dominio  (then `npm run cap:sync`)
 */
const SERVER_URL =
  process.env.CAP_SERVER_URL ?? "https://REEMPLAZA-CON-TU-DOMINIO.vercel.app";

const config: CapacitorConfig = {
  appId: "com.birdiegolf.app",
  appName: "Birdie",
  webDir: "capacitor-www",
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
};

export default config;
