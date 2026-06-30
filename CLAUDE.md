# Birdie — guía para Claude

App de golf (registro de vueltas golpe a golpe + dashboard + coach IA). En español.

## Stack y decisiones

- **Next.js 16 (App Router) + React 19 + TS**, Tailwind v4, Neon (Postgres) + Drizzle.
- **Auth propia** (bcrypt + `jose` JWT en cookie httpOnly), NO NextAuth — elegido por
  compatibilidad con Next 16. Roles: `superadmin`, `player`. Ver `src/lib/auth/*`.
- **Diseño estilo Apple**: cream/beige, glassmorphism, bordes redondeados. Clases
  utilitarias en `globals.css`: `.glass`, `.glass-soft`, `.field`, `.btn-primary`, `.btn-ghost`.
  Colores de tema (`bg-accent`, `text-ink`, `text-muted`, `bg-positive`, ...) en `@theme`.

## Convenciones

- Rutas protegidas bajo `src/app/(app)/`; auth bajo `src/app/(auth)/`.
- `middleware.ts` redirige sin sesión a `/login` y restringe `/admin` a superadmin.
- Tailwind v4: **no** usar `@apply` con clases de componente propias (solo utilidades/tema).
- Lógica de servidor → Server Actions; validación con Zod.
- DB: editar `src/lib/db/schema.ts` y luego `npm run db:push`.

## Estado

Hecho: esqueleto (auth, navegación, dashboard placeholder, esquema DB) + módulo Campos
(GolfCourseAPI buscar/importar, alta manual con hoyos, listado y detalle).
Pendiente: editor de vueltas golpe a golpe, métricas reales, Coach IA (Groq), entrenamientos.

## Bug conocido: `next build`

`npm run build` falla al prerenderizar las páginas internas `/_global-error` y `/_not-found`
(`InvariantError: Expected workStore to be initialized`). Es un bug de Next 16 en Windows
(vercel/next.js #87719, #91642), reproducible en 16.1.x/16.2.x y en Turbopack/webpack; NO es
del código (compile + TypeScript pasan). `npm run dev` funciona bien. Revisar al desplegar.
