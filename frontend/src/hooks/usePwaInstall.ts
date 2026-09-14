import { useEffect, useState } from "react";

// Chrome/Edge (Android + desktop) khong co trong lib.dom.d.ts mac dinh cua TS - xem vite-env.d.ts.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandaloneNow(): boolean {
  // iOS Safari dung navigator.standalone (khong chuan, khong co trong TS DOM lib) thay vi
  // matchMedia display-mode nhu Chrome/Edge.
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Nhac nguoi dung "Them vao Man hinh chinh" (PWA install) - can THEM VAO ICON THAT (khong phai
 * shortcut/bookmark thuong) de Badging API + push hoat dong dung tren Android (xem skill
 * qlbh3t-cf-integrations). Android Chrome/Edge co su kien "beforeinstallprompt" de tu goi prompt cai
 * dat; iOS Safari KHONG co su kien nay - phai huong dan tay (Chia se > Them vao Man hinh chinh). */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(isStandaloneNow);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setDeferredPrompt(null);
      setStandalone(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return {
    standalone,
    isIOS,
    // Android/Chrome/Edge: chi hien nut khi trinh duyet da xac nhan co the cai (su kien da ban).
    // iOS: khong co su kien nay - luon coi la "co the huong dan" tru khi da o che do standalone.
    canPrompt: !!deferredPrompt,
    showRow: !standalone && (!!deferredPrompt || isIOS),
    promptInstall,
  };
}
