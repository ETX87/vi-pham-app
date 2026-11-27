import { Hono } from "hono";
import type { Env } from "../types";
import { verifySessionMiddleware } from "../middleware/session";
import { loadUser } from "../middleware/loadUser";
import { uploadPublicImage } from "../lib/googleDrive";
import { syncGiaiTrinhToDvbh, type GiaiTrinhSyncRow } from "../lib/dvbhClient";
import { nowVN, todayVN } from "../lib/vnTime";
import { getCachedCaseLookup, syncCaseLookup } from "../lib/caseLookupCache";
import { getThongKeDvbh, type ThongKeDvbhRow } from "../lib/thongKeDvbh";
import { duocXemViPham, dsKtvCuaGs, emailNhomGs, sqlKtvCuaGs, xemNhieuKtv } from "../lib/phamVi";

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

// Admin/View/GS duoc XEM (khong phai nop ho) vi pham cua KTV khac trong pham vi cua minh - xem
// lib/phamVi.ts duocXemViPham(). Chi ap dung cho cac route GET/doc du lieu (chi tiet, case-lookup) -
// POST .../anh va .../giai-trinh VAN chi chu so huu moi goi duoc.

// GET /ktv-options - danh sach KTV cho o chon KTV (man Vi pham / Bao cao nhanh) theo pham vi: Admin/View
// = toan bo, GS = KTV thuoc khu vuc duoc gan (kem "khuVuc" de hien "Toan nhom (MB1, MB2)"). KTV thuong 403.
giaiTrinh.get("/ktv-options", async (c) => {
  const user = c.get("user");
  if (!xemNhieuKtv(user)) return c.json({ error: "FORBIDDEN" }, 403);
  const nhom = emailNhomGs(user);
  if (!nhom) {
    const { results } = await c.env.DB.prepare("SELECT ma_ktv, ten_hien_thi, email_dang_nhap FROM ktv_lien_he ORDER BY ten_hien_thi").all();
    return c.json({ rows: results, khuVuc: null });
  }
  const { results } = await c.env.DB.prepare(
    `SELECT ma_ktv, ten_hien_thi, email_dang_nhap FROM ktv_lien_he WHERE ma_ktv IN (${sqlKtvCuaGs("?")}) ORDER BY ten_hien_thi`,
  )
    .bind(nhom)
    .all();
  const { results: kv } = await c.env.DB.prepare("SELECT khu_vuc_ma FROM user_khu_vuc WHERE user_email = ? ORDER BY khu_vuc_ma")
    .bind(nhom)
    .all<{ khu_vuc_ma: string }>();
  return c.json({ rows: results, khuVuc: kv.map((r) => r.khu_vuc_ma) });
});

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

// ?1 = ma_ktv can loc (NULL = toan doi), ?2 = ma_ktv cua nguoi dang xem (de danh dau la_cua_toi),
// ?3 = email GS de gioi han trong KTV khu vuc minh (NULL = khong gioi han - Admin/View/KTV thuong).
const VP_EXT_CTE = `WITH vp_ext AS (
  SELECT vp.*,
         EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id) as da_giai_trinh,
         EXISTS(SELECT 1 FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = vp.id AND gt.dong_bo_dvbh_luc IS NULL) as dang_cho_dong_bo,
         (SELECT k.ten_hien_thi FROM ktv_lien_he k WHERE k.ma_ktv = vp.ky_thuat_vien_ma_ktv) as ten_ktv_khop,
         CASE WHEN vp.ky_thuat_vien_ma_ktv = ?2 THEN 1 ELSE 0 END as la_cua_toi
  FROM vi_pham vp WHERE (?1 IS NULL OR vp.ky_thuat_vien_ma_ktv = ?1)
    AND (?3 IS NULL OR vp.ky_thuat_vien_ma_ktv IN (${sqlKtvCuaGs("?3")}))
)`;

// GET /vi-pham?trang_thai=...&page=1 - danh sach vi pham cua CHINH KTV dang dang nhap, moi nhat
// (theo ngay_ghi_nhan) truoc, phan trang 10 dong/lan (infinite-scroll o frontend, giong GET
// /thong-bao) de tranh doc het toan bo vi pham moi lan mo man hinh. "thongKe" (dem theo tung trang
// thai + tong) va "chuaXuLy" (badge) luon tinh TREN TOAN BO vi pham cua KTV nay (khong theo
// trang_thai/page dang xem) bang 1 cau aggregate RIENG, KHONG phai tu "rows" cua trang hien tai.
// Admin/View/GS (2026-10-26): ?ma_ktv= xem 1 KTV, ?toan_doi=1 xem ca doi (GS: toan nhom khu vuc minh); khong truyen gi =
// cua chinh minh nhu KTV thuong (App.tsx goi kieu nay de lay badge - neu mac dinh toan doi thi badge se cong ca doi).
// KTV thuong bo qua 2 tham so nay. GS chon 1 KTV ngoai khu vuc -> dieu kien ?3 loc het, tra rong.
giaiTrinh.get("/vi-pham", async (c) => {
  const user = c.get("user");
  const maKtv = await getMaKtvForEmail(c.env.DB, user.email);
  const xemNhieu = xemNhieuKtv(user);
  const maKtvChon = xemNhieu ? c.req.query("ma_ktv")?.trim() || null : null;
  const toanDoi = xemNhieu && !maKtvChon && c.req.query("toan_doi") === "1";
  const nhom = maKtvChon || toanDoi ? emailNhomGs(user) : null;
  const loc = maKtvChon ?? (toanDoi ? null : maKtv);
  if (!loc && !toanDoi) return c.json({ rows: [], hasMore: false, chuaXuLy: 0, thongKe: { tong: 0, chuaGiaiTrinh: 0, quaHan: 0, choChot: 0, daChot: 0 } });

  const trangThai = c.req.query("trang_thai");
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const offset = (page - 1) * VI_PHAM_PAGE_SIZE;

  const { results } = await c.env.DB.prepare(
    `${VP_EXT_CTE} SELECT * FROM vp_ext WHERE ${dieuKienTrangThai(trangThai)} ORDER BY ngay_ghi_nhan DESC LIMIT ?4 OFFSET ?5`,
  )
    .bind(loc, maKtv, nhom, VI_PHAM_PAGE_SIZE + 1, offset)
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
    .bind(loc, maKtv, nhom)
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

/** % lam tron 1 chu so thap phan, 0 khi mau so = 0 (tranh NaN/Infinity tra ve frontend). */
function tyLe(tu: number, mau: number): number {
  return mau > 0 ? Math.round((tu / mau) * 1000) / 10 : 0;
}

// Moi vi pham trong 1 thang + thoi diem nop giai trinh DAU TIEN (gt_dau, gio VN - cung quy uoc voi
// ngay_ghi_nhan nen so sanh chuoi truc tiep duoc). ?1 = ma_ktv (NULL = toan doi), ?2 = thang, ?3 = email GS
// (gioi han KTV khu vuc minh, NULL = khong gioi han).
// Dung chung cho moi cau aggregate cua /bao-cao ben duoi.
const BAO_CAO_CTE = `WITH vp AS (
  SELECT v.*, (SELECT MIN(gt.tao_luc) FROM vi_pham_giai_trinh gt WHERE gt.vi_pham_id = v.id) as gt_dau
  FROM vi_pham v WHERE (?1 IS NULL OR v.ky_thuat_vien_ma_ktv = ?1) AND substr(v.ngay_ghi_nhan, 1, 7) = ?2
    AND (?3 IS NULL OR v.ky_thuat_vien_ma_ktv IN (${sqlKtvCuaGs("?3")}))
)`;

/** Cong gop so lieu DVBH nhieu KTV (Admin/View xem toan doi, GS xem toan nhom). Thoi gian xu ly TB = trung binh co trong so theo
 * ca_hoan_thanh - xap xi, vi DVBH khong tra so ca co so_gio_xu_ly hop le cua tung KTV. */
function congGopCongViec(rows: ThongKeDvbhRow[]): ThongKeDvbhRow {
  const g: ThongKeDvbhRow = {
    ma_ktv: "",
    ten_ktv: null,
    tong_ca_tiep_nhan: 0,
    ca_tiep_nhan_con_ton: 0,
    ca_dong: 0,
    ca_hoan_thanh: 0,
    ca_khong_hoan_thanh: 0,
    ca_dung_han: 0,
    ca_tinh_sla: 0,
    ca_duoi_24h: 0,
    ca_tinh_24h: 0,
    phan_bo_24h: {},
    thoi_gian_xu_ly_tb_gio: null,
    nghi_ngo: { loi_120p: 0, hen_qua_24h: 0, lo_ke_hoach: 0, kh_hen_lai: 0, tong: 0 },
    vi_pham_da_khao_sat: 0,
    vi_pham_xac_nhan: 0,
  };
  const SO = ["tong_ca_tiep_nhan", "ca_tiep_nhan_con_ton", "ca_dong", "ca_hoan_thanh", "ca_khong_hoan_thanh", "ca_dung_han", "ca_tinh_sla", "ca_duoi_24h", "ca_tinh_24h", "vi_pham_da_khao_sat", "vi_pham_xac_nhan"] as const;
  let tongGio = 0;
  let trongSo = 0;
  for (const r of rows) {
    for (const k of SO) g[k] += r[k];
    for (const [nhom, sl] of Object.entries(r.phan_bo_24h)) g.phan_bo_24h[nhom] = (g.phan_bo_24h[nhom] ?? 0) + sl;
    for (const k of ["loi_120p", "hen_qua_24h", "lo_ke_hoach", "kh_hen_lai", "tong"] as const) g.nghi_ngo[k] += r.nghi_ngo[k];
    if (r.thoi_gian_xu_ly_tb_gio !== null && r.ca_hoan_thanh > 0) {
      tongGio += r.thoi_gian_xu_ly_tb_gio * r.ca_hoan_thanh;
      trongSo += r.ca_hoan_thanh;
    }
  }
  g.thoi_gian_xu_ly_tb_gio = trongSo > 0 ? Math.round((tongGio / trongSo) * 10) / 10 : null;
  return g;
}

// GET /bao-cao?thang=YYYY-MM - bao cao nhanh cua CHINH KTV dang dang nhap cho 1 thang (mac dinh
// thang hien tai) - loc theo ngay_ghi_nhan (thang vi pham PHAT SINH, khong phai thang chot).
// - "thongKe": 4 nhom loai tru nhau, cong du tong. quaHan = chua chot + CHUA giai trinh + qua 48h
//   (khop dieuKienTrangThai("status-overdue") cua danh sach - truoc day dem ca vi pham da giai trinh
//   nhung QC chua chot, lam KTV nop dung han van bi tinh "qua han giai trinh").
// - "giaiTrinh": chuaGiaiTrinh khong tinh vi pham QC da BO (khong con can giai trinh). dungHan = nop
//   lan dau trong 48h ke tu ngay_ghi_nhan (cung moc 48h voi quaHan).
// - "theoLoaiLoi": CHI vi pham DA CHOT LA LOI THAT, ty le tren tong da chot (yeu cau cu, giu nguyen).
// - "theoLoaiNghiNgo"/"theoKetQuaCap1": tren TOAN BO nghi ngo trong thang, kem ty le chot thanh loi.
// - "congViec": so lieu ca cua KTV tu DVBH (tong ca, dung han, 24h, toc do xu ly...) - lib/thongKeDvbh.ts, cache 1h.
// Pham vi: KTV thuong = CHI cua minh (bo qua ?ma_ktv). Admin/View = toan doi, GS = toan nhom (KTV khu vuc minh), hoac
// 1 KTV qua ?ma_ktv - Admin khong gan KTV nao nen truoc day man nay cua Admin toan so 0 va khong goi DVBH lan nao.
giaiTrinh.get("/bao-cao", async (c) => {
  const user = c.get("user");
  const laAdmin = xemNhieuKtv(user);
  const maKtv = laAdmin ? c.req.query("ma_ktv")?.trim() || null : await getMaKtvForEmail(c.env.DB, user.email);
  const nhom = laAdmin ? emailNhomGs(user) : null;
  const thang = /^\d{4}-\d{2}$/.test(c.req.query("thang") ?? "") ? c.req.query("thang")! : todayVN().slice(0, 7);

  if (!laAdmin && !maKtv) {
    return c.json({
      thang,
      thongKe: { tong: 0, soCase: 0, dangCho: 0, quaHan: 0, daChot: 0, daBo: 0, tyLeChotLoi: 0 },
      giaiTrinh: { daGiaiTrinh: 0, chuaGiaiTrinh: 0, dungHan: 0, tyLeGiaiTrinh: 0, tyLeDungHan: 0 },
      theoLoaiLoi: [],
      theoLoaiNghiNgo: [],
      theoKetQuaCap1: [],
      congViec: null,
    });
  }

  // Goi song song voi cac cau D1 ben duoi - lan dau trong gio phai cho DVBH tra loi.
  const congViecPromise = getThongKeDvbh(c.env, thang);
  // GS: so lieu DVBH (cache JSON toan doi) phai loc tay theo KTV khu vuc minh truoc khi cong gop.
  const ktvNhom = nhom ? await dsKtvCuaGs(c.env.DB, nhom) : null;

  const tk = await c.env.DB.prepare(
    `${BAO_CAO_CTE} SELECT
        COUNT(*) as tong,
        COUNT(DISTINCT case_id) as so_case,
        SUM(CASE WHEN chot_bo_cap_2 IS NULL AND gt_dau IS NULL AND ngay_ghi_nhan < datetime(${SQL_NOW_VN}, '-48 hours') THEN 1 ELSE 0 END) as qua_han,
        SUM(CASE WHEN chot_bo_cap_2 = 1 THEN 1 ELSE 0 END) as da_chot,
        SUM(CASE WHEN chot_bo_cap_2 = 0 THEN 1 ELSE 0 END) as da_bo,
        SUM(CASE WHEN gt_dau IS NOT NULL THEN 1 ELSE 0 END) as da_giai_trinh,
        SUM(CASE WHEN gt_dau IS NULL AND (chot_bo_cap_2 IS NULL OR chot_bo_cap_2 != 0) THEN 1 ELSE 0 END) as chua_giai_trinh,
        SUM(CASE WHEN gt_dau IS NOT NULL AND gt_dau <= datetime(ngay_ghi_nhan, '+48 hours') THEN 1 ELSE 0 END) as dung_han
     FROM vp`,
  )
    .bind(maKtv, thang, nhom)
    .first<{ tong: number; so_case: number; qua_han: number; da_chot: number; da_bo: number; da_giai_trinh: number; chua_giai_trinh: number; dung_han: number }>();

  const tong = tk?.tong ?? 0;
  const quaHan = tk?.qua_han ?? 0;
  const daChot = tk?.da_chot ?? 0;
  const daBo = tk?.da_bo ?? 0;
  const daGiaiTrinh = tk?.da_giai_trinh ?? 0;
  const chuaGiaiTrinh = tk?.chua_giai_trinh ?? 0;
  const dungHan = tk?.dung_han ?? 0;

  const { results: loaiLoiRows } = await c.env.DB.prepare(
    `SELECT vp.loai_loi, COALESCE(ll.ten_hien_thi, vp.loai_loi) as ten_hien_thi, COUNT(*) as so_luong
     FROM vi_pham vp LEFT JOIN loai_loi_mo_ta ll ON ll.ma = vp.loai_loi
     WHERE (?1 IS NULL OR vp.ky_thuat_vien_ma_ktv = ?1) AND substr(vp.ngay_ghi_nhan, 1, 7) = ?2 AND vp.chot_bo_cap_2 = 1
       AND (?3 IS NULL OR vp.ky_thuat_vien_ma_ktv IN (${sqlKtvCuaGs("?3")}))
     GROUP BY vp.loai_loi, ten_hien_thi ORDER BY so_luong DESC`,
  )
    .bind(maKtv, thang, nhom)
    .all<{ loai_loi: string; ten_hien_thi: string; so_luong: number }>();

  const { results: nghiNgoRows } = await c.env.DB.prepare(
    `${BAO_CAO_CTE} SELECT vp.loai_loi as ma, COALESCE(ll.ten_hien_thi, vp.loai_loi) as ten_hien_thi,
        COUNT(*) as tong,
        SUM(CASE WHEN vp.chot_bo_cap_2 = 1 THEN 1 ELSE 0 END) as da_chot,
        SUM(CASE WHEN vp.chot_bo_cap_2 = 0 THEN 1 ELSE 0 END) as da_bo
     FROM vp LEFT JOIN loai_loi_mo_ta ll ON ll.ma = vp.loai_loi
     GROUP BY vp.loai_loi ORDER BY tong DESC`,
  )
    .bind(maKtv, thang, nhom)
    .all<{ ma: string; ten_hien_thi: string; tong: number; da_chot: number; da_bo: number }>();

  const { results: kq1Rows } = await c.env.DB.prepare(
    `${BAO_CAO_CTE} SELECT COALESCE(vp.ket_qua_cap_1, '') as ma, COALESCE(kq.ten_hien_thi, vp.ket_qua_cap_1, 'Chưa có kết luận') as ten_hien_thi,
        COUNT(*) as tong,
        SUM(CASE WHEN vp.chot_bo_cap_2 = 1 THEN 1 ELSE 0 END) as da_chot,
        SUM(CASE WHEN vp.chot_bo_cap_2 = 0 THEN 1 ELSE 0 END) as da_bo
     FROM vp LEFT JOIN ket_qua_cap_1_mo_ta kq ON kq.ma = vp.ket_qua_cap_1
     GROUP BY vp.ket_qua_cap_1 ORDER BY tong DESC`,
  )
    .bind(maKtv, thang, nhom)
    .all<{ ma: string; ten_hien_thi: string; tong: number; da_chot: number; da_bo: number }>();

  const congViec = await congViecPromise;

  const nhomNghiNgo = (rows: { ma: string; ten_hien_thi: string; tong: number; da_chot: number; da_bo: number }[]) =>
    rows.map((r) => ({
      ma: r.ma,
      tenHienThi: r.ten_hien_thi,
      tong: r.tong,
      daChot: r.da_chot,
      daBo: r.da_bo,
      tyLeTrenTong: tyLe(r.tong, tong),
      tyLeChotLoi: tyLe(r.da_chot, r.da_chot + r.da_bo),
    }));

  return c.json({
    thang,
    thongKe: {
      tong,
      soCase: tk?.so_case ?? 0,
      dangCho: Math.max(0, tong - quaHan - daChot - daBo),
      quaHan,
      daChot,
      daBo,
      tyLeChotLoi: tyLe(daChot, daChot + daBo),
    },
    giaiTrinh: {
      daGiaiTrinh,
      chuaGiaiTrinh,
      dungHan,
      tyLeGiaiTrinh: tyLe(daGiaiTrinh, daGiaiTrinh + chuaGiaiTrinh),
      tyLeDungHan: tyLe(dungHan, daGiaiTrinh),
    },
    theoLoaiLoi: loaiLoiRows.map((r) => ({ loaiLoi: r.loai_loi, tenHienThi: r.ten_hien_thi, soLuong: r.so_luong, tyLe: tyLe(r.so_luong, daChot) })),
    theoLoaiNghiNgo: nhomNghiNgo(nghiNgoRows),
    theoKetQuaCap1: nhomNghiNgo(kq1Rows),
    // null = chua tung lay duoc so lieu DVBH cho thang nay. row null = DVBH co du lieu nhung KTV nay khong co ca nao.
    congViec: congViec.payload
      ? {
          row: maKtv
            ? ktvNhom && !ktvNhom.has(maKtv)
              ? null
              : (congViec.payload.rows.find((r) => r.ma_ktv === maKtv) ?? null)
            : congGopCongViec(ktvNhom ? congViec.payload.rows.filter((r) => ktvNhom.has(r.ma_ktv)) : congViec.payload.rows),
          tinhLuc: congViec.payload.tinh_luc,
          layLuc: congViec.layLuc,
          loi: congViec.loi,
        }
      : null,
  });
});

// GET /vi-pham/:id - chi tiet 1 vi pham, kem giai trinh da nop (neu co) - 403 neu ngoai pham vi xem
// (lib/phamVi.ts duocXemViPham(): Admin/View moi KTV, GS KTV khu vuc minh, KTV thuong chi cua minh).
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
  if (!(await duocXemViPham(c.env.DB, user, maKtv, viPham.ky_thuat_vien_ma_ktv))) return c.json({ error: "FORBIDDEN" }, 403);

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
  if (!(await duocXemViPham(c.env.DB, user, maKtv, viPham.ky_thuat_vien_ma_ktv))) return c.json({ error: "FORBIDDEN" }, 403);
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
  if (!(await duocXemViPham(c.env.DB, user, maKtv, viPham.ky_thuat_vien_ma_ktv))) return c.json({ error: "FORBIDDEN" }, 403);
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
  // Chi nhan anh (bang chung), toi da 10 MB/anh - khop MAX_ANH_MB o ViPhamDetailScreen.tsx.
  if (!contentType.toLowerCase().startsWith("image/")) return c.json({ error: "NOT_IMAGE", message: "Chỉ được tải lên file ảnh." }, 415);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) return c.json({ error: "EMPTY_BODY" }, 400);
  if (bytes.byteLength > 10 * 1024 * 1024) return c.json({ error: "TOO_LARGE", message: "Ảnh vượt 10 MB." }, 413);

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

const THONG_BAO_CONG_TY_PAGE_SIZE = 10;

// GET /thong-bao-cong-ty?trang_thai=chua_doc|da_doc&page=1 - thong bao Admin soan + gui rieng toi
// CHINH nguoi dang dang nhap (khac /thong-bao o tren - do la su kien vi pham tu dong, con day la
// broadcast Admin tu chon nguoi nhan, xem migration 0009). Cung shape response de tai dung UI
// pattern cua NotificationsScreen.tsx.
giaiTrinh.get("/thong-bao-cong-ty", async (c) => {
  const user = c.get("user");
  const trangThai = c.req.query("trang_thai");
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const offset = (page - 1) * THONG_BAO_CONG_TY_PAGE_SIZE;

  const dieuKienDoc = trangThai === "chua_doc" ? " AND x.da_doc_luc IS NULL" : trangThai === "da_doc" ? " AND x.da_doc_luc IS NOT NULL" : "";
  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.tieu_de, t.noi_dung, t.nguoi_tao, t.tao_luc, x.da_doc_luc
     FROM thong_bao_cong_ty_xac_nhan x JOIN thong_bao_cong_ty t ON t.id = x.thong_bao_id
     WHERE x.nguoi_nhan = ?${dieuKienDoc} ORDER BY t.tao_luc DESC, t.id DESC LIMIT ? OFFSET ?`,
  )
    .bind(user.email, THONG_BAO_CONG_TY_PAGE_SIZE + 1, offset)
    .all();
  const hasMore = results.length > THONG_BAO_CONG_TY_PAGE_SIZE;
  const rows = hasMore ? results.slice(0, THONG_BAO_CONG_TY_PAGE_SIZE) : results;

  const chuaDocRow = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM thong_bao_cong_ty_xac_nhan WHERE nguoi_nhan = ? AND da_doc_luc IS NULL",
  )
    .bind(user.email)
    .first<{ cnt: number }>();
  return c.json({ rows, chuaDoc: chuaDocRow?.cnt ?? 0, hasMore });
});

// POST /thong-bao-cong-ty/:id/danh-dau-da-doc - danh dau 1 thong bao cong ty la da doc (chi tren
// dong cua CHINH minh - loc them nguoi_nhan trong WHERE, khong tin id tho tu client). Giu nguyen
// da_doc_luc cu neu da doc truoc do (khong ghi de lai thoi diem doc dau tien).
giaiTrinh.post("/thong-bao-cong-ty/:id/danh-dau-da-doc", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await c.env.DB.prepare(
    "UPDATE thong_bao_cong_ty_xac_nhan SET da_doc_luc = ? WHERE thong_bao_id = ? AND nguoi_nhan = ? AND da_doc_luc IS NULL",
  )
    .bind(nowVN(), id, user.email)
    .run();
  return c.json({ ok: true });
});

// POST /thong-bao-cong-ty/danh-dau-tat-ca-da-doc - danh dau TOAN BO thong bao cong ty chua doc cua
// CHINH minh la da doc.
giaiTrinh.post("/thong-bao-cong-ty/danh-dau-tat-ca-da-doc", async (c) => {
  const user = c.get("user");
  await c.env.DB.prepare("UPDATE thong_bao_cong_ty_xac_nhan SET da_doc_luc = ? WHERE nguoi_nhan = ? AND da_doc_luc IS NULL")
    .bind(nowVN(), user.email)
    .run();
  return c.json({ ok: true });
});

export default giaiTrinh;
