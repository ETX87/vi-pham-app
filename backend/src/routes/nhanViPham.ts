import { Hono, type Context } from "hono";
import type { Env } from "../types";
import { inboundAuth } from "../lib/inboundAuth";
import { normalizeVietnameseName } from "../lib/normalizeName";
import { sendPushToUser } from "../lib/webPush";
import { nowVN } from "../lib/vnTime";

// POST /api/nhan-vi-pham - endpoint DVBH goi SANG (PARTNER_API_GUIDE.md muc 9.1), CUNG 1 endpoint
// cho 3 loai su kien khac nhau, phan biet qua "loai_su_kien" (+ "nguon_cap_nhat" khi la "cap_nhat"):
//   - "nghi_ngo_moi" (mac dinh neu thieu field, tuong thich nguoc voi hop dong truoc 2026-09-11):
//     CSKH vua ghi nhan nghi ngo vi pham moi - tao dong vi_pham moi (muc 9.1.1).
//   - "cap_nhat" + nguon_cap_nhat="qc_chot_cap_2": QC vua chot/bo vi pham cap 2 (muc 9.1.2a).
//   - "cap_nhat" + nguon_cap_nhat="giam_sat_giai_trinh": Giam sat nhap giai trinh thay TRUC TIEP
//     trong DVBH, khong qua app nay (muc 9.1.2b).
// DVBH goi bat dong bo (waitUntil), KHONG doc response, KHONG retry - vi vay endpoint nay PHAI tra
// loi NHANH va khong bao gio "treo" cho xu ly nang (khop ten/ghi DB/gui push deu day xuong
// executionCtx.waitUntil() sau khi da tra response).
const nhanViPham = new Hono<{ Bindings: Env }>();

interface NghiNgoMoiBody {
  loai_su_kien?: "nghi_ngo_moi";
  vi_pham_id: string;
  case_id?: string | null;
  loai_loi: string;
  ket_qua_cap_1?: string | null;
  khach_hang?: string | null;
  khu_vuc?: string | null;
  ky_thuat_vien?: string | null;
  seri_san_pham?: string | null;
  ngay_ghi_nhan: string;
  nguoi_ghi_nhan: string;
  // Ghi chu CSKH nhap ben DVBH (thêm 2026-09-14, xem PARTNER_API_GUIDE.md muc 9.1.1) - optional de
  // tuong thich nguoc voi DVBH ban cu chua gui truong nay.
  ghi_chu?: string | null;
}

interface QcChotCap2Body {
  loai_su_kien: "cap_nhat";
  nguon_cap_nhat: "qc_chot_cap_2";
  vi_pham_id: string;
  case_id?: string | null;
  chot_bo_cap_2: boolean;
  nguoi_chot: string;
  ngay_chot: string;
}

interface GiamSatGiaiTrinhBody {
  loai_su_kien: "cap_nhat";
  nguon_cap_nhat: "giam_sat_giai_trinh";
  vi_pham_id: string;
  case_id?: string | null;
  nguoi_giai_trinh?: string | null;
  ngay_giai_trinh: string;
  noi_dung_giai_trinh?: string | null;
  ghi_chu?: string | null;
  anh_urls?: string[];
}

type CapNhatBody = QcChotCap2Body | GiamSatGiaiTrinhBody;

interface KtvLienHeRow {
  ma_ktv: string;
  ten_hien_thi: string | null;
  email_dang_nhap: string | null;
}

// Khop "ky_thuat_vien" (chuoi tho DVBH gui, vd "(phongld.mn1) CTV Tien Giang - Le Dang Phong - NS-3296")
// voi danh ba ktv_lien_he. Uu tien 1: MA KTV trong ngoac dau chuoi == ktv_lien_he.ma_ktv (khong phan
// biet hoa thuong). Uu tien 2 (khong co ma / ma khong co trong danh ba): so ten da chuan hoa, bo duoi
// " - NS-xxxx" ca 2 phia. Khop DUNG 1 dong -> gan; 0 hoac >1 dong -> hang doi "Chua xac dinh KTV".
// (2026-11-27: tu 17/11 DVBH them duoi " - NS-xxxx" vao ten KTV -> so nguyen chuoi truot het, 94 vi pham
// khong toi tay KTV - vi vay doi sang bat theo ma KTV.)
const MA_KTV_TRONG_NGOAC_RE = /^\s*\(([^)]+)\)/;
const DUOI_MA_NS_RE = /\s*-\s*NS-\d+\s*$/i;

export function tachMaKtv(tenKtv: string | null | undefined): string | null {
  const m = tenKtv?.match(MA_KTV_TRONG_NGOAC_RE);
  return m ? m[1].trim().toLowerCase() || null : null;
}

function chuanHoaTenKtv(ten: string | null | undefined): string {
  return normalizeVietnameseName((ten ?? "").replace(DUOI_MA_NS_RE, ""));
}

export function khopKtvTrongDanhBa(danhBa: KtvLienHeRow[], tenKtv: string | null | undefined): KtvLienHeRow | null {
  const ma = tachMaKtv(tenKtv);
  if (ma) {
    const theoMa = danhBa.filter((r) => r.ma_ktv.trim().toLowerCase() === ma);
    if (theoMa.length === 1) return theoMa[0];
  }
  const target = chuanHoaTenKtv(tenKtv);
  if (!target) return null;
  const theoTen = danhBa.filter((r) => chuanHoaTenKtv(r.ten_hien_thi) === target);
  return theoTen.length === 1 ? theoTen[0] : null;
}

async function docDanhBaKtv(db: D1Database): Promise<KtvLienHeRow[]> {
  const { results } = await db.prepare("SELECT ma_ktv, ten_hien_thi, email_dang_nhap FROM ktv_lien_he").all<KtvLienHeRow>();
  return results;
}

async function matchKtvByName(db: D1Database, tenKtv: string | null | undefined): Promise<KtvLienHeRow | null> {
  if (!tenKtv?.trim()) return null;
  return khopKtvTrongDanhBa(await docDanhBaKtv(db), tenKtv);
}

/** Cron moi dau gio (index.ts scheduled()): khop lai cac vi pham dang o hang doi "Chua xac dinh KTV"
 * (ky_thuat_vien_ma_ktv NULL, Admin chua bo qua) - danh ba / luat khop doi thi tu gan bu, khong can Admin
 * gan tay. Gan duoc + QC CHUA chot/bo cap 2 -> gui thong bao trong app + push cho KTV. */
export async function ganLaiViPhamChuaXacDinh(env: Env): Promise<{ tong: number; gan: number }> {
  const { results: choGan } = await env.DB.prepare(
    "SELECT id, loai_loi, case_id, ky_thuat_vien_ten, chot_bo_cap_2 FROM vi_pham WHERE ky_thuat_vien_ma_ktv IS NULL AND bo_qua_gan_ktv = 0 AND ky_thuat_vien_ten IS NOT NULL LIMIT 1000",
  ).all<{ id: string; loai_loi: string; case_id: string | null; ky_thuat_vien_ten: string; chot_bo_cap_2: number | null }>();
  if (choGan.length === 0) return { tong: 0, gan: 0 };

  const danhBa = await docDanhBaKtv(env.DB);
  const ganDuoc: { vp: (typeof choGan)[number]; ktv: KtvLienHeRow }[] = [];
  for (const vp of choGan) {
    const ktv = khopKtvTrongDanhBa(danhBa, vp.ky_thuat_vien_ten);
    if (ktv) ganDuoc.push({ vp, ktv });
  }
  if (ganDuoc.length === 0) return { tong: choGan.length, gan: 0 };

  const stmt = env.DB.prepare("UPDATE vi_pham SET ky_thuat_vien_ma_ktv = ? WHERE id = ? AND ky_thuat_vien_ma_ktv IS NULL");
  await env.DB.batch(ganDuoc.map(({ vp, ktv }) => stmt.bind(ktv.ma_ktv, vp.id)));

  for (const { vp, ktv } of ganDuoc) {
    if (vp.chot_bo_cap_2 != null) continue; // QC da chot/bo -> khong bao "can giai trinh" nua.
    try {
      await notifyKtvViPham(env, ktv, { id: vp.id, loai_loi: vp.loai_loi, case_id: vp.case_id });
    } catch (err) {
      console.error(`[ganLaiViPhamChuaXacDinh] bao KTV ${ktv.ma_ktv} vi_pham=${vp.id} loi:`, err);
    }
  }
  console.log(`[ganLaiViPhamChuaXacDinh] gan bu ${ganDuoc.length}/${choGan.length} vi pham`);
  return { tong: choGan.length, gan: ganDuoc.length };
}

async function getEmailDangNhap(db: D1Database, maKtv: string | null): Promise<string | null> {
  if (!maKtv) return null;
  const row = await db.prepare("SELECT email_dang_nhap FROM ktv_lien_he WHERE ma_ktv = ?").bind(maKtv).first<{ email_dang_nhap: string | null }>();
  return row?.email_dang_nhap ?? null;
}

async function ghiThongBao(db: D1Database, email: string, loai: string, noiDung: string, viPhamId: string): Promise<void> {
  await db.prepare(`INSERT INTO thong_bao (nguoi_nhan, loai, noi_dung, link_type, link_id) VALUES (?, ?, ?, 'vi_pham', ?)`).bind(email, loai, noiDung, viPhamId).run();
}

/** Gui push + thong bao trong-app cho 1 KTV vua duoc gan 1 vi pham can giai trinh - dung chung
 * cho ca luong nhan tu dong (khop ten thanh cong) lan Admin gan tay (adminViPham.ts). */
export async function notifyKtvViPham(env: Env, ktv: KtvLienHeRow, viPham: { id: string; loai_loi: string; case_id: string | null }): Promise<void> {
  if (!ktv.email_dang_nhap) return; // KTV chua tung dang nhap qua he nay -> khong co user de gan thong bao trong-app.

  await ghiThongBao(env.DB, ktv.email_dang_nhap, "vi_pham_moi", `Ban co 1 vi pham can giai trinh: ${viPham.loai_loi}${viPham.case_id ? ` (case ${viPham.case_id})` : ""}`, viPham.id);
  await sendPushToUser(env, ktv.email_dang_nhap, { title: "Co vi pham can giai trinh", body: viPham.loai_loi, url: `/vi-pham/${viPham.id}` });
}

async function handleNghiNgoMoi(c: Context<{ Bindings: Env }>, body: NghiNgoMoiBody): Promise<{ ok: boolean } | { error: string }> {
  if (!body.vi_pham_id || !body.loai_loi || !body.ngay_ghi_nhan || !body.nguoi_ghi_nhan) return { error: "INVALID_BODY" };

  const insertResult = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO vi_pham
       (id, case_id, loai_loi, ket_qua_cap_1, khach_hang, khu_vuc, ky_thuat_vien_ten, seri_san_pham, ngay_ghi_nhan, nguoi_ghi_nhan, nhan_luc, ghi_chu)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      body.vi_pham_id,
      body.case_id ?? null,
      body.loai_loi,
      body.ket_qua_cap_1 ?? null,
      body.khach_hang ?? null,
      body.khu_vuc ?? null,
      body.ky_thuat_vien ?? null,
      body.seri_san_pham ?? null,
      body.ngay_ghi_nhan,
      body.nguoi_ghi_nhan,
      nowVN(),
      body.ghi_chu ?? null,
    )
    .run();

  // meta.changes === 0 nghia la vi_pham_id nay da ton tai (nhan trung lap, phong khi DVBH lo goi 2
  // lan) - khong lam gi them, tranh khop ten/gui push lai lan 2 cho cung 1 vi pham.
  const isNewRow = (insertResult.meta.changes ?? 0) > 0;

  if (isNewRow) {
    c.executionCtx.waitUntil(
      (async () => {
        const matched = await matchKtvByName(c.env.DB, body.ky_thuat_vien);
        if (!matched) return; // 0 hoac >1 khop -> vao hang doi "chua xac dinh KTV", Admin xu ly tay.
        await c.env.DB.prepare("UPDATE vi_pham SET ky_thuat_vien_ma_ktv = ? WHERE id = ?").bind(matched.ma_ktv, body.vi_pham_id).run();
        await notifyKtvViPham(c.env, matched, { id: body.vi_pham_id, loai_loi: body.loai_loi, case_id: body.case_id ?? null });
      })(),
    );
  }

  return { ok: true };
}

async function handleQcChotCap2(c: Context<{ Bindings: Env }>, body: QcChotCap2Body): Promise<{ ok: boolean } | { error: string }> {
  if (!body.vi_pham_id || typeof body.chot_bo_cap_2 !== "boolean" || !body.nguoi_chot || !body.ngay_chot) return { error: "INVALID_BODY" };

  // UPDATE ... RETURNING de biet luon dong co ton tai khong + lay thong tin can de thong bao KTV,
  // khong can 1 lenh SELECT rieng truoc.
  const updated = await c.env.DB.prepare("UPDATE vi_pham SET chot_bo_cap_2 = ?, nguoi_chot = ?, ngay_chot = ? WHERE id = ? RETURNING ky_thuat_vien_ma_ktv, loai_loi, case_id")
    .bind(body.chot_bo_cap_2 ? 1 : 0, body.nguoi_chot, body.ngay_chot, body.vi_pham_id)
    .first<{ ky_thuat_vien_ma_ktv: string | null; loai_loi: string; case_id: string | null }>();

  // Khong tim thay vi_pham_id - kha nang DVBH da tung goi "nghi_ngo_moi" nhung app nay lo mat lan
  // goi do (khong co retry, xem ghi chu trong guide). Khong co gi de cap nhat -> bo qua, van tra 200
  // (DVBH khong doc response nen khong anh huong gi, chi la khong co du lieu de cap nhat).
  if (!updated) return { ok: true };

  c.executionCtx.waitUntil(
    (async () => {
      const email = await getEmailDangNhap(c.env.DB, updated.ky_thuat_vien_ma_ktv);
      if (!email) return;
      const ketQua = body.chot_bo_cap_2 ? "XÁC NHẬN là vi phạm" : "BỎ (không tính vi phạm)";
      await ghiThongBao(c.env.DB, email, "qc_chot_cap_2", `QC đã ${ketQua}: ${updated.loai_loi}${updated.case_id ? ` (case ${updated.case_id})` : ""}`, body.vi_pham_id);
      await sendPushToUser(c.env, email, { title: "QC đã có quyết định cuối", body: `${updated.loai_loi} - ${ketQua}`, url: `/vi-pham/${body.vi_pham_id}` });
    })(),
  );

  return { ok: true };
}

async function handleGiamSatGiaiTrinh(c: Context<{ Bindings: Env }>, body: GiamSatGiaiTrinhBody): Promise<{ ok: boolean } | { error: string }> {
  if (!body.vi_pham_id || !body.ngay_giai_trinh) return { error: "INVALID_BODY" };

  const viPham = await c.env.DB.prepare("SELECT ky_thuat_vien_ma_ktv, loai_loi, case_id FROM vi_pham WHERE id = ?")
    .bind(body.vi_pham_id)
    .first<{ ky_thuat_vien_ma_ktv: string | null; loai_loi: string; case_id: string | null }>();
  // Cung nhu handleQcChotCap2 - khong tim thay thi bo qua, khong co gi de gan giai trinh vao.
  if (!viPham) return { ok: true };

  const anhUrls = (body.anh_urls ?? []).slice(0, 5);
  // vi_pham_giai_trinh.nguoi_giai_trinh la NOT NULL (0001_init.sql) nhung ben DVBH truong nay la
  // optional (routes/viPham.ts POST /:id/giai-trinh) - GS co the bo trong. Fallback placeholder de
  // tranh loi constraint (bug thuc te 2026-09-13: case 1322764, INSERT nem loi -> 500 -> DVBH khong
  // retry -> giai trinh cua GS khong bao gio toi duoc app nay). Khong hien thi truong nay o UI
  // (ViPhamDetailScreen.tsx) nen placeholder khong anh huong gi.
  const nguoiGiaiTrinh = body.nguoi_giai_trinh?.trim() || "Giam sat (DVBH)";
  // dong_bo_dvbh_luc = nowVN() NGAY LUC INSERT (khac han dong KTV tu nop qua POST .../giai-trinh,
  // luon bat dau NULL roi moi thu dong bo) - vi du lieu nay goc DA O SAN trong DVBH roi, KHONG can
  // gui nguoc lai (tranh cron retryPendingGiaiTrinh() hieu nham day la dong "chua dong bo" va gui
  // lai cho DVBH mot du lieu DVBH da co san).
  await c.env.DB.prepare(
    `INSERT INTO vi_pham_giai_trinh (id, vi_pham_id, nguoi_giai_trinh, ngay_giai_trinh, noi_dung_giai_trinh, ghi_chu, anh_urls, tao_luc, dong_bo_dvbh_luc, nguon)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'giam_sat_dvbh')`,
  )
    .bind(crypto.randomUUID(), body.vi_pham_id, nguoiGiaiTrinh, body.ngay_giai_trinh, body.noi_dung_giai_trinh ?? null, body.ghi_chu ?? null, JSON.stringify(anhUrls), nowVN(), nowVN())
    .run();

  c.executionCtx.waitUntil(
    (async () => {
      const email = await getEmailDangNhap(c.env.DB, viPham.ky_thuat_vien_ma_ktv);
      if (!email) return;
      await ghiThongBao(c.env.DB, email, "giai_trinh_gs_nhap", `Giám sát đã nhập giải trình thay bạn: ${viPham.loai_loi}${viPham.case_id ? ` (case ${viPham.case_id})` : ""}`, body.vi_pham_id);
      await sendPushToUser(c.env, email, { title: "Giám sát đã giải trình thay bạn", body: viPham.loai_loi, url: `/vi-pham/${body.vi_pham_id}` });
    })(),
  );

  return { ok: true };
}

nhanViPham.post("/", inboundAuth(), async (c) => {
  const body = await c.req.json<NghiNgoMoiBody | CapNhatBody>().catch(() => null);
  if (!body) return c.json({ error: "INVALID_BODY" }, 400);

  let result: { ok: boolean } | { error: string };
  if (body.loai_su_kien === "cap_nhat") {
    if ((body as CapNhatBody).nguon_cap_nhat === "qc_chot_cap_2") result = await handleQcChotCap2(c, body as QcChotCap2Body);
    else if ((body as CapNhatBody).nguon_cap_nhat === "giam_sat_giai_trinh") result = await handleGiamSatGiaiTrinh(c, body as GiamSatGiaiTrinhBody);
    // nguon_cap_nhat la` gia tri la - bo qua, tra 200 de tuong thich nguoc neu DVBH them loai moi sau
    // nay ma app chua kip cap nhat theo kip (dung tinh than "khong chan" cua toan bo chieu 1).
    else result = { ok: true };
  } else {
    // Thieu loai_su_kien (hop dong cu truoc 2026-09-11) hoac "nghi_ngo_moi" - cung 1 xu ly.
    result = await handleNghiNgoMoi(c, body as NghiNgoMoiBody);
  }

  if ("error" in result) return c.json(result, 400);
  return c.json(result);
});

export default nhanViPham;
