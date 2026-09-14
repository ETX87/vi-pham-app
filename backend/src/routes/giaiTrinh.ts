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

/** Admin duoc XEM (khong phai nop ho) vi pham cua BAT KY KTV nao - xem phan hoi nguoi dung "cho
 * phep click vao card vi pham de xem noi dung ben trong nhu ktv dang xem". Chi ap dung cho cac
 * route GET/doc du lieu (chi tiet, case-lookup) - POST .../anh va .../giai-trinh VAN chi chu so
 * huu moi goi duoc, Admin khong nop giai trinh thay KTV. */
function duocXemViPham(vaiTro: "Admin" | null, maKtv: string | null, chuSoHuu: string | null): boolean {
  if (vaiTro === "Admin") return true;
  return !!maKtv && maKtv === chuSoHuu;
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

const VI_PHAM_PAGE_SIZE = 10;

// Bieu thuc SQL "gio hien tai" theo dung quy uoc gio VN dia phuong dang chuoi cua toan he thong
// (xem lib/vnTime.ts nowVN()) - CONG 7h vao UTC roi so sanh chuoi truc tiep voi ngay_ghi_nhan (cung
// quy uoc), KHONG dung datetime('now','localtime') vi Workers chay UTC, ket qua se sai gio VN.
const SQL_NOW_VN = "datetime('now', '+7 hours')";

// Dieu kien WHERE cho tung trang thai hien thi (StatusBadge.tsx viPhamStatus(), theo dung thu tu uu
// tien) - dung lai da_giai_trinh/chot_bo_cap_2 da tinh san trong CTE vp_ext ben duoi. "Qua han giai
// trinh" = chua nop, QC chua chot, va da qua 48h ke tu ngay_ghi_nhan (giong isQuaHanGiaiTrinh() JS).
function dieuKienTrangThai(trangThai: string | undefined): string {
  switch (trangThai) {
    case "status-decided":
      return "chot_bo_cap_2 IS NOT NULL";
    case "status-awaiting":
      return "chot_bo_cap_2 IS NULL AND da_giai_trinh = 1";
    case "status-overdue":
      return `chot_bo_cap_2 IS NULL AND da_giai_trinh = 0 AND ngay_ghi_nhan < datetime(${SQL_NOW_VN}, '-48 hours')`;
    case "status-not-submitted":
      return `chot_bo_cap_2 IS NULL AND da_giai_trinh = 0 AND ngay_ghi_nhan >= datetime(${SQL_NOW_VN}, '-48 hours')`;
    default:
      return "1=1";
  }
}

const VP_EXT_CTE = `WITH vp_ext AS (
  SELECT vp.*,
         EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id) as da_giai_trinh,
         EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id AND gt.dong_bo_dvbh_luc IS NULL) as dang_cho_dong_bo
  FROM vi_pham vp WHERE vp.ky_thuat_vien_ma_ktv = ?
)`;

// GET /vi-pham?trang_thai=...&page=1 - danh sach vi pham cua CHINH KTV dang dang nhap, moi nhat
// (theo ngay_ghi_nhan) truoc, phan trang 10 dong/lan (infinite-scroll o frontend, giong GET
// /thong-bao) de tranh doc het toan bo vi pham moi lan mo man hinh. "thongKe" (dem theo tung trang
// thai + tong) va "chuaXuLy" (badge) luon tinh TREN TOAN BO vi pham cua KTV nay (khong theo
// trang_thai/page dang xem) bang 1 cau aggregate RIENG, KHONG phai tu "rows" cua trang hien tai.
giaiTrinh.get("/vi-pham", async (c) => {
  const user = c.get("user");
  const maKtv = await getMaKtvForEmail(c.env.DB, user.email);
  if (!maKtv) return c.json({ rows: [], hasMore: false, chuaXuLy: 0, thongKe: { tong: 0, chuaGiaiTrinh: 0, quaHan: 0, choChot: 0, daChot: 0 } });

  const trangThai = c.req.query("trang_thai");
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const offset = (page - 1) * VI_PHAM_PAGE_SIZE;

  const { results } = await c.env.DB.prepare(
    `${VP_EXT_CTE} SELECT * FROM vp_ext WHERE ${dieuKienTrangThai(trangThai)} ORDER BY ngay_ghi_nhan DESC LIMIT ? OFFSET ?`,
  )
    .bind(maKtv, VI_PHAM_PAGE_SIZE + 1, offset)
    .all<ViPhamRow>();
  const hasMore = results.length > VI_PHAM_PAGE_SIZE;
  const rows = hasMore ? results.slice(0, VI_PHAM_PAGE_SIZE) : results;

  const thongKeRow = await c.env.DB.prepare(
    `${VP_EXT_CTE} SELECT
        COUNT(*) as tong,
        SUM(CASE WHEN ${dieuKienTrangThai("status-not-submitted")} THEN 1 ELSE 0 END) as chua_giai_trinh,
        SUM(CASE WHEN ${dieuKienTrangThai("status-overdue")} THEN 1 ELSE 0 END) as qua_han,
        SUM(CASE WHEN ${dieuKienTrangThai("status-awaiting")} THEN 1 ELSE 0 END) as cho_chot,
        SUM(CASE WHEN ${dieuKienTrangThai("status-decided")} THEN 1 ELSE 0 END) as da_chot,
        -- QC da BO (chot_bo_cap_2 = 0) nghia la khong con can giai trinh nua du chua nop - khong
        -- tinh vao "can xu ly" (van hien trong danh sach de KTV xem lai, chi khac o tag hien thi).
        SUM(CASE WHEN da_giai_trinh = 0 AND (chot_bo_cap_2 IS NULL OR chot_bo_cap_2 != 0) THEN 1 ELSE 0 END) as chua_xu_ly
     FROM vp_ext`,
  )
    .bind(maKtv)
    .first<{ tong: number; chua_giai_trinh: number; qua_han: number; cho_chot: number; da_chot: number; chua_xu_ly: number }>();

  return c.json({
    rows,
    hasMore,
    chuaXuLy: thongKeRow?.chua_xu_ly ?? 0,
    thongKe: {
      tong: thongKeRow?.tong ?? 0,
      chuaGiaiTrinh: thongKeRow?.chua_giai_trinh ?? 0,
      quaHan: thongKeRow?.qua_han ?? 0,
      choChot: thongKeRow?.cho_chot ?? 0,
      daChot: thongKeRow?.da_chot ?? 0,
    },
  });
});

// GET /vi-pham/:id - chi tiet 1 vi pham, kem giai trinh da nop (neu co) - 403 neu khong phai vi
// pham cua chinh minh VA khong phai Admin (xem duocXemViPham() - Admin xem duoc CUA BAT KY KTV nao,
// KTV thuong chi xem duoc cua chinh minh).
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
  if (!duocXemViPham(user.vai_tro, maKtv, viPham.ky_thuat_vien_ma_ktv)) return c.json({ error: "FORBIDDEN" }, 403);

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
  if (!duocXemViPham(user.vai_tro, maKtv, viPham.ky_thuat_vien_ma_ktv)) return c.json({ error: "FORBIDDEN" }, 403);
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
  if (!duocXemViPham(user.vai_tro, maKtv, viPham.ky_thuat_vien_ma_ktv)) return c.json({ error: "FORBIDDEN" }, 403);
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
