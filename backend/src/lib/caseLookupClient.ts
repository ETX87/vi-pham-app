import type { Env } from "../types";

// Goi GET /api/partner/case-lookup cua DVBH (PARTNER_API_GUIDE.md muc 1-7) - tra cuu THONG TIN GOC
// cua 1 case bao hanh theo case_id, dung de KTV xem chi tiet case khi mo 1 vi pham. Day la endpoint
// DOC-ONLY dung chung cho nhieu doi tac (khac han cac endpoint /sync/* rieng cho vi-pham-app) - KHONG
// loc theo doi tac/KTV o phia DVBH, viec kiem soat "ai duoc xem case nao" la trach nhiem cua CHINH
// vi-pham-app (xem routes/giaiTrinh.ts: chi KTV dang gan voi vi_pham do moi goi duoc, kiem tra TRUOC
// khi goi ham nay).

export interface CaseLookupPreview {
  ky_thuat_vien: string | null;
  khach_hang: string | null;
  seri_san_pham: string | null;
  khu_vuc: string | null;
  tinh: string | null;
  quan_huyen: string | null;
  hang: string | null;
  san_pham_bao_hanh: string | null;
  tien_do_hoan_thanh: string | null;
  mo_ta_loi: string | null;
  nhom_san_pham: string | null;
  nhom_yeu_cau: string | null;
  loai_yeu_cau: string | null;
  hinh_thuc_bao_hanh: string | null;
  ngay_mua: string | null;
  thoi_gian_cskh_tiep_nhan: string | null;
  thoi_gian_hen_xu_ly: string | null;
  thoi_gian_hoan_thanh: string | null;
  doi_tac: string | null;
  link_crm: string | null;
  noi_dung_xu_ly: string | null;
  luu_y_loi_linh_kien: string | null;
  cach_thuc_xu_ly: string | null;
  nganh: string | null;
  loai_nganh: string | null;
  nhom_kh: string | null;
  dt_san_pham: number | null;
  dt_linh_kien: number | null;
  dt_dich_vu: number | null;
  ly_do_qua_han: string | null;
  // Them 2026-09-11 (cung dot cap nhat guide bo sung su kien "cap_nhat" o muc 9.1.2).
  ngay_import: string | null;
  ngay_cap_nhat_gan_nhat: string | null;
  dung_han: string | null;
  xu_ly_24h_bucket: string | null;
  ly_do_huy: string | null;
  link_hinh_anh: string[];
}

export interface CaseLookupGiaiTrinh {
  case_id: string;
  ly_do_cham: string;
  noi_dung: string | null;
  ngay_giai_trinh: string;
}

export interface CaseLookupResult {
  found: boolean;
  preview: CaseLookupPreview | null;
  giaiTrinh: CaseLookupGiaiTrinh[];
}

export async function lookupCase(env: Env, caseId: string): Promise<CaseLookupResult> {
  const base = (env.CASE_LOOKUP_BASE_URL || "https://dvbh.dichvu3t.workers.dev").replace(/\/$/, "");
  const res = await fetch(`${base}/api/partner/case-lookup?id=${encodeURIComponent(caseId)}`, {
    headers: { "X-API-Key": env.CASE_LOOKUP_API_KEY },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP_${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as CaseLookupResult;
}
