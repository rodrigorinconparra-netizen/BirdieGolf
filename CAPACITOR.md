# 📱 Birdie en Play Store y App Store (Capacitor)

Birdie es una app **Next.js con servidor** (BD, login, server actions, IA), así que **no** se
puede exportar como estática. La solución es **Capacitor**: una cápsula nativa (iOS/Android) que
carga tu web **ya desplegada** por HTTPS. Los cambios que hagas en la web se reflejan al instante
en la app, sin volver a subir a la tienda (salvo cambios del propio contenedor).

Capacitor ya está instalado y los proyectos nativos (`android/`, `ios/`) creados.

## Paso 1 — Despliega la web (Vercel)

Sube el proyecto a Vercel con las variables `DATABASE_URL`, `AUTH_SECRET`, `GROQ_API_KEY`.
Anota la URL final (ej. `https://birdie.vercel.app` o tu dominio).

## Paso 2 — Apunta la app a esa URL

Edita `capacitor.config.ts` → `server.url` con tu URL **real**, o ejecuta con la variable:

```bash
# opción A: edita el archivo y luego
npm run cap:sync

# opción B: sin editar el archivo
CAP_SERVER_URL=https://tu-dominio npm run cap:sync
```

> ⚠️ Si dejas el placeholder `REEMPLAZA-CON-TU-DOMINIO`, la app no cargará nada.

## Paso 3 — Iconos y splash (opcional pero recomendado)

```bash
# coloca un icon.png (1024×1024) y splash.png en ./resources y:
npm i -D @capacitor/assets
npx capacitor-assets generate
```

O ponlos a mano desde Android Studio / Xcode.

## Android → Play Store (desde Windows)

```bash
npm run cap:android      # sincroniza y abre Android Studio
```

En Android Studio: **Build → Generate Signed Bundle/APK → Android App Bundle (.aab)**, fírmalo y
súbelo a la **Play Console** (cuenta de desarrollador: 25 € pago único).

## iOS → App Store (necesita un Mac)

```bash
cd ios/App && pod install        # solo la primera vez (en macOS, con CocoaPods)
cd ../.. && npm run cap:ios       # sincroniza y abre Xcode
```

En Xcode: selecciona tu **Team** (cuenta Apple Developer, 99 €/año), **Product → Archive** y sube a
**App Store Connect**. Apple es estricta con apps "solo web" (regla 4.2): ayuda añadir algo nativo
(notificaciones push, cámara). Pídemelo si quieres integrarlo.

## Datos del contenedor

- **appId**: `com.birdiegolf.app` — es **permanente** en la tienda. Cámbialo en `capacitor.config.ts`
  **antes** de la primera publicación si quieres otro.
- **appName**: `Birdie`.

## Notificaciones push nativas (Firebase Cloud Messaging)

Las notificaciones in-app ya existen; las **push** (que llegan al móvil con la app cerrada) usan
**FCM** (cubre Android e iOS). Está todo cableado: el dispositivo registra su token al abrir la app
y el servidor envía push al crear una vuelta (a tus seguidores) o un torneo en una liga (a sus
miembros). Solo falta tu configuración de Firebase:

1. Crea un proyecto en [Firebase](https://console.firebase.google.com).
2. **Android**: añade una app Android (applicationId `com.birdiegolf.app`), descarga
   `google-services.json` y ponlo en `android/app/`.
3. **iOS**: añade una app iOS, sube tu **APNs Auth Key** en Firebase (Project settings → Cloud
   Messaging), y añade `GoogleService-Info.plist` al proyecto en Xcode. Activa la capability
   *Push Notifications* y *Background Modes → Remote notifications*.
4. **Servidor** (Vercel): crea una **cuenta de servicio** (Project settings → Service accounts →
   Generate new private key) y pon estas variables de entorno:
   - `FCM_PROJECT_ID` → el project id
   - `FCM_CLIENT_EMAIL` → el `client_email` del JSON
   - `FCM_PRIVATE_KEY` → el `private_key` del JSON (con los `\n` tal cual)

Sin estas variables, el envío de push es **no-op** (la app funciona igual, solo no manda push).

## A tener en cuenta (probar en el dispositivo)

- **Login**: usa cookie de sesión; en el WebView funciona al ser el mismo dominio. Verifica que la
  sesión se mantiene al cerrar y abrir la app.
- **Compartir tarjeta (Instagram)**: usa la Web Share API con descarga de respaldo. Si en el WebView
  no comparte, se puede integrar `@capacitor/share` (dímelo).
- Tras cualquier cambio de configuración del contenedor: `npm run cap:sync`.
