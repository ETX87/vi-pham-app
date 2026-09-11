export interface AppUser {
  email: string;
  ten: string | null;
  vai_tro: "Admin" | null;
  trang_thai_duyet: "Cho duyet" | "Da duyet" | "Tu choi";
  bi_khoa: boolean;
}

export interface ViPham {
  id: string;
  case_id: string | null;
  loai_loi: string;
  ket_qua_cap_1: string | null;
  khach_hang: string | null;
  khu_vuc: string | null;
  ky_thuat_vien_ten: string | null;
  ky_thuat_vien_ma_ktv?: string | null;
  seri_san_pham: string | null;
  ngay_ghi_nhan: string;
  nguoi_ghi_nhan: string;
  nhan_luc: string;
  da_giai_trinh?: number;
  dang_cho_dong_bo?: number;
  // Ket qua chot cap 2 cua QC (PARTNER_API_GUIDE.md muc 9.1.2a) - NULL = QC chua chot.
  chot_bo_cap_2: number | null;
  nguoi_chot: string | null;
  ngay_chot: string | null;
}

export interface GiaiTrinh {
  id: string;
  vi_pham_id: string;
  nguoi_giai_trinh: string;
  ngay_giai_trinh: string;
  noi_dung_giai_trinh: string | null;
  ghi_chu: string | null;
  anh_urls: string; // chuoi JSON (string[]) tu DB - JSON.parse truoc khi dung
  tao_luc: string;
  dong_bo_dvbh_luc: string | null;
  dong_bo_loi: string | null;
  // 'ktv_qua_app' = KTV tu nop qua app nay; 'giam_sat_dvbh' = Giam sat nhap thay TRUC TIEP trong
  // DVBH, DVBH bao sang qua muc 9.1.2b - khong can dong bo nguoc.
  nguon: "ktv_qua_app" | "giam_sat_dvbh";
}

// Khop dung field cua PARTNER_API_GUIDE.md muc 3.3.1 (response "preview" cua GET /api/partner/case-lookup).
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

export interface CaseLookupCache {
  found: boolean;
  preview: CaseLookupPreview | null;
  giaiTrinh: CaseLookupGiaiTrinh[];
  fetchedAt: string;
}

export interface ThongBao {
  id: number;
  nguoi_nhan: string;
  loai: string;
  noi_dung: string;
  link_type: string | null;
  link_id: string | null;
  da_doc: number;
  ngay_tao: string;
}

export interface KtvOption {
  ma_ktv: string;
  ten_hien_thi: string | null;
  email_dang_nhap: string | null;
}
