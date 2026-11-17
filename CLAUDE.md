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
