import type { ViPham } from "../types";

type ViPhamStatusInput = Pick<ViPham, "da_giai_trinh" | "dang_cho_dong_bo" | "chot_bo_cap_2">;

// 3 trang thai duy nhat hien tren 1 the vi pham (khop dung du lieu that, khong bia them khai niem):
//   - "Chua xu ly": chua nop giai trinh VA QC chua bo qua.
//   - "Dang cho dong bo": da nop nhung con it nhat 1 ban giai trinh chua gui thanh cong ve DVBH.
//   - "Da xu ly": da nop VA da dong bo xong, HOAC QC da bo qua (khong can giai trinh nua).
export function viPhamStatus(vp: ViPhamStatusInput): { label: string; cls: string } {
  if (!vp.da_giai_trinh && vp.chot_bo_cap_2 !== 0) return { label: "Chưa xử lý", cls: "status-pending" };
  if (vp.da_giai_trinh && vp.dang_cho_dong_bo) return { label: "Đang chờ đồng bộ", cls: "status-syncing" };
  return { label: "Đã xử lý", cls: "status-done" };
}

export function StatusBadge({ vp }: { vp: ViPhamStatusInput }) {
  const { label, cls } = viPhamStatus(vp);
  return <span className={`status-badge ${cls}`}>{label}</span>;
}
