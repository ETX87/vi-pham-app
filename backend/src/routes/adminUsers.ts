import { Hono } from "hono";
import type { Env, TrangThaiDuyet, VaiTro } from "../types";
import { verifySessionMiddleware } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";
import { requireAdmin } from "../middleware/requireAdmin";
import { nowVN } from "../lib/vnTime";

// Route Admin-only: duyet/tu choi/khoa tai khoan - thieu phan nay thi tai khoan khong tu dong khop
// duoc KTV (email dang nhap khac email_dang_nhap trong danh ba) se ket "Cho duyet" vinh vien, khong
// ai xu ly duoc (xem middleware/loadUser.ts chan PENDING_APPROVAL/REJECTED).
const adminUsers = new Hono<{ Bindings: Env }>();
adminUsers.use("*", verifySessionMiddleware, loadUser, requireAdmin);

// GET /?tab=cho-duyet|da-duyet|tu-choi|tat-ca&search= - mac dinh tab "cho-duyet" (hang doi can xu ly
// truoc). "da-duyet"/"tu-choi" (them theo phan hoi nguoi dung "quan ly mail da duyet/tu choi") de
// Admin loc rieng tung nhom, doi lai quyet dinh (Duyet/Tu choi lai) khong can loc qua "Tat ca".
const TAB_TRANG_THAI: Record<string, TrangThaiDuyet> = {
  "cho-duyet": "Cho duyet",
  "da-duyet": "Da duyet",
  "tu-choi": "Tu choi",
};

adminUsers.get("/", async (c) => {
  const tab = c.req.query("tab") ?? "cho-duyet";
  const search = c.req.query("search")?.trim();

  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (TAB_TRANG_THAI[tab]) {
    conditions.push("u.trang_thai_duyet = ?");
    binds.push(TAB_TRANG_THAI[tab]);
  }
  if (search) {
    conditions.push("(LOWER(u.email) LIKE LOWER(?) OR LOWER(COALESCE(u.ten,'')) LIKE LOWER(?) OR LOWER(COALESCE(u.ma_ktv_tu_khai,'')) LIKE LOWER(?))");
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // LEFT JOIN ktv_lien_he theo email_dang_nhap - CHINH la dieu kien khop tu dong duyet/gan KTV that
  // su dung (xem giaiTrinh.ts getMaKtvForEmail()), khac voi ma_ktv_tu_khai (chi la nguoi dung TU KHAI,
  // khong rang buoc gi) - hien ca 2 de Admin phan biet "da khop that" voi "KTV tu dien nhung chua khop".
  const { results } = await c.env.DB.prepare(
    `SELECT u.email, u.ten, COALESCE(u.vai_tro, u.vai_tro_xem) as vai_tro, u.trang_thai_duyet, u.bi_khoa, u.created_at, u.ma_ktv_tu_khai,
            k.ma_ktv as khop_ma_ktv, k.ten_hien_thi as khop_ten_ktv,
            (SELECT GROUP_CONCAT(uk.khu_vuc_ma, ',') FROM user_khu_vuc uk WHERE uk.user_email = u.email) as khu_vuc_csv
     FROM users u LEFT JOIN ktv_lien_he k ON k.email_dang_nhap = u.email
     ${where} ORDER BY u.created_at DESC`,
  )
    .bind(...binds)
    .all<{
      email: string;
      ten: string | null;
      vai_tro: VaiTro | null;
      trang_thai_duyet: TrangThaiDuyet;
      bi_khoa: number;
      created_at: string;
      ma_ktv_tu_khai: string | null;
      khop_ma_ktv: string | null;
      khop_ten_ktv: string | null;
      khu_vuc_csv: string | null;
    }>();
  // bi_khoa la INTEGER 0/1 trong D1 - ep ve boolean that de khop dung contract AppUser.bi_khoa ben
  // frontend (xem middleware/loadUser.ts lam tuong tu cho endpoint /me).
  return c.json({
    rows: results.map(({ khu_vuc_csv, ...r }) => ({ ...r, bi_khoa: !!r.bi_khoa, khu_vuc: khu_vuc_csv ? khu_vuc_csv.split(",").sort() : [] })),
  });
});

// GET /khu-vuc-options - cac ma khu vuc dang co trong danh ba KTV (ktv_lien_he.khu_vuc_ma, dong bo tu linh-kien-app)
// kem so KTV - de Admin chon khu vuc phu trach cho tai khoan Giam sat.
adminUsers.get("/khu-vuc-options", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT khu_vuc_ma as ma, COUNT(*) as so_ktv FROM ktv_lien_he WHERE khu_vuc_ma IS NOT NULL AND khu_vuc_ma != '' GROUP BY khu_vuc_ma ORDER BY khu_vuc_ma",
  ).all<{ ma: string; so_ktv: number }>();
  return c.json({ rows: results });
});

interface PatchUserBody {
  trang_thai_duyet?: TrangThaiDuyet;
  vai_tro?: VaiTro | null;
  bi_khoa?: boolean;
  // Chi co nghia voi Giam sat - ghi de TOAN BO danh sach khu vuc phu trach.
  khu_vuc?: string[];
}

const VAI_TRO_HOP_LE: VaiTro[] = ["Admin", "Giam sat", "View"];

// PATCH /:email - duyet/tu choi/doi vai tro/khoa-mo khoa. Chan sua BOOTSTRAP_ADMIN_EMAIL (tai khoan
// khoi tao duy nhat co the tu dong lay lai quyen Admin luc dang nhap - xem routes/auth.ts) de tranh
// tu khoa/ha quyen chinh minh, mat het loi vao he thong.
adminUsers.patch("/:email", async (c) => {
  const email = decodeURIComponent(c.req.param("email"));
  if (email === c.env.BOOTSTRAP_ADMIN_EMAIL) return c.json({ error: "CANNOT_MODIFY_BOOTSTRAP_ADMIN" }, 400);

  const body = await c.req.json<PatchUserBody>().catch(() => null);
  if (!body) return c.json({ error: "INVALID_BODY" }, 400);
  if (body.trang_thai_duyet !== undefined && !["Da duyet", "Tu choi", "Cho duyet"].includes(body.trang_thai_duyet)) {
    return c.json({ error: "INVALID_TRANG_THAI_DUYET" }, 400);
  }
  if (body.vai_tro !== undefined && body.vai_tro !== null && !VAI_TRO_HOP_LE.includes(body.vai_tro)) {
    return c.json({ error: "INVALID_VAI_TRO" }, 400);
  }
  if (body.khu_vuc !== undefined && (!Array.isArray(body.khu_vuc) || body.khu_vuc.some((k) => typeof k !== "string"))) {
    return c.json({ error: "INVALID_KHU_VUC" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT email FROM users WHERE email = ?").bind(email).first();
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const next = {
    trang_thai_duyet: body.trang_thai_duyet ?? undefined,
    vai_tro: body.vai_tro !== undefined ? body.vai_tro : undefined,
    bi_khoa: body.bi_khoa !== undefined ? (body.bi_khoa ? 1 : 0) : undefined,
  };

  const sets: string[] = [];
  const binds: unknown[] = [];
  if (next.trang_thai_duyet !== undefined) {
    sets.push("trang_thai_duyet = ?");
    binds.push(next.trang_thai_duyet);
  }
  // Admin o cot vai_tro (CHECK cu chi cho 'Admin'), Giam sat/View o cot vai_tro_xem (migration 0011) - luon
  // ghi CA 2 cot de 1 tai khoan chi con dung 1 vai tro hieu luc.
  if (next.vai_tro !== undefined) {
    sets.push("vai_tro = ?", "vai_tro_xem = ?");
    binds.push(next.vai_tro === "Admin" ? "Admin" : null, next.vai_tro === "Giam sat" || next.vai_tro === "View" ? next.vai_tro : null);
  }
  if (next.bi_khoa !== undefined) {
    sets.push("bi_khoa = ?");
    binds.push(next.bi_khoa);
  }
  if (sets.length === 0 && body.khu_vuc === undefined) return c.json({ error: "NO_FIELDS" }, 400);
  sets.push("updated_at = ?");
  binds.push(nowVN());
  binds.push(email);

  const statements = [c.env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE email = ?`).bind(...binds)];
  // Doi sang vai tro khac Giam sat -> xoa khu vuc cu (khong de sot quyen xem khi sau nay gan lai GS).
  const khuVuc = next.vai_tro !== undefined && next.vai_tro !== "Giam sat" ? [] : body.khu_vuc;
  if (khuVuc !== undefined) {
    statements.push(c.env.DB.prepare("DELETE FROM user_khu_vuc WHERE user_email = ?").bind(email));
    for (const ma of new Set(khuVuc.map((k) => k.trim()).filter(Boolean))) {
      statements.push(c.env.DB.prepare("INSERT INTO user_khu_vuc (user_email, khu_vuc_ma) VALUES (?, ?)").bind(email, ma));
    }
  }
  await c.env.DB.batch(statements);

  return c.json({ ok: true });
});

export default adminUsers;
