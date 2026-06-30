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
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;
        await PushNotifications.register();

        await PushNotifications.addListener("registration", (tok) => {
          if (!cancelled) void registerDeviceTokenAction(tok.value, Capacitor.getPlatform());
        });
        await PushNotifications.addListener("registrationError", () => {
          /* ignore */
        });
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
