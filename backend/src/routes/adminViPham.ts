import { Hono } from "hono";
import type { Env } from "../types";
import { verifySessionMiddleware } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";
import { requireAdmin } from "../middleware/requireAdmin";
import { notifyKtvViPham } from "./nhanViPham";

// Route Admin-only: xu ly hang doi "chua xac dinh KTV" (khop ten that bai luc nhan tu DVBH, xem
// routes/nhanViPham.ts) - thieu phan nay thi vi pham bi lot se khong ai biet (xem ke hoach xay dung).
const adminViPham = new Hono<{ Bindings: Env }>();
adminViPham.use("*", verifySessionMiddleware, loadUser, requireAdmin);

// GET /vi-pham/chua-xac-dinh - danh sach vi pham CHUA khop duoc KTV nao (ky_thuat_vien_ma_ktv
// NULL), moi nhat truoc.
adminViPham.get("/vi-pham/chua-xac-dinh", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM vi_pham WHERE ky_thuat_vien_ma_ktv IS NULL ORDER BY nhan_luc DESC").all();
  return c.json({ rows: results });
});

// GET /vi-pham/ktv-options - danh sach KTV (de Admin chon khi gan tay) - chi can ma_ktv/ten_hien_thi.
adminViPham.get("/vi-pham/ktv-options", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT ma_ktv, ten_hien_thi, email_dang_nhap FROM ktv_lien_he ORDER BY ten_hien_thi").all();
  return c.json({ rows: results });
});

interface GanKtvBody {
  ma_ktv: string;
}

// PATCH /vi-pham/:id/gan-ktv - gan tay ky_thuat_vien_ma_ktv + kich hoat lai push/in-app noti (dung
// chung notifyKtvViPham() voi luong tu dong o nhanViPham.ts).
adminViPham.patch("/vi-pham/:id/gan-ktv", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<GanKtvBody>().catch(() => null);
  if (!body?.ma_ktv) return c.json({ error: "MISSING_MA_KTV" }, 400);

  const viPham = await c.env.DB.prepare("SELECT id, loai_loi, case_id FROM vi_pham WHERE id = ?").bind(id).first<{ id: string; loai_loi: string; case_id: string | null }>();
  if (!viPham) return c.json({ error: "NOT_FOUND" }, 404);

  const ktv = await c.env.DB.prepare("SELECT ma_ktv, ten_hien_thi, email_dang_nhap FROM ktv_lien_he WHERE ma_ktv = ?")
    .bind(body.ma_ktv)
    .first<{ ma_ktv: string; ten_hien_thi: string | null; email_dang_nhap: string | null }>();
  if (!ktv) return c.json({ error: "KTV_NOT_FOUND" }, 404);

  await c.env.DB.prepare("UPDATE vi_pham SET ky_thuat_vien_ma_ktv = ? WHERE id = ?").bind(ktv.ma_ktv, id).run();
  c.executionCtx.waitUntil(notifyKtvViPham(c.env, ktv, viPham));

  return c.json({ ok: true });
});

export default adminViPham;
