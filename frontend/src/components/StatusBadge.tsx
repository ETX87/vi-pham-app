import type { ViPham } from "../types";

type ViPhamStatusInput = Pick<ViPham, "da_giai_trinh" | "dang_cho_dong_bo" | "chot_bo_cap_2" | "ngay_ghi_nhan">;

const HAN_GIAI_TRINH_MS = 48 * 60 * 60 * 1000;

// "ngay_ghi_nhan" la chuoi gio VN dia phuong "YYYY-MM-DD HH:MM:SS" (quy uoc chung toan he thong, xem
// backend/src/lib/vnTime.ts) - doc lai bang cach gan hau to "Z" de Date hieu dung y nguyen gia tri do
// la moc thoi gian can so sanh, khong tu quy doi mui gio.
function isQuaHanGiaiTrinh(ngayGhiNhan: string): boolean {
  const recordedMs = new Date(ngayGhiNhan.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(recordedMs)) return false;
  return Date.now() - recordedMs > HAN_GIAI_TRINH_MS;
}

// 4 trang thai chinh cua 1 vi pham (uu tien tu tren xuong, dung o dieu kien dung dau tien):
//   1. "Da chot loi": QC da co ket luan (chot_bo_cap_2 khac NULL) - bat ke da/chua giai trinh truoc do.
//   2. "Cho chot loi": da nop giai trinh, QC chua chot.
//   3. "Qua han giai trinh": chua nop, QC chua chot, va da qua 48h ke tu ngay_ghi_nhan.
//   4. "Chua giai trinh": chua nop, QC chua chot, con trong han 48h.
// KHONG chan nop giai trinh khi da qua han (xem ViPhamDetailScreen.tsx) - day chi la nhan hien thi.
export function viPhamStatus(vp: ViPhamStatusInput): { label: string; cls: string } {
  if (vp.chot_bo_cap_2 !== null) return { label: "Đã chốt lỗi", cls: "status-decided" };
  if (vp.da_giai_trinh) return { label: "Chờ chốt lỗi", cls: "status-awaiting" };
  if (isQuaHanGiaiTrinh(vp.ngay_ghi_nhan)) return { label: "Quá hạn giải trình", cls: "status-overdue" };
  return { label: "Chưa giải trình", cls: "status-not-submitted" };
}

// "Dang cho dong bo" la trang thai KY THUAT rieng (giai trinh da nop nhung chua gui thanh cong ve
// DVBH, dong_bo_dvbh_luc con NULL) - khong phai 1 trong 4 trang thai nghiep vu chinh o tren, hien thi
// dang 1 chip PHU de nguoi dung/Admin biet ma khong lan voi tien trinh xu ly loi.
export function StatusBadge({ vp }: { vp: ViPhamStatusInput }) {
  const { label, cls } = viPhamStatus(vp);
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, alignItems: "center", flexShrink: 0 }}>
      <span className={`status-badge ${cls}`}>{label}</span>
      {vp.dang_cho_dong_bo ? <span className="tag tag-syncing">Đang chờ đồng bộ</span> : null}
    </span>
  );
}
