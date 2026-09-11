import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../types";
import { verifySessionMiddleware } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";
import { requireAdmin } from "../middleware/requireAdmin";
import { encryptSecret } from "../lib/secretBox";
import { nowVN } from "../lib/vnTime";

// Man Admin toi gian (viec bat buoc phai co theo MVP - xem ke hoach xay dung): ket noi Google Drive
// OAuth (1 lan luc deploy). Port pattern Drive OAuth tu linh-kien-app backend/src/routes/
// settingsDatMua.ts. Danh ba KTV la CACHE doc-only nhan tu linh-kien-app (routes/syncKtv.ts, day
// vao moi gio) - khong co nut "dong bo ngay" o day vi vi-pham-app khong phai ben chu dong goi.
const settings = new Hono<{ Bindings: Env }>();
settings.use("*", verifySessionMiddleware, loadUser, requireAdmin);

// ---------- Google Drive OAuth (uy quyen 1 tai khoan Google THAT de upload anh giai trinh) ----------
const GOOGLE_DRIVE_STATE_COOKIE = "vipham_drive_oauth_state";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file openid email profile";

settings.get("/google-drive/status", async (c) => {
  const row = await c.env.DB.prepare("SELECT google_email, folder_id, authorized_by, authorized_at FROM google_drive_oauth WHERE id = 1").first<{
    google_email: string;
    folder_id: string;
    authorized_by: string;
    authorized_at: string;
  }>();
  if (!row) return c.json({ connected: false });
  return c.json({ connected: true, ...row });
});

settings.get("/google-drive/authorize", async (c) => {
  const state = crypto.randomUUID();
  setCookie(c, GOOGLE_DRIVE_STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 600, path: "/" });

  const redirectUri = `${new URL(c.req.url).origin}/api/settings/google-drive/callback`;
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPE,
    state,
    access_type: "offline",
    prompt: "consent select_account",
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

settings.get("/google-drive/callback", async (c) => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = getCookie(c, GOOGLE_DRIVE_STATE_COOKIE);
  deleteCookie(c, GOOGLE_DRIVE_STATE_COOKIE, { path: "/" });

  if (!code || !state || !savedState || state !== savedState) {
    return c.text("Xac thuc that bai: state khong hop le.", 400);
  }

  const redirectUri = `${url.origin}/api/settings/google-drive/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return c.text("Khong the doi ma xac thuc voi Google: " + (await tokenRes.text()), 502);
  const tokenJson = (await tokenRes.json()) as { access_token: string; refresh_token?: string };
  if (!tokenJson.refresh_token) {
    return c.text(
      "Google khong tra ve refresh_token (co the tai khoan da tung uy quyen truoc do) - vao myaccount.google.com/permissions, go quyen truy cap cua app nay roi thu lai.",
      400,
    );
  }

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userInfoRes.ok) return c.text("Khong the lay thong tin nguoi dung tu Google.", 502);
  const userInfo = (await userInfoRes.json()) as { email: string };

  const folderRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenJson.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Vi pham - Anh bang chung giai trinh", mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!folderRes.ok) return c.text("Khong the tao folder Drive: " + (await folderRes.text()), 502);
  const { id: folderId } = (await folderRes.json()) as { id: string };

  const refreshTokenEnc = await encryptSecret(c.env, tokenJson.refresh_token);
  const user = c.get("user");
  await c.env.DB.prepare(
    `INSERT INTO google_drive_oauth (id, google_email, refresh_token_enc, folder_id, authorized_by, authorized_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       google_email = excluded.google_email, refresh_token_enc = excluded.refresh_token_enc,
       folder_id = excluded.folder_id, authorized_by = excluded.authorized_by, authorized_at = excluded.authorized_at`,
  )
    .bind(userInfo.email, refreshTokenEnc, folderId, user.email, nowVN())
    .run();

  return c.redirect(c.env.FRONTEND_URL || "/");
});

// ---------- Danh ba KTV (cache doc-only tu linh-kien-app) ----------

// GET /google-drive/... o tren + /ktv-lien-he-status duoi day deu Admin-only (route.use("*") o dau
// file). Chi hien thi trang thai cache (linh-kien-app moi la ben chu dong day du lieu vao) - dung de
// Admin kiem tra nhanh xem POST /api/partner/sync/ktv da nhan duoc du lieu lan nao chua.
settings.get("/ktv-lien-he-status", async (c) => {
  const row = await c.env.DB.prepare("SELECT COUNT(*) as cnt, MAX(cap_nhat_luc) as gan_nhat FROM ktv_lien_he").first<{ cnt: number; gan_nhat: string | null }>();
  return c.json({ soLuong: row?.cnt ?? 0, capNhatGanNhat: row?.gan_nhat ?? null });
});

export default settings;
