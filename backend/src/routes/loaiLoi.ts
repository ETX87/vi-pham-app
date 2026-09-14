import { Hono } from "hono";
import type { Env } from "../types";
import { verifySessionMiddleware } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";
import { requireAdmin } from "../middleware/requireAdmin";
import { nowVN } from "../lib/vnTime";

// Dinh nghia mo ta chi tiet cho tung loai_loi (migration 0005) - KTV bam dau (?) tren card vi pham
// de xem mo ta nay (truoc gio chi thay ten loi ngan gon, khong hieu ro loi gi - xem phan hoi nguoi
// dung). GET mo cho MOI nguoi dung da dang nhap (KTV can doc de hien tooltip), rieng tao/sua chi
// Admin - ap dung middleware theo TUNG route thay vi use("*") nhu cac file khac trong thu muc nay.
const loaiLoi = new Hono<{ Bindings: Env }>();

interface LoaiLoiRow {
  ma: string;
  ten_hien_thi: string;
  mo_ta: string;
  cap_nhat_luc: string;
  cap_nhat_boi: string | null;
}

loaiLoi.get("/", verifySessionMiddleware, loadUser, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM loai_loi_mo_ta ORDER BY ten_hien_thi").all<LoaiLoiRow>();
  return c.json({ rows: results });
});

interface UpsertBody {
  ma: string;
  ten_hien_thi: string;
  mo_ta: string;
}

// POST / - Admin them 1 loai loi moi. "ma" phai khop CHINH XAC voi chuoi vi_pham.loai_loi tho DVBH
// gui thi tooltip moi tra ra dung mo ta (khong validate doi chieu vi_pham o day - Admin tu doi
// chieu qua man "Tat ca vi pham" hoac card KTV bao loi gi).
loaiLoi.post("/", verifySessionMiddleware, loadUser, requireAdmin, async (c) => {
  const body = await c.req.json<UpsertBody>().catch(() => null);
  if (!body?.ma?.trim() || !body?.ten_hien_thi?.trim() || !body?.mo_ta?.trim()) {
    return c.json({ error: "MISSING_FIELDS" }, 400);
  }
  const user = c.get("user");
  const existing = await c.env.DB.prepare("SELECT ma FROM loai_loi_mo_ta WHERE ma = ?").bind(body.ma.trim()).first();
  if (existing) return c.json({ error: "DA_TON_TAI" }, 409);

  await c.env.DB.prepare("INSERT INTO loai_loi_mo_ta (ma, ten_hien_thi, mo_ta, cap_nhat_luc, cap_nhat_boi) VALUES (?, ?, ?, ?, ?)")
    .bind(body.ma.trim(), body.ten_hien_thi.trim(), body.mo_ta.trim(), nowVN(), user.email)
    .run();
  return c.json({ ok: true });
});

interface UpdateBody {
  ten_hien_thi: string;
  mo_ta: string;
}

// PATCH /:ma - Admin sua ten hien thi / mo ta cua 1 loai loi da co (KHONG cho sua "ma" - doi ma se
// lam vo tra cuu ngay lap tuc voi cac vi_pham dang dung ma cu, phai xoa + tao moi neu thuc su can).
loaiLoi.patch("/:ma", verifySessionMiddleware, loadUser, requireAdmin, async (c) => {
  const ma = c.req.param("ma");
  const body = await c.req.json<UpdateBody>().catch(() => null);
  if (!body?.ten_hien_thi?.trim() || !body?.mo_ta?.trim()) return c.json({ error: "MISSING_FIELDS" }, 400);

  const user = c.get("user");
  const result = await c.env.DB.prepare("UPDATE loai_loi_mo_ta SET ten_hien_thi = ?, mo_ta = ?, cap_nhat_luc = ?, cap_nhat_boi = ? WHERE ma = ?")
    .bind(body.ten_hien_thi.trim(), body.mo_ta.trim(), nowVN(), user.email, ma)
    .run();
  if ((result.meta.changes ?? 0) === 0) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

// DELETE /:ma - Admin xoa 1 dinh nghia loi khong con dung (vd tao nham "ma"). Vi_pham dang tham
// chieu ma nay KHONG bi anh huong (mo_ta chi la bang tra cuu, khong co FK rang buoc) - tooltip se
// hien "Chua co mo ta" nhu truoc khi tao dinh nghia.
loaiLoi.delete("/:ma", verifySessionMiddleware, loadUser, requireAdmin, async (c) => {
  const ma = c.req.param("ma");
  const result = await c.env.DB.prepare("DELETE FROM loai_loi_mo_ta WHERE ma = ?").bind(ma).run();
  if ((result.meta.changes ?? 0) === 0) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

export default loaiLoi;
