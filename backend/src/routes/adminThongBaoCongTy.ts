import { Hono } from "hono";
import type { Env } from "../types";
import { verifySessionMiddleware } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";
import { requireAdmin } from "../middleware/requireAdmin";
import { sendPushToUser } from "../lib/webPush";

// Route Admin-only: soan + xem roster da-doc/chua-doc cua thong bao cong ty (xem migration 0009).
// Khac han /api/giai-trinh/thong-bao-cong-ty (KTV xem CUA CHINH minh) - day la man quan tri, Admin
// chon dich danh nguoi nhan luc soan (khong broadcast toan bo mac dinh).
const adminThongBaoCongTy = new Hono<{ Bindings: Env }>();
adminThongBaoCongTy.use("*", verifySessionMiddleware, loadUser, requireAdmin);

const DANH_SACH_PAGE_SIZE = 20;

// GET /?page=1 - danh sach thong bao da gui, kem dem gop "da doc x/y" tren TOAN BO roster (khong
// phan trang roster o day, chi phan trang danh sach thong bao).
adminThongBaoCongTy.get("/", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const offset = (page - 1) * DANH_SACH_PAGE_SIZE;

  const countRow = await c.env.DB.prepare("SELECT COUNT(*) as total FROM thong_bao_cong_ty").first<{ total: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.tieu_de, t.noi_dung, t.nguoi_tao, t.tao_luc,
            COUNT(*) as tongNguoiNhan,
            SUM(CASE WHEN x.da_doc_luc IS NOT NULL THEN 1 ELSE 0 END) as daDoc
     FROM thong_bao_cong_ty t JOIN thong_bao_cong_ty_xac_nhan x ON x.thong_bao_id = t.id
     GROUP BY t.id ORDER BY t.tao_luc DESC, t.id DESC LIMIT ? OFFSET ?`,
  )
    .bind(DANH_SACH_PAGE_SIZE, offset)
    .all();
  return c.json({ rows: results, total: countRow?.total ?? 0, page, pageSize: DANH_SACH_PAGE_SIZE });
});

// GET /:id/nguoi-nhan?trang_thai=chua_doc|da_doc - roster chi tiet cua 1 thong bao, de Admin biet
// dich danh ai chua doc ma nhac truc tiep.
adminThongBaoCongTy.get("/:id/nguoi-nhan", async (c) => {
  const id = c.req.param("id");
  const trangThai = c.req.query("trang_thai");
  const dieuKienDoc = trangThai === "chua_doc" ? " AND x.da_doc_luc IS NULL" : trangThai === "da_doc" ? " AND x.da_doc_luc IS NOT NULL" : "";
  const { results } = await c.env.DB.prepare(
    `SELECT x.nguoi_nhan as email, u.ten, x.da_doc_luc
     FROM thong_bao_cong_ty_xac_nhan x LEFT JOIN users u ON u.email = x.nguoi_nhan
     WHERE x.thong_bao_id = ?${dieuKienDoc} ORDER BY x.da_doc_luc IS NULL DESC, u.ten`,
  )
    .bind(id)
    .all();
  return c.json({ rows: results });
});

interface TaoThongBaoBody {
  tieu_de?: string;
  noi_dung?: string;
  nguoi_nhan?: string[];
}

// POST / - soan + gui 1 thong bao cong ty toi danh sach email Admin CHON (khong phai toan bo users
// mac dinh - xem phan hoi nguoi dung "chon nguoi nhan khi soan"). Email gui len duoc LOC lai, chi
// giu nguoi dang "Da duyet" va khong bi khoa - tranh gui nham/gui toi tai khoan da bi khoa.
adminThongBaoCongTy.post("/", async (c) => {
  const body = await c.req.json<TaoThongBaoBody>().catch(() => null);
  const tieuDe = body?.tieu_de?.trim();
  const noiDung = body?.noi_dung?.trim();
  const nguoiNhan = Array.isArray(body?.nguoi_nhan) ? [...new Set(body!.nguoi_nhan)].filter((e) => typeof e === "string" && e.trim()) : [];
  if (!tieuDe || !noiDung) return c.json({ error: "INVALID_BODY" }, 400);
  if (nguoiNhan.length === 0) return c.json({ error: "EMPTY_NGUOI_NHAN" }, 400);

  const placeholders = nguoiNhan.map(() => "?").join(",");
  const { results: hopLe } = await c.env.DB.prepare(
    `SELECT email FROM users WHERE trang_thai_duyet = 'Da duyet' AND bi_khoa = 0 AND email IN (${placeholders})`,
  )
    .bind(...nguoiNhan)
    .all<{ email: string }>();
  if (hopLe.length === 0) return c.json({ error: "EMPTY_NGUOI_NHAN" }, 400);

  const user = c.get("user");
  const insertResult = await c.env.DB.prepare("INSERT INTO thong_bao_cong_ty (tieu_de, noi_dung, nguoi_tao) VALUES (?, ?, ?)")
    .bind(tieuDe, noiDung, user.email)
    .run();
  const thongBaoId = insertResult.meta.last_row_id;

  await c.env.DB.batch(
    hopLe.map((r) => c.env.DB.prepare("INSERT INTO thong_bao_cong_ty_xac_nhan (thong_bao_id, nguoi_nhan) VALUES (?, ?)").bind(thongBaoId, r.email)),
  );

  // Gui push nen, khong chan response - giong pattern nhanViPham.ts (DVBH goi sang khong cho xu ly
  // nang). Loi tung nguoi khong lam hong request chinh (sendPushToUser da tu bat loi ben trong).
  c.executionCtx.waitUntil(
    Promise.all(hopLe.map((r) => sendPushToUser(c.env, r.email, { title: "Thông báo mới từ công ty", body: tieuDe, url: "/" }))),
  );

  return c.json({ ok: true, id: thongBaoId, soNguoiNhan: hopLe.length });
});

export default adminThongBaoCongTy;
