# CLAUDE.md — vi pham app


Kho `ETX87/vi-pham-app` · Firebase project: `—` · Nền tảng: khong-deploy · Thư mục build: `.`.
(Tệp do Trợ lý Mây tự sinh khi phát hiện kho — chủ kho bổ sung thêm luật riêng của app vào đây.)

## Cấu trúc
DEPLOY.md · DE_XUAT_API_THONG_KE_DVBH.md · Logo icon.png · PARTNER_API_GUIDE.md · UI_SPEC.md · backend · demo giao dien.png · frontend · migrations · package-lock.json · package.json · wrangler.jsonc

## Lệnh kiểm tra bắt buộc (đỏ là DỪNG, không mở PR)
```bash
(không có bước build — đọc kỹ và chạy thử tệp liên quan)
```
Deploy CHỈ bằng `--only`; trong CI, deploy do workflow `may-deploy` làm — KHÔNG tự deploy khi sửa.

## Nhận việc từ Trợ lý Mây (tự sửa)
- Issue gắn nhãn `may:phan-tich` là ĐỀ XUẤT CẢI TIẾN cần phân tích trước: workflow `may-phan-tich` chỉ ĐỌC mã để soạn BRD cho Giám đốc duyệt — không sửa mã ở bước này. Khi duyệt, BRD nằm ở đầu issue; làm đúng BRD và lưu nó vào `docs/yeu-cau/MAY-xxxxx.md`.
- Issue gắn nhãn `may:tu-sua` là việc do Trợ lý Mây chuyển sang, mã `MAY-xxxxx` ở tiêu đề. Sửa ĐÚNG phạm vi mô tả.
- Kiểm tra bắt buộc trước khi mở PR: `npm run build` (eslint chạy trước; đỏ = dừng). Flutter: `flutter analyze && flutter build web`.
- Nhánh `may/may-xxxxx`, PR vào `main`, tiêu đề bắt đầu bằng mã, mô tả tiếng Việt (nguyên nhân · cách sửa · cách thử), ghi `Closes #<issue>`.
- KHÔNG BAO GIỜ: sửa `firestore.rules`/`storage.rules`/hàm `hrLink`/secrets; chạy `firebase deploy` trần; đổi tính năng ngoài issue; xoá dữ liệu.
- Không chắc / cần người quyết: bình luận `MÂY: CẦN NGƯỜI` + lý do rồi dừng.
- Deploy do workflow `may-deploy` làm sau khi được duyệt — KHÔNG tự deploy trong lúc sửa.
- Khi làm việc TRONG PHIÊN NÀY (không phải workflow) mà bản sửa giải quyết một issue Mây đang mở (`gh issue list --label may:cho-duyet,may:tu-sua`): ghi mã `MAY-xxxxx` vào dòng đầu commit → Trợ lý Mây tự báo hoàn thành, không cần Giám đốc bấm tay.

<!-- may-ba-lan -->
## Ba làn xử lý của Trợ lý Mây (Giám đốc chốt 18/11/2026 — áp dụng VĨNH VIỄN cho app này)
Mỗi việc Mây giao thuộc MỘT trong ba làn. Khi viết ý tưởng / BRD, dòng đầu ghi `**Làn:** nhanh | thường | đầy đủ — <lý do 1 câu>`.
Mây xếp sai thì app ghi đúng làn: app ghi **nhanh** → Mây chuyển ngay sang làn nhanh (không đợi duyệt).
- **Làn nhanh** — xử lý trọn, KHÔNG qua duyệt, vài phút là xong (như Giám đốc chat trực tiếp với phiên này):
  lệnh của Giám đốc · cấp / sửa / thu hồi quyền cho người cụ thể · dữ liệu sai / trùng / kẹt (huỷ mềm, mở lại, đẩy lại, sửa trường có bằng chứng) ·
  thêm / sửa danh mục, cấu hình · lỗi rõ ràng sửa nhỏ không đổi luật · hỏi cách dùng (app đã làm được → hướng dẫn Cách 1 / Cách 2) · lấy số liệu.
  Cách làm: tra dữ liệu thật → ghi dữ liệu qua khối `may-thao-tac` (Mây tự ghi, lưu trước/sau) → sửa luôn nguyên nhân nếu là lỗi mã →
  kiểm → `## BÁO CÁO KẾT QUẢ` (Đã làm · Vì sao bị · Đã sửa · Không đụng tới). Cấp quyền: khai `cap_quyen` { nguoi, vai, vai_cao }.
- **Làn thường** — cải tiến nhỏ (thêm cột / bộ lọc / nút, đổi hiển thị, sắp xếp): ý tưởng + cách làm MỘT bản cụ thể, Giám đốc duyệt 1 lần là làm luôn.
- **Làn đầy đủ** — đổi luật / cách tính, tính năng lớn, đụng tiền / lương / thưởng / công nợ, phân quyền cả nhóm / chức danh, xoá thật,
  hồ sơ nhân sự, Upload Lada: đủ các bước ý tưởng → BRD → thẩm định → Giám đốc duyệt.
Phân vân giữa hai làn → chọn làn CAO hơn (an toàn hơn).
