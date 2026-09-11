import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../types";
import { signSession } from "../lib/jwt";
import { verifySessionMiddleware, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";
import { nowVN } from "../lib/vnTime";

// Port tu linh-kien-app backend/src/routes/auth.ts, rut gon (khong "xem thu vai tro", khong dong
// bo khu-vuc/tram_cha - he nay khong co cac khai niem do). Dung CHUNG Google OAuth Client voi
// linh-kien-app (GOOGLE_CLIENT_ID/SECRET giong het gia tri, rieng GOOGLE_REDIRECT_URI tro ve
// .../api/auth/callback cua CHINH vi-pham-app - xem ke hoach xay dung).
const STATE_COOKIE = "vipham_oauth_state";

const auth = new Hono<{ Bindings: Env }>();

auth.get("/login", async (c) => {
  const state = crypto.randomUUID();
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = c.env.GOOGLE_REDIRECT_URI;
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

auth.get("/callback", async (c) => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });

  if (!code || !state || !savedState || state !== savedState) {
    return c.text("Xac thuc that bai: state khong hop le.", 400);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: c.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return c.text("Khong the doi ma xac thuc voi Google.", 502);
  const tokenJson = (await tokenRes.json()) as { access_token: string };

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userInfoRes.ok) return c.text("Khong the lay thong tin nguoi dung tu Google.", 502);
  const userInfo = (await userInfoRes.json()) as { email: string; email_verified: boolean; name?: string };

  if (!userInfo.email_verified) return c.text("Email Google chua duoc xac minh.", 403);

  const isBootstrapAdmin = userInfo.email === c.env.BOOTSTRAP_ADMIN_EMAIL;

  // Auto-activate: neu email khop 1 dong ktv_lien_he.email_dang_nhap (cache tu linh-kien-app), tu
  // dong kich hoat tai khoan (bo qua buoc Admin duyet) - dung logic voi linh-kien-app auth.ts.
  // KHONG BAO GIO ghi de 1 tai khoan da duyet/khoa/gan Admin thu cong truoc do (xem CASE WHEN).
  let isKtvMatch = false;
  if (!isBootstrapAdmin) {
    const ktvRow = await c.env.DB.prepare("SELECT 1 as x FROM ktv_lien_he WHERE email_dang_nhap = ?").bind(userInfo.email).first();
    isKtvMatch = !!ktvRow;
  }

  await c.env.DB.prepare(
    `INSERT INTO users (email, ten, vai_tro, trang_thai_duyet)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       ten = excluded.ten,
       updated_at = ?,
       trang_thai_duyet = CASE WHEN trang_thai_duyet = 'Cho duyet' AND ? = 1 THEN 'Da duyet' ELSE trang_thai_duyet END`,
  )
    .bind(
      userInfo.email,
      userInfo.name ?? null,
      isBootstrapAdmin ? "Admin" : null,
      isBootstrapAdmin || isKtvMatch ? "Da duyet" : "Cho duyet",
      nowVN(),
      isKtvMatch ? 1 : 0,
    )
    .run();

  const token = await signSession({ email: userInfo.email }, c.env.SESSION_SECRET, SESSION_TTL_SECONDS);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return c.redirect(c.env.FRONTEND_URL || "/");
});

// GET /api/auth/dev-login - cua sau CHI hoat dong khi LOCAL_DEV_BYPASS_AUTH=true (chi dat trong
// .dev.vars, khong bao gio co tren production). Dang nhap thang vao BOOTSTRAP_ADMIN_EMAIL voi
// vai_tro Admin de test giao dien local day du - port tu linh-kien-app.
auth.get("/dev-login", async (c) => {
  if (c.env.LOCAL_DEV_BYPASS_AUTH !== "true") return c.text("Not found", 404);

  const email = c.env.BOOTSTRAP_ADMIN_EMAIL;
  await c.env.DB.prepare(
    `INSERT INTO users (email, ten, vai_tro, trang_thai_duyet)
     VALUES (?, ?, 'Admin', 'Da duyet')
     ON CONFLICT(email) DO UPDATE SET updated_at = ?`,
  )
    .bind(email, "Dev Admin (local bypass)", nowVN())
    .run();

  const token = await signSession({ email }, c.env.SESSION_SECRET, SESSION_TTL_SECONDS);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return c.redirect(c.env.FRONTEND_URL || "/");
});

auth.post("/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

auth.get("/me", verifySessionMiddleware, loadUser, async (c) => {
  const user = c.get("user");
  return c.json({ user });
});

export default auth;
