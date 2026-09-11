/**
 * Gio VN hien tai dang "YYYY-MM-DD HH:MM:SS", dung cho moi cot timestamp he thong tu sinh - port
 * nguyen ban tu linh-kien-app backend/src/lib/vnTime.ts. Toan he thong quy uoc luu gio VN dia
 * phuong cho MOI cot thoi gian, khop dung quy uoc field thoi gian cua PARTNER_API_GUIDE.md (muc
 * 3.3.1/9.1: "YYYY-MM-DD HH:MM:SS", khong phai UTC/ISO-8601).
 */
export function nowVN(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

/** "YYYY-MM-DD" (gio VN) - dung cho ngay_giai_trinh khi gui ve DVBH (muc 9.2 guide khuyen nghi chi
 * ngay, khong gio). */
export function todayVN(): string {
  return nowVN().slice(0, 10);
}

/** Format 1 epoch millisecond (vd cot *_ms noi bo dung cho rate-limit) thanh chuoi gio VN cung dinh
 * dang voi nowVN() - dung khi tra ve frontend de hien thi ("Da dong bo luc ..."), KHONG dung epoch
 * ms tho vi frontend/nguoi dung can doc duoc truc tiep. */
export function formatVNFromMs(ms: number): string {
  return new Date(ms + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}
