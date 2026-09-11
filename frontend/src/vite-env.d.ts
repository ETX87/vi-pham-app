/// <reference types="vite/client" />

// Badging API (navigator.setAppBadge/clearAppBadge) - chua co trong lib.dom.d.ts mac dinh cua TS.
// Ho tro Chrome/Edge (desktop + Android) khi PWA da cai dat, KHONG ho tro iOS Safari.
interface Navigator {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}
