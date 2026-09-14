import { Hono } from "hono";
import type { Env } from "./types";
import authRoutes from "./routes/auth";
import nhanViPhamRoutes from "./routes/nhanViPham";
import giaiTrinhRoutes from "./routes/giaiTrinh";
import adminViPhamRoutes from "./routes/adminViPham";
import adminUsersRoutes from "./routes/adminUsers";
import pushRoutes from "./routes/push";
import settingsRoutes from "./routes/settings";
import syncKtvRoutes from "./routes/syncKtv";
import loaiLoiRoutes from "./routes/loaiLoi";
import { retryPendingGiaiTrinh } from "./lib/dvbhClient";

// He doc lap "Giai trinh vi pham" - nhan ban kien truc linh-kien-app (xem ke hoach xay dung). Cron
// DUY NHAT (moi dau gio): retry cac giai trinh chua dong bo duoc ve DVBH. Danh ba KTV KHONG dong bo
// qua cron o day - linh-kien-app chu dong day sang qua POST /api/partner/sync/ktv (routes/syncKtv.ts).
const app = new Hono<{ Bindings: Env }>();

// Request ID nhe - gan 1 id ngau nhien cho MOI request, dinh kem vao log server (console.error) +
// response loi generic cua onError() ben duoi, de doi chieu 2 ben khi co su co.
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
});

app.route("/api/auth", authRoutes);
app.route("/api/nhan-vi-pham", nhanViPhamRoutes);
app.route("/api/giai-trinh", giaiTrinhRoutes);
app.route("/api/admin", adminViPhamRoutes);
app.route("/api/admin/users", adminUsersRoutes);
app.route("/api/push", pushRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/partner/sync", syncKtvRoutes);
app.route("/api/loai-loi", loaiLoiRoutes);

app.onError((err, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  console.error(`[${requestId}]`, err);
  return c.json({ error: "INTERNAL_ERROR", requestId }, 500);
});

app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  // Cron Trigger (wrangler.jsonc "triggers.crons": "0 * * * *", moi dau gio). waitUntil() de
  // Cloudflare khong cat request truoc khi lenh goi HTTP hoan tat. Retry giai trinh chua dong bo
  // duoc ve DVBH - danh ba KTV KHONG nam trong cron nay (xem ghi chu tren dau file).
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(retryPendingGiaiTrinh(env, env.DB));
  },
};
