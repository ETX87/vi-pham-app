# SRS tổng hợp — App "Chỉ số & giải trình" (Vi phạm KTV)

> Đặc tả yêu cầu **đã chốt** (theo code + `UI_SPEC.md` tới 17/11/2026). Đặc tả giao diện từng màn chi tiết xem `UI_SPEC.md`;
> logic xử lý xem `TONG_HOP_LOGIC.md`.

## 1. Mục tiêu

Cho KTV hiện trường nhận thông báo khi bị nghi ngờ vi phạm SLA, tự xem thông tin case và **giải trình có bằng chứng**; cho
quản lý (Admin, GS khu vực, View) theo dõi tình trạng giải trình và kết quả QC.

## 2. Người dùng

| Vai trò | Nhu cầu chính |
|---|---|
| KTV | Xem vi phạm của mình, đọc mô tả lỗi, xem case gốc, nộp giải trình (lý do + ≤ 5 ảnh), nhận thông báo |
| GS khu vực | Theo dõi (chỉ xem) vi phạm của KTV trong khu vực được gán |
| View | Theo dõi (chỉ xem) toàn bộ |
| Admin | Quản trị tài khoản, gán KTV cho vi phạm chưa xác định, quản lý danh mục, thông báo công ty, kết nối Drive |

## 3. Chức năng

| # | Chức năng | Người dùng | Yêu cầu |
|---|---|---|---|
| F1 | Đăng nhập Google | Tất cả | 4 trạng thái: đăng nhập / chờ duyệt / bị từ chối / bị khoá. KTV khớp danh bạ tự vào được. |
| F2 | Danh sách "Vi phạm của tôi" | KTV (GS/View/Admin theo phạm vi) | Lọc theo trạng thái (chưa giải trình, chờ chốt lỗi…), hiện loại lỗi, ngày ghi nhận, trạng thái QC. |
| F3 | Chi tiết vi phạm | Như F2 | Banner kết quả QC (nếu đã chốt); thông tin cơ bản; mã case bấm mở popup "Thông tin case (DVBH)" (tự lấy, có nút đồng bộ, giới hạn tần suất); ảnh báo cáo công việc; lịch sử giải trình chậm trễ của case. |
| F4 | Nộp giải trình | KTV | Lý do bắt buộc + tối đa 5 ảnh, mỗi ảnh ≤ 10 MB, chỉ nhận file ảnh (lưu Drive); nộp xong gửi về DVBH (tự gửi lại nếu lỗi). |
| F5 | Thông báo | Tất cả | Danh sách thông báo vi phạm + thông báo công ty, đánh dấu đã đọc / tất cả; Web Push. |
| F6 | Báo cáo nhanh | KTV (của mình), Admin (toàn đội / 1 KTV) | Số liệu vi phạm + công việc từ DVBH + tỷ lệ nghi ngờ. |
| F7 | Quản trị tài khoản | Admin | Duyệt / từ chối / khoá; đặt vai trò Admin / GS khu vực (+ khu vực) / View. |
| F8 | Vi phạm chưa xác định KTV | Admin | Gán KTV tay hoặc bỏ qua. |
| F9 | Danh mục loại lỗi + kết luận cấp 1 | Admin (sửa), mọi người (xem mô tả) | Thêm / sửa / xoá, có mô tả hiện cho KTV. |
| F10 | Thông báo công ty | Admin | Soạn, chọn người nhận, xem đã đọc / chưa đọc. |
| F11 | Cài đặt | Admin | Kết nối Google Drive, xem tình trạng danh bạ KTV đồng bộ. |

## 4. Giao diện

- PWA, tiếng Việt. Desktop (≥ 768px): thanh điều hướng ngang trên đầu. Mobile: thanh tab cố định đáy (≤ 5 nút).
- Chi tiết màn hình, trạng thái tải / lỗi, quy tắc hiển thị: `UI_SPEC.md`.

## 5. Yêu cầu phi chức năng

- Dữ liệu vi phạm đến từ DVBH; app không tự tạo vi phạm.
- Danh bạ KTV chỉ đọc, do app Đặt hàng linh kiện đồng bộ mỗi giờ.
- Gọi sang DVBH có giới hạn tần suất (tránh quá tải hệ gốc).
- Mọi thời gian lưu và hiển thị theo giờ Việt Nam.
