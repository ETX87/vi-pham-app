import { Hono } from "hono";
import type { Env } from "../types";
import { verifySessionMiddleware } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";
import { uploadPublicImage } from "../lib/googleDrive";
import { syncGiaiTrinhToDvbh, type GiaiTrinhSyncRow } from "../lib/dvbhClient";
import { nowVN, todayVN } from "../lib/vnTime";
import { getCachedCaseLookup, syncCaseLookup } from "../lib/caseLookupCache";

// Route session-authenticated cho KTV: xem danh sach vi pham cua CHINH MINH, xem chi tiet, upload
// anh bang chung, nop giai trinh - xem ke hoach xay dung phan "giaiTrinh.ts".
const giaiTrinh = new Hono<{ Bindings: Env }>();
giaiTrinh.use("*", verifySessionMiddleware, loadUser);

/** Tra ma_ktv cua nguoi dang dang nhap (khop qua ktv_lien_he.email_dang_nhap) - null neu tai
 * khoan nay chua khop voi dong KTV nao (vd Admin thuan tuy, hoac KTV chua duoc dong bo danh ba). */
async function getMaKtvForEmail(db: D1Database, email: string): Promise<string | null> {
  const row = await db.prepare("SELECT ma_ktv FROM ktv_lien_he WHERE email_dang_nhap = ?").bind(email).first<{ ma_ktv: string }>();
  return row?.ma_ktv ?? null;
}

interface ViPhamRow {
  id: string;
  case_id: string | null;
  loai_loi: string;
  ket_qua_cap_1: string | null;
  khach_hang: string | null;
  khu_vuc: string | null;
  ky_thuat_vien_ten: string | null;
  seri_san_pham: string | null;
  ngay_ghi_nhan: string;
  nguoi_ghi_nhan: string;
  nhan_luc: string;
  da_giai_trinh: number;
  dang_cho_dong_bo: number;
  chot_bo_cap_2: number | null;
  nguoi_chot: string | null;
  ngay_chot: string | null;
}

// GET /vi-pham - danh sach vi pham cua CHINH KTV dang dang nhap, moi nhat truoc. "da_giai_trinh"
// (0/1) de frontend hien badge "chua xu ly" - tinh qua EXISTS thay vi JOIN de tranh nhan trung
// dong khi 1 vi_pham co nhieu ban giai trinh (ve nguyen tac schema cho phep, xem migration).
// "dang_cho_dong_bo" (0/1, chi co y nghia khi da_giai_trinh=1) - CON giai trinh nao cua vi pham nay
// chua gui thanh cong ve DVBH (dong_bo_dvbh_luc IS NULL) - dung de frontend phan biet badge "Da xu
// ly" (xanh, da dong bo xong) voi "Dang cho dong bo" (vang, da nop nhung chua gui ve DVBH duoc).
giaiTrinh.get("/vi-pham", async (c) => {
  const user = c.get("user");
  const maKtv = await getMaKtvForEmail(c.env.DB, user.email);
  if (!maKtv) return c.json({ rows: [], chuaXuLy: 0 });

  const { results } = await c.env.DB.prepare(
    `SELECT vp.*,
            EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id) as da_giai_trinh,
            EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id AND gt.dong_bo_dvbh_luc IS NULL) as dang_cho_dong_bo
     FROM vi_pham vp WHERE vp.ky_thuat_vien_ma_ktv = ? ORDER BY vp.nhan_luc DESC`,
  )
    .bind(maKtv)
    .all<ViPhamRow>();

  // QC da BO (chot_bo_cap_2 === 0) nghia la khong con can giai trinh nua du chua nop - khong tinh
  // vao badge "can xu ly" (van hien trong danh sach de KTV xem lai, chi khac o tag hien thi).
  const chuaXuLy = results.filter((r) => !r.da_giai_trinh && r.chot_bo_cap_2 !== 0).length;
  return c.json({ rows: results, chuaXuLy });
});

// GET /vi-pham/:id - chi tiet 1 vi pham, kem giai trinh da nop (neu co) - 403 neu khong phai vi
// pham cua chinh minh (khong duoc xem cua KTV khac).
giaiTrinh.get("/vi-pham/:id", async (c) => {
  const user = c.get("user");
  const maKtv = await getMaKtvForEmail(c.env.DB, user.email);
  const id = c.req.param("id");

  // Them 2 cot tinh toan da_giai_trinh/dang_cho_dong_bo GIONG HET GET /vi-pham (danh sach) - man chi
  // tiet dung chung 1 ham tinh trang thai (StatusBadge o frontend) voi man danh sach, thieu 2 cot
  // nay se lam sai badge hien thi (bug da tung xay ra - vp.da_giai_trinh undefined -> hieu la 0).
  const viPham = await c.env.DB.prepare(
    `SELECT vp.*,
            EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id) as da_giai_trinh,
            EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id AND gt.dong_bo_dvbh_luc IS NULL) as dang_cho_dong_bo
     FROM vi_pham vp WHERE vp.id = ?`,
  )
    .bind(id)
    .first<ViPhamRow & { ky_thuat_vien_ma_ktv: string | null }>();
  if (!viPham) return c.json({ error: "NOT_FOUND" }, 404);
  if (!maKtv || viPham.ky_thuat_vien_ma_ktv !== maKtv) return c.json({ error: "FORBIDDEN" }, 403);

  const giaiTrinhRows = await c.env.DB.prepare("SELECT * FROM vi_pham_giai_trinh WHERE vi_pham_id = ? ORDER BY tao_luc DESC").bind(id).all();

  return c.json({ viPham, giaiTrinh: giaiTrinhRows.results });
});

// GET /vi-pham/:id/case-lookup - tra ve cache HIEN CO (neu co) cho case_id cua vi pham nay, KHONG
// goi DVBH (khong tieu rate-limit) - dung de ve man hinh ngay lap tuc luc mo trang. "found: null"
// nghia la CHUA TUNG dong bo lan nao (frontend nen tu goi POST .../sync 1 lan de lay du lieu dau).
giaiTrinh.get("/vi-pham/:id/case-lookup", async (c) => {
  const user = c.get("user");
  const maKtv = await getMaKtvForEmail(c.env.DB, user.email);
  const id = c.req.param("id");

  const viPham = await c.env.DB.prepare("SELECT case_id, ky_thuat_vien_ma_ktv FROM vi_pham WHERE id = ?").bind(id).first<{ case_id: string | null; ky_thuat_vien_ma_ktv: string | null }>();
  if (!viPham) return c.json({ error: "NOT_FOUND" }, 404);
  if (!maKtv || viPham.ky_thuat_vien_ma_ktv !== maKtv) return c.json({ error: "FORBIDDEN" }, 403);
  if (!viPham.case_id) return c.json({ cached: null });

  const cached = await getCachedCaseLookup(c.env.DB, viPham.case_id);
  return c.json({ cached });
});

// POST /vi-pham/:id/case-lookup/sync - chu dong xin lai thong tin case tu DVBH (bam nut "Dong bo",
// hoac frontend tu goi 1 lan khi GET o tren tra ve "cached: null"). Rate-limit theo TUNG NGUOI DUNG
// (khong phai theo case) - xem lib/caseLookupCache.ts.
giaiTrinh.post("/vi-pham/:id/case-lookup/sync", async (c) => {
  const user = c.get("user");
  const maKtv = await getMaKtvForEmail(c.env.DB, user.email);
  const id = c.req.param("id");

  const viPham = await c.env.DB.prepare("SELECT case_id, ky_thuat_vien_ma_ktv FROM vi_pham WHERE id = ?").bind(id).first<{ case_id: string | null; ky_thuat_vien_ma_ktv: string | null }>();
  if (!viPham) return c.json({ error: "NOT_FOUND" }, 404);
  if (!maKtv || viPham.ky_thuat_vien_ma_ktv !== maKtv) return c.json({ error: "FORBIDDEN" }, 403);
  if (!viPham.case_id) return c.json({ error: "NO_CASE_ID" }, 400);

  const outcome = await syncCaseLookup(c.env, c.env.DB, user.email, viPham.case_id);
  if (!outcome.ok) {
    if (outcome.kind === "RATE_LIMITED") return c.json({ error: "RATE_LIMITED", reason: outcome.reason, retryAfterMs: outcome.retryAfterMs }, 429);
    return c.json({ error: "LOOKUP_FAILED", message: outcome.message }, 502);
  }
  return c.json({ cached: outcome.data });
});

// POST /vi-pham/:id/anh - upload 1 anh bang chung qua Google Drive OAuth (uploadPublicImage()).
// Body la BYTES tho (Content-Type = mime that, giong quy uoc postBinary() cua linh-kien-app), KHONG
// phai multipart/form-data. Tra thumbnailUrl de frontend hien preview + gui kem luc submit giai trinh.
giaiTrinh.post("/vi-pham/:id/anh", async (c) => {
  const user = c.get("user");
  const maKtv = await getMaKtvForEmail(c.env.DB, user.email);
  const id = c.req.param("id");

  const viPham = await c.env.DB.prepare("SELECT ky_thuat_vien_ma_ktv FROM vi_pham WHERE id = ?").bind(id).first<{ ky_thuat_vien_ma_ktv: string | null }>();
  if (!viPham) return c.json({ error: "NOT_FOUND" }, 404);
  if (!maKtv || viPham.ky_thuat_vien_ma_ktv !== maKtv) return c.json({ error: "FORBIDDEN" }, 403);

  const contentType = c.req.header("Content-Type") ?? "application/octet-stream";
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) return c.json({ error: "EMPTY_BODY" }, 400);

  try {
    const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
    const { thumbnailUrl } = await uploadPublicImage(c.env, c.env.DB, bytes, contentType, `vi-pham-${id}-${crypto.randomUUID()}.${ext}`);
    return c.json({ thumbnailUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("GOOGLE_DRIVE_NOT_CONNECTED")) return c.json({ error: "GOOGLE_DRIVE_NOT_CONNECTED", message }, 409);
    return c.json({ error: "UPLOAD_FAILED", message }, 502);
  }
});

interface GiaiTrinhBody {
  noi_dung_giai_trinh?: string | null;
  ghi_chu?: string | null;
  anh_urls?: string[];
}

// POST /vi-pham/:id/giai-trinh - luu giai trinh cuc bo ROI thu dong bo ve DVBH NGAY trong cung
// request (dong bo - khong phai waitUntil, vi KTV can biet trang thai gan dung). Thanh
// cong -> set dong_bo_dvbh_luc; loi/timeout -> de NULL (cron se retry, xem lib/dvbhClient.ts) -
// nhung CA 2 truong hop deu tra ve 200 "da luu" cho KTV, KHONG bao loi cung de tranh KTV nhap lai
// (dung y ke hoach xay dung).
giaiTrinh.post("/vi-pham/:id/giai-trinh", async (c) => {
  const user = c.get("user");
  const maKtv = await getMaKtvForEmail(c.env.DB, user.email);
  const id = c.req.param("id");

  const viPham = await c.env.DB.prepare("SELECT ky_thuat_vien_ma_ktv FROM vi_pham WHERE id = ?").bind(id).first<{ ky_thuat_vien_ma_ktv: string | null }>();
  if (!viPham) return c.json({ error: "NOT_FOUND" }, 404);
  if (!maKtv || viPham.ky_thuat_vien_ma_ktv !== maKtv) return c.json({ error: "FORBIDDEN" }, 403);

  const body = await c.req.json<GiaiTrinhBody>().catch(() => ({}) as GiaiTrinhBody);
  const anhUrls = (body.anh_urls ?? []).filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 5);

  const giaiTrinhId = crypto.randomUUID();
  const ngayGiaiTrinh = todayVN();

  await c.env.DB.prepare(
    `INSERT INTO vi_pham_giai_trinh (id, vi_pham_id, nguoi_giai_trinh, ngay_giai_trinh, noi_dung_giai_trinh, ghi_chu, anh_urls, tao_luc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(giaiTrinhId, id, user.ten ?? user.email, ngayGiaiTrinh, body.noi_dung_giai_trinh ?? null, body.ghi_chu ?? null, JSON.stringify(anhUrls), nowVN())
    .run();

  const syncRow: GiaiTrinhSyncRow = {
    id: giaiTrinhId,
    vi_pham_id: id,
    nguoi_giai_trinh: user.ten ?? user.email,
    ngay_giai_trinh: ngayGiaiTrinh,
    noi_dung_giai_trinh: body.noi_dung_giai_trinh ?? null,
    ghi_chu: body.ghi_chu ?? null,
    anh_urls: anhUrls,
  };

  const syncResult = await syncGiaiTrinhToDvbh(c.env, syncRow);
  if (syncResult.ok) {
    await c.env.DB.prepare("UPDATE vi_pham_giai_trinh SET dong_bo_dvbh_luc = ?, dong_bo_loi = NULL WHERE id = ?").bind(nowVN(), giaiTrinhId).run();
  } else {
    await c.env.DB.prepare("UPDATE vi_pham_giai_trinh SET dong_bo_loi = ? WHERE id = ?").bind(syncResult.error ?? "UNKNOWN_ERROR", giaiTrinhId).run();
  }

  return c.json({ ok: true, id: giaiTrinhId, dongBoThanhCong: syncResult.ok });
});

const THONG_BAO_PAGE_SIZE = 10;

// GET /thong-bao?trang_thai=chua_doc|da_doc&page=1 - danh sach thong bao trong-app cua CHINH nguoi
// dang dang nhap, phan trang 10 dong/lan (infinite-scroll o frontend - xem NotificationsScreen.tsx)
// de tranh tai het 1 luc ton doc D1. "trang_thai" bo trong = tat ca. "chuaDoc" luon tinh TREN TOAN
// BO (khong theo filter/page dang xem) de hien badge dung. Fetch du LIMIT+1 dong de biet "hasMore"
// ma khong can them 1 cau COUNT(*) rieng (do dat 1 read D1).
giaiTrinh.get("/thong-bao", async (c) => {
  const user = c.get("user");
  const trangThai = c.req.query("trang_thai");
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const offset = (page - 1) * THONG_BAO_PAGE_SIZE;

  const dieuKienDoc = trangThai === "chua_doc" ? " AND da_doc = 0" : trangThai === "da_doc" ? " AND da_doc = 1" : "";
  const { results } = await c.env.DB.prepare(`SELECT * FROM thong_bao WHERE nguoi_nhan = ?${dieuKienDoc} ORDER BY ngay_tao DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(user.email, THONG_BAO_PAGE_SIZE + 1, offset)
    .all();
  const hasMore = results.length > THONG_BAO_PAGE_SIZE;
  const rows = hasMore ? results.slice(0, THONG_BAO_PAGE_SIZE) : results;

  const chuaDocRow = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM thong_bao WHERE nguoi_nhan = ? AND da_doc = 0").bind(user.email).first<{ cnt: number }>();
  return c.json({ rows, chuaDoc: chuaDocRow?.cnt ?? 0, hasMore });
});

// POST /thong-bao/:id/danh-dau-da-doc - danh dau 1 thong bao la da doc (chi cho phep tren thong
// bao cua CHINH minh - loc them nguoi_nhan trong WHERE, khong tin id tho tu client).
giaiTrinh.post("/thong-bao/:id/danh-dau-da-doc", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE thong_bao SET da_doc = 1 WHERE id = ? AND nguoi_nhan = ?").bind(id, user.email).run();
  return c.json({ ok: true });
});

// POST /thong-bao/danh-dau-tat-ca-da-doc - danh dau TOAN BO thong bao chua doc cua CHINH minh la
// da doc (nut "Đánh dấu tất cả đã đọc" o frontend).
giaiTrinh.post("/thong-bao/danh-dau-tat-ca-da-doc", async (c) => {
  const user = c.get("user");
  await c.env.DB.prepare("UPDATE thong_bao SET da_doc = 1 WHERE nguoi_nhan = ? AND da_doc = 0").bind(user.email).run();
  return c.json({ ok: true });
});

export default giaiTrinh;
