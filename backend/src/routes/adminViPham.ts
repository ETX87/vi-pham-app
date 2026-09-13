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

// GET /vi-pham/tat-ca?ma_ktv=&trang_thai=chua-xu-ly|dang-cho-dong-bo|da-xu-ly&search=&page=&pageSize=
// Toan bo vi pham he thong (khong loc theo nguoi dang nhap nhu GET /giai-trinh/vi-pham cua KTV) -
// thieu route nay Admin chi thay duoc hang doi "chua xac dinh KTV", khong co cach nao xem tong quan
// toan he (xem phan hoi nguoi dung "admin co nhin thay toan bo khong?"). Tra ten_hien_thi tu
// ktv_lien_he (chuan hoa) thay vi ky_thuat_vien_ten tho tu DVBH khi da khop duoc KTV.
adminViPham.get("/vi-pham/tat-ca", async (c) => {
  const maKtv = c.req.query("ma_ktv")?.trim();
  const trangThai = c.req.query("trang_thai")?.trim();
  const search = c.req.query("search")?.trim();
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(c.req.query("pageSize")) || 50));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (maKtv) {
    conditions.push("vp.ky_thuat_vien_ma_ktv = ?");
    binds.push(maKtv);
  }
  if (search) {
    conditions.push("(LOWER(COALESCE(vp.case_id,'')) LIKE LOWER(?) OR LOWER(COALESCE(vp.khach_hang,'')) LIKE LOWER(?) OR LOWER(COALESCE(vp.seri_san_pham,'')) LIKE LOWER(?) OR LOWER(COALESCE(vp.ky_thuat_vien_ten,'')) LIKE LOWER(?))");
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  // 4 trang thai khop DUNG logic components/StatusBadge.tsx ben frontend (viPhamStatus()) - viet lai
  // bang EXISTS truc tiep vi SQLite khong cho WHERE tham chieu alias cua chinh SELECT do. Thu tu uu
  // tien giong het frontend: da chot loi > cho chot loi > qua han > chua giai trinh.
  const daGiaiTrinh = "EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id)";
  const dangChoDongBo = "EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id AND gt.dong_bo_dvbh_luc IS NULL)";
  // "ngay_ghi_nhan" luu gio VN dia phuong dang chuoi (xem lib/vnTime.ts) - datetime('now') cua SQLite
  // tra ve UTC nen phai cong +7h de cung quy uoc truoc khi tru 48h, roi so sanh CHUOI (an toan vi
  // cung 1 format YYYY-MM-DD HH:MM:SS).
  const quaHan = `vp.ngay_ghi_nhan <= datetime('now', '+7 hours', '-48 hours')`;
  if (trangThai === "chua-giai-trinh") {
    conditions.push(`vp.chot_bo_cap_2 IS NULL AND NOT ${daGiaiTrinh} AND NOT (${quaHan})`);
  } else if (trangThai === "qua-han") {
    conditions.push(`vp.chot_bo_cap_2 IS NULL AND NOT ${daGiaiTrinh} AND ${quaHan}`);
  } else if (trangThai === "cho-chot-loi") {
    conditions.push(`vp.chot_bo_cap_2 IS NULL AND ${daGiaiTrinh}`);
  } else if (trangThai === "da-chot-loi") {
    conditions.push(`vp.chot_bo_cap_2 IS NOT NULL`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM vi_pham vp ${where}`).bind(...binds).first<{ total: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT vp.*, ktv.ten_hien_thi as ten_ktv_khop,
            ${daGiaiTrinh} as da_giai_trinh, ${dangChoDongBo} as dang_cho_dong_bo
     FROM vi_pham vp LEFT JOIN ktv_lien_he ktv ON ktv.ma_ktv = vp.ky_thuat_vien_ma_ktv
     ${where} ORDER BY vp.nhan_luc DESC LIMIT ? OFFSET ?`,
  )
    .bind(...binds, pageSize, offset)
    .all();

  return c.json({ rows: results, page, pageSize, total: countRow?.total ?? 0 });
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
