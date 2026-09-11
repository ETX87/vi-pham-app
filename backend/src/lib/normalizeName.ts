// Chuan hoa ten nguoi (tieng Viet) de khop "ky_thuat_vien" (chuoi tho DVBH gui) voi
// ktv_lien_he.ten_hien_thi (cache tu linh-kien-app) - xem routes/nhanViPham.ts.
// Buoc chuan hoa: trim -> lowercase -> bo dau tieng Viet -> gop khoang trang thua.
// Dung String.normalize("NFD") + regex loai bo cac ky tu dau (combining marks, U+0300-U+036F).
// Regex duoc dung qua RegExp(...) voi \\u escape (khong go thang ky tu Unicode trong literal
// source) de tranh rui ro sai encoding file khi luu/doc lai qua nhieu cong cu khac nhau.
const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");
const D_WITH_STROKE_LOWER_RE = new RegExp("\\u0111", "g"); // "d" (chu thuong co gach ngang)
const D_WITH_STROKE_UPPER_RE = new RegExp("\\u0110", "g"); // "D" (chu hoa co gach ngang)

export function normalizeVietnameseName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "") // bo dau
    .replace(D_WITH_STROKE_LOWER_RE, "d") // khong tach duoc qua NFD nhu cac ky tu co dau khac
    .replace(D_WITH_STROKE_UPPER_RE, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
