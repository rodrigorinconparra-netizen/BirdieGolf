# 🐦 Birdie

App para registrar tus vueltas de golf golpe a golpe, analizar tu juego con un
dashboard profesional y mejorar con un coach de IA.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — sistema de diseño estilo Apple (cream/beige, glassmorphism)
- **Neon** (Postgres) + **Drizzle ORM**
- **Auth propia** — bcrypt + JWT (`jose`) en cookie httpOnly, con roles `superadmin` / `player`
- **Groq** para el Coach IA (pendiente de integrar)

## Puesta en marcha

1. **Variables de entorno** — copia y rellena `.env.local` (ya creado):
   - `DATABASE_URL` → connection string de tu proyecto en [Neon](https://neon.tech)
   - `AUTH_SECRET` → ya generado
   - `GROQ_API_KEY` → desde https://console.groq.com/keys (para el Coach IA)

2. **Crear las tablas en Neon**:
   ```bash
   npm run db:push
   ```

3. **Crear el superadmin** (usa `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`):
   ```bash
   npm run db:seed
   ```

4. **Arrancar**:
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000

## Scripts de base de datos

| Script              | Descripción                                  |
| ------------------- | -------------------------------------------- |
| `npm run db:push`   | Sincroniza el esquema con Neon (rápido, dev) |
| `npm run db:generate` | Genera migraciones SQL versionadas         |
| `npm run db:migrate`| Aplica migraciones                           |
| `npm run db:studio` | Abre Drizzle Studio                          |
| `npm run db:seed`   | Crea el usuario superadmin                    |

## Estructura

```
src/
  app/
    (auth)/        login, registro y server actions de auth
    (app)/         área protegida: dashboard, vueltas, campos, entrenamientos, coach, admin
    manifest.ts    PWA
  components/
    ui/            Card, StatCard, Badge, EmptyState, PageHeader
    layout/        Sidebar, BottomNav, Topbar, configuración de navegación
  lib/
    auth/          jwt, session, password
    db/            schema (Drizzle), cliente, seed
  middleware.ts    protección de rutas + gate de admin
```

## Despliegue (Vercel)

> Nota: `npm run build` **falla en Windows** por un bug conocido de Next 16 al
> prerenderizar páginas internas (`/_global-error`), que se reproduce hasta en una
> app recién creada (vercel/next.js #87719). En **Linux (Vercel) el build funciona**.

**Variables de entorno a configurar en Vercel** (Project Settings → Environment Variables):

| Variable              | Necesaria | Valor                                   |
| --------------------- | --------- | --------------------------------------- |
| `DATABASE_URL`        | Sí        | Connection string de Neon (pooled)      |
| `AUTH_SECRET`         | Sí        | Cadena aleatoria (32+ bytes hex)        |
| `GROQ_API_KEY`        | Coach IA  | Key de https://console.groq.com/keys    |
| `GOLF_COURSE_API_KEY` | No        | (no se usa; campos vía OpenStreetMap)   |

**Opción rápida — Vercel CLI**:

```bash
npm i -g vercel
vercel login
vercel            # primer deploy (preview); pregunta y crea el proyecto
# añade las variables de entorno (dashboard o `vercel env add`) y luego:
vercel --prod
```

**Opción GitHub**: sube el repo a GitHub → importa en vercel.com → añade las
variables → deploy automático en cada push.

La base de datos (Neon) ya es cloud, así que funciona desde Vercel sin cambios.
Recuerda ejecutar las migraciones una vez (`npm run db:push`) contra tu Neon si no
lo has hecho.

## Roadmap

- [x] **Esqueleto**: auth + roles, navegación, dashboard, diseño Apple, esquema de DB
- [x] **Campos**: buscador de campos españoles (snapshot OpenStreetMap, `src/data/es-courses.json`) que autorrellena el formulario + pares por hoyo vía Overpass cuando existen + alta manual + **editar campo** + listado y detalle
- [x] **Vueltas**: editor hoyo a hoyo con palo de salida y de aproximación (desde tu bolsa), metros a bandera y fallo en el golpe a green y en el primer putt, bunker, penalidades; **GIR calculado** (no se pregunta); guardado por hoyo y totales en vivo
- [x] **Perfil + bolsa**: editar hándicap y gestionar tus palos (bolsa por defecto al crear usuario)
- [x] **Coach IA (chat)**: chat conversacional con Groq que conoce tu perfil, bolsa y vueltas; con historial. Desde una vuelta, el botón "Analizar con el Coach" abre el chat con un mensaje inicial. Requiere `GROQ_API_KEY`
- [x] **Entrenamientos**: registra tus sesiones (categoría, objetivo) y márcalas como hechas; el Coach propone ejercicios en el chat con botón "Añadir" → aparecen en "Recomendados por la IA"; el Coach conoce tus entrenamientos en el contexto
- [x] **Dashboard real**: métricas calculadas de tus vueltas (scoring, GIR%, calles%, putts/vuelta, up&down%) con tendencias (mejora/empeora), gráfica de evolución, reparto de resultados y aviso del punto débil que enlaza al Coach
- [x] **Estadísticas detalladas** (`/stats`): por palo (del drive al wedge) media de distancia y dispersión (izq/centro/der/corta/larga); putt con % de putts cortos (<2 m, contando el 2º putt) y desglose por distancia (intentos, % metidos, % 3-putts)
- [x] **Panel Admin** (`/admin`, solo superadmin): métricas globales (usuarios, jugadores, superadmins, vueltas, campos) y gestión de usuarios (cambiar rol, eliminar) con salvaguardas
- [x] **Evaluación automática de entrenamientos**: cada entrenamiento completado se evalúa comparando la métrica relevante (putts, calles, GIR, up&down o scoring según categoría) en tus vueltas antes vs después; se muestra "Mejoró/Empeoró" en Entrenamientos y el Coach lo conoce en su contexto
- [x] **Tarjeta de la vuelta** (scorecard): en `/rounds/[id]`, tabla tipo tarjeta física con todos los hoyos (par, golpes con forma birdie/bogey, putts, dirección de salida/aproximación/putt) y subtotales OUT/IN/TOT + totales (golpes, al par, putts, calles)
- [x] **Compartir tarjeta** (estilo Strava): botón en la vuelta que genera una imagen 1080×1920 (Instagram Stories) con `next/og` y la comparte (Web Share API en móvil) o la descarga
- [x] **Torneos** — Fase 1 (crear público/privado, campo, fecha, individual/liga anidada, salidas a tiro/progresivas + intervalo, turnos con inscripción y horarios de partidas, invitación enlace + WhatsApp) + Fase 2 (entrar a la partida hasta 1h antes, elegir marcador, marcar ambos resultados, aviso de hoyo que no coincide, firmar tarjeta cuando todo verificado → crea una vuelta real, clasificación en vivo con clic a la tarjeta de cada jugador, toggle de detalle/putts). Pendiente: puntos acumulados de liga, tiempo real entre dispositivos
- [x] **Social (estilo Strava)**: perfiles públicos + buscador de jugadores, seguir, hacer vueltas públicas (aparecen en tu perfil), feed con 2 pestañas (Siguiendo / Público por cercanía con geolocalización), campana de notificaciones cuando alguien a quien sigues (con aviso activado) publica una vuelta
- [x] **Torneos — ciclo de vida**: inicio del torneo (gatea "Mi tarjeta"), cierre de inscripción (al pasar genera partidas automáticamente), publicación de partidas (auto en fecha o manual por el organizador), y **gestión de partidas** por el admin (ver/editar hora y hoyo de salida, mover y quitar jugadores, añadir/eliminar partidas, regenerar)
- [x] **Torneos — formulario de creación contextual**: al elegir formato **Liga** (contenedor) se ocultan salidas, intervalos, inicio/cierre, publicación de partidas y turnos (la liga solo guarda los valores por defecto); al crear un torneo **dentro de una liga** no se pregunta la visibilidad: la hereda de la liga (solo participan sus miembros)
- [x] **Torneos — editar liga + co-organizadores**: el organizador puede **editar la liga** (nombre, visibilidad y valores por defecto: campo, salidas, intervalo) en `/tournaments/[id]/edit`, y **añadir co-organizadores** por email (sección "Organizadores"). Un co-organizador ("creador") puede crear y gestionar los torneos de la liga (turnos, partidas, inscripciones) — también dentro de cada torneo hijo —, pero solo el creador original puede eliminar la liga y gestionar los organizadores
- [x] **Torneos — dashboard por jugador**: dashboard de rendimiento por jugador (mismo estilo que el del perfil: scoring medio, GIR%, calles%, putts/vuelta, up&down, hándicap, evolución y reparto de resultados) en `/tournaments/[id]/player/[userId]`. En una **liga** agrega todas las vueltas firmadas del jugador en los torneos de la liga; en un **torneo** muestra su vuelta de ese torneo (con enlace a la tarjeta). Se accede tocando un jugador en la clasificación de la liga o del torneo
- [x] **Coach IA calibrado por hándicap**: el Coach adapta el nivel de exigencia de sus críticas y la dificultad de los entrenamientos al hándicap del jugador (a hándicap bajo exige consistencia/estrategia y metas ambiciosas; a hándicap alto se centra en lo básico y es más indulgente). Si el jugador no tiene hándicap, no lo tiene en cuenta
- [x] **Hándicap federativo (RFEG)**: en el perfil, introduciendo el **número de licencia** se sincroniza el hándicap exacto oficial desde la consulta pública de la RFEG (`ServicioHandicap.aspx?HLic=…`, sin login). Trae nombre, hándicap, estado y fecha de modificación, y guarda el hándicap (y la licencia) en el perfil. Exige coincidencia exacta de licencia para no confundir jugadores. Verificado con licencia real (devuelve hándicap correcto). Nota: depende de la web pública de la RFEG; el parser está aislado en `src/lib/federation.ts`
- [x] **Barras de salida (tees) por campo**: modelo `course_tees` (nombre, color, categoría caballeros/damas/mixta, valoración CR, slope) + `tee_hole_distances` (metros por hoyo). Editor admin en `/courses/[id]/tees` (añadir/editar/eliminar barras y sus metros por hoyo), y tarjeta de barras en la ficha del campo. Al **crear una vuelta**, la salida es un **desplegable** con las barras del campo seleccionado (con sus metros). Importados los **10 campos de Castilla-La Mancha** que están en OpenStreetMap (Cabanillas, Las Pinaíllas, Tomelloso, Villar de Olalla, Ciudad Real, Layos, La Lagunilla, Valdeluz, Illescas, Torrijos), filtrados por geocodificación inversa. Nota: OSM solo tiene el polígono de estos campos (no hoyos), así que se crean con par/metros de relleno y una barra "Estándar" vacía — los pares y metros reales por barra se introducen con el editor
- [ ] Caída (izq/der) y pendiente del putt, y juego corto multi-golpe
- [ ] Dashboard con métricas reales e indicadores positivo/negativo
- [ ] Coach IA con Groq + recomendaciones → entrenamientos
- [ ] Entrenamientos (propios + recomendados) y análisis de mejora
