import type { Context, Next } from "hono";
import type { Env } from "../types";

// Xac thuc DVBH khi no goi SANG POST /api/nhan-vi-pham (PARTNER_API_GUIDE.md muc 9.1) - khac han
// partnerApiAuth() cua linh-kien-app (bang partner_api_keys nhieu-key, hash SHA-256): o day chi co
// DUY NHAT 1 doi tac goi vao endpoint nay (DVBH), nen so sanh HANG SO co dinh voi secret
// env.DVBH_INBOUND_API_KEY - khong can bang DB rieng.
//
// So sanh CONSTANT-TIME (khong dung === truc tiep tren chuoi bi mat) de tranh timing attack do
// JS string so sanh tu dung khi gap ky tu dau tien khac nhau.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  // Do dai khac nhau van phai duyet het bufA (khong return som) de khong lo do dai qua thoi gian
  // xu ly - nhung van phai tra false chinh xac o cuoi.
  const maxLen = Math.max(bufA.length, bufB.length, 1);
  let diff = bufA.length === bufB.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    const byteA = i < bufA.length ? bufA[i] : 0;
    const byteB = i < bufB.length ? bufB[i] : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

// Middleware dung chung cho MOI endpoint nhan goi vao co dung 1 doi tac 1-1 (khong can bang DB nhieu-
// key nhu linh-kien-app): POST /api/nhan-vi-pham (DVBH goi sang, mac dinh DVBH_INBOUND_API_KEY) va
// POST /api/partner/sync/ktv (linh-kien-app goi sang, KTV_SYNC_API_KEY - truyen getKey rieng). KHONG
// BAO GIO log gia tri key (dung ca khi loi) - chi log co/khong co header.
export function inboundAuth(getExpectedKey: (env: Env) => string | undefined = (env) => env.DVBH_INBOUND_API_KEY) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const apiKey = c.req.header("X-API-Key");
    if (!apiKey) return c.json({ error: "MISSING_API_KEY" }, 401);
    const expected = getExpectedKey(c.env);
    if (!expected || !timingSafeEqual(apiKey, expected)) {
      return c.json({ error: "INVALID_API_KEY" }, 401);
    }
    await next();
  };
}
