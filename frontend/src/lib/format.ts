// "loai_loi" luu trong DB dung nguyen van chuoi DVBH gui (khong dau, xem PARTNER_API_GUIDE.md muc
// 9.1.1) - map sang nhan tieng Viet co dau cho de doc tren giao dien. Gia tri la khong khop bang nay
// (hop dong doi sau nay) van hien nguyen chuoi goc, khong loi.
const LOAI_LOI_LABEL: Record<string, string> = {
  "Loi 120 phut": "Lỗi 120 phút",
  "Hen qua 24h": "Hẹn quá 24h",
  "Loi lo ke hoach": "Lỗi lỡ kế hoạch",
  "KH hen lai": "Khách hàng hẹn lại",
};

export function loaiLoiLabel(raw: string): string {
  return LOAI_LOI_LABEL[raw] ?? raw;
}

const KET_QUA_CAP_1_LABEL: Record<string, string> = {
  "Loi khong lien he": "Lỗi không liên hệ được",
  "Loi sai bao cao": "Lỗi sai báo cáo",
  "Loi khac": "Lỗi khác",
};

export function ketQuaCap1Label(raw: string): string {
  return KET_QUA_CAP_1_LABEL[raw] ?? raw;
}

/** Chu cai dau cua ten hien thi (hoac email neu chua co ten) - dung lam noi dung avatar tron mac
 * dinh khi chua co anh dai dien that. */
export function initials(ten: string | null, email: string): string {
  const source = (ten ?? email ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
