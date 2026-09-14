import { Hono } from "hono";
import type { Env } from "../types";
import { verifySessionMiddleware } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";
import { requireAdmin } from "../middleware/requireAdmin";
import { nowVN } from "../lib/vnTime";

// Dinh nghia mo ta chi tiet cho tung ket_qua_cap_1 (migration 0007) - "CSKH ket luan loai loi" la
// ket luan CSKH dua ra SAU khi xac minh voi khach hang (khac loai_loi - loai NGHI NGO ban dau tu
// DVBH, xem routes/loaiLoi.ts). Cau truc/middleware giong het loaiLoi.ts - GET mo cho moi nguoi dung
// da dang nhap, tao/sua/xoa chi Admin.
const ketQuaCap1 = new Hono<{ Bindings: Env }>();

interface KetQuaCap1Row {
  ma: string;
  ten_hien_thi: string;
  mo_ta: string;
  cap_nhat_luc: string;
  cap_nhat_boi: string | null;
}

ketQuaCap1.get("/", verifySessionMiddleware, loadUser, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM ket_qua_cap_1_mo_ta ORDER BY ten_hien_thi").all<KetQuaCap1Row>();
  return c.json({ rows: results });
});

interface UpsertBody {
  ma: string;
  ten_hien_thi: string;
  mo_ta: string;
}

// POST / - Admin them 1 ket qua cap 1 moi. "ma" phai khop CHINH XAC voi chuoi vi_pham.ket_qua_cap_1
// tho DVBH gui thi tooltip moi tra ra dung mo ta.
ketQuaCap1.post("/", verifySessionMiddleware, loadUser, requireAdmin, async (c) => {
  const body = await c.req.json<UpsertBody>().catch(() => null);
  if (!body?.ma?.trim() || !body?.ten_hien_thi?.trim() || !body?.mo_ta?.trim()) {
    return c.json({ error: "MISSING_FIELDS" }, 400);
  }
  const user = c.get("user");
  const existing = await c.env.DB.prepare("SELECT ma FROM ket_qua_cap_1_mo_ta WHERE ma = ?").bind(body.ma.trim()).first();
  if (existing) return c.json({ error: "DA_TON_TAI" }, 409);

  await c.env.DB.prepare("INSERT INTO ket_qua_cap_1_mo_ta (ma, ten_hien_thi, mo_ta, cap_nhat_luc, cap_nhat_boi) VALUES (?, ?, ?, ?, ?)")
    .bind(body.ma.trim(), body.ten_hien_thi.trim(), body.mo_ta.trim(), nowVN(), user.email)
    .run();
  return c.json({ ok: true });
});

interface UpdateBody {
  ten_hien_thi: string;
  mo_ta: string;
}

// PATCH /:ma - Admin sua ten hien thi / mo ta (KHONG cho sua "ma" - giong loaiLoi.ts).
ketQuaCap1.patch("/:ma", verifySessionMiddleware, loadUser, requireAdmin, async (c) => {
  const ma = c.req.param("ma");
  const body = await c.req.json<UpdateBody>().catch(() => null);
  if (!body?.ten_hien_thi?.trim() || !body?.mo_ta?.trim()) return c.json({ error: "MISSING_FIELDS" }, 400);

  const user = c.get("user");
  const result = await c.env.DB.prepare("UPDATE ket_qua_cap_1_mo_ta SET ten_hien_thi = ?, mo_ta = ?, cap_nhat_luc = ?, cap_nhat_boi = ? WHERE ma = ?")
    .bind(body.ten_hien_thi.trim(), body.mo_ta.trim(), nowVN(), user.email, ma)
    .run();
  if ((result.meta.changes ?? 0) === 0) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

// DELETE /:ma - xem ghi chu tuong tu trong loaiLoi.ts (khong co FK rang buoc voi vi_pham).
ketQuaCap1.delete("/:ma", verifySessionMiddleware, loadUser, requireAdmin, async (c) => {
  const ma = c.req.param("ma");
  const result = await c.env.DB.prepare("DELETE FROM ket_qua_cap_1_mo_ta WHERE ma = ?").bind(ma).run();
  if ((result.meta.changes ?? 0) === 0) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ ok: true });
});

export default ketQuaCap1;
