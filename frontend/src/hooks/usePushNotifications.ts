import { useEffect, useState } from "react";
import { api } from "../api/client";

// Port nguyen ban tu linh-kien-app frontend/src/hooks/usePushNotifications.ts.
const SUPPORTED = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!SUPPORTED) {
      setChecked(true);
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false))
      .finally(() => setChecked(true));
  }, []);

  async function subscribe() {
    if (!SUPPORTED || busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Bạn chưa cấp quyền thông báo cho trình duyệt/thiết bị này.");
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await api.get<{ publicKey: string }>("/push/vapid-public-key");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    if (!SUPPORTED || busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post("/push/unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }

  return { supported: SUPPORTED, checked, subscribed, busy, subscribe, unsubscribe };
}
