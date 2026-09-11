import { Hono } from "hono";
import type { Env } from "../types";
import { verifySessionMiddleware } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";

// Dang ky/huy Web Push subscription - port nguyen ban tu linh-kien-app backend/src/routes/push.ts.
const push = new Hono<{ Bindings: Env }>();
push.use("*", verifySessionMiddleware, loadUser);

// GET /api/push/vapid-public-key - khong nhay cam (public key), frontend can gia tri nay lam
// applicationServerKey cho PushManager.subscribe().
push.get("/vapid-public-key", (c) => c.json({ publicKey: c.env.VAPID_SERVER_PUBLIC_KEY }));

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// POST /api/push/subscribe - luu/cap nhat 1 PushSubscription. "endpoint" la khoa tu nhien (UNIQUE).
push.post("/subscribe", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<SubscribeBody>();
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) return c.json({ error: "INVALID_BODY" }, 400);
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (nguoi_dung, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET nguoi_dung = excluded.nguoi_dung, p256dh = excluded.p256dh, auth = excluded.auth`,
  )
    .bind(user.email, body.endpoint, body.keys.p256dh, body.keys.auth)
    .run();
  return c.json({ ok: true });
});

// POST /api/push/unsubscribe - goi khi nguoi dung tu tat thong bao day (xoa dong tuong ung).
push.post("/unsubscribe", async (c) => {
  const body = await c.req.json<{ endpoint: string }>();
  if (!body.endpoint) return c.json({ error: "INVALID_BODY" }, 400);
  await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(body.endpoint).run();
  return c.json({ ok: true });
});

export default push;
