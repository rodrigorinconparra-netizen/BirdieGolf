"use client";

import { useEffect } from "react";
import { registerDeviceTokenAction } from "@/app/(app)/push-actions";

/**
 * Registers the device for native push notifications (Capacitor) and stores the
 * FCM token. No-op on the web (only runs inside the native app).
 */
export function PushRegistrar() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const platform = Capacitor.getPlatform();
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;

        // Listeners must be set before register() so we don't miss the event.
        // Android: the registration token IS the FCM token.
        // iOS: registration gives an APNs token, but the server sends via FCM,
        // so we fetch the FCM token from Firebase once APNs has registered.
        await PushNotifications.addListener("registration", async (tok) => {
          if (cancelled) return;
          if (platform === "ios") {
            try {
              const { FCM } = await import("@capacitor-community/fcm");
              const { token } = await FCM.getToken();
              if (token) void registerDeviceTokenAction(token, "ios");
            } catch {
              /* FCM not available */
            }
          } else {
            void registerDeviceTokenAction(tok.value, platform);
          }
        });
        await PushNotifications.addListener("registrationError", () => {
          /* ignore */
        });

        await PushNotifications.register();
      } catch {
        /* push not available */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
