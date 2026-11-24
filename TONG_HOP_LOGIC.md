# Tổng hợp logic — App "Chỉ số & giải trình" (Vi phạm KTV)

> Mô tả logic **đang chạy thật** (theo code tới 17/11/2026). Logic đổi thì sửa đè đúng mục, không ghi lịch sử ở đây
> (lịch sử nằm ở `nhat_ky_lam_viec.md`). Không ghi tài khoản, mật khẩu, khoá.

## 1. Hệ thống là gì

- Ứng dụng web PWA giúp **KTV hiện trường tự giải trình** khi bị CSKH nghi ngờ vi phạm SLA; Admin / QC theo dõi và chốt.
- Kiến trúc: 1 Cloudflare Worker `vipham` (Hono) phục vụ cả API lẫn giao diện React build tĩnh; D1 là database duy nhất.
- Đăng nhập Google OAuth (dùng chung OAuth Client với app Đặt hàng linh kiện, redirect riêng). Ảnh giải trình lưu Google Drive
  (Admin kết nối Drive 1 lần ở Cài đặt).

## 2. Nguồn dữ liệu & kết nối hệ khác

| Hướng | Điểm nối | Nội dung |
|---|---|---|
| DVBH → app | `POST /api/nhan-vi-pham` | DVBH đẩy sự kiện vi phạm (cùng 1 endpoint, phân biệt `loai_su_kien`): `nghi_ngo_moi` = tạo vi phạm mới; `cap_nhat` + `nguon_cap_nhat` (vd `qc_chot_cap_2`) = QC chốt / bỏ vi phạm. Đặc tả: `PARTNER_API_GUIDE.md` mục 9. |
| App → DVBH | gửi giải trình | Giải trình KTV nộp được đẩy ngược về DVBH; lỗi mạng thì **cron mỗi giờ** (`0 * * * *`) gửi lại các giải trình chưa đồng bộ. |
| App Đặt hàng linh kiện → app | `POST /api/partner/sync/ktv` | Danh bạ KTV (mã KTV, email đăng nhập, khu vực) do app linh kiện **chủ động đẩy mỗi giờ**; app này chỉ đọc (cache). |
| App → DVBH | tra cứu case | Chi tiết vi phạm mở popup "Thông tin case (DVBH)": tự lấy lần đầu, nút "🔄 Đồng bộ" lấy lại; giới hạn 1 lần / 5 phút / case và 5 giây giữa 2 case khác nhau. |
| App → DVBH | thống kê KTV | "Báo cáo nhanh" đọc số liệu công việc từ DVBH qua bảng cache `thong_ke_dvbh_cache` (làm mới tối đa 1 lần/giờ). |

## 3. Vòng đời 1 vi phạm

1. **Nghi ngờ mới** (từ DVBH): tạo dòng vi phạm, cố gắng **khớp KTV** theo tên / mã trong danh bạ.
   - Khớp được → gán KTV, gửi thông báo trong app + Web Push.
   - Không khớp → vào hàng đợi **"Chưa xác định KTV"** cho Admin gán tay hoặc bỏ qua (`/api/admin/vi-pham/...`).
2. **KTV giải trình**: viết lý do + đính kèm tối đa **5 ảnh** (lưu Drive) → nộp 1 lần; giải trình gửi về DVBH.
3. **CSKH kết luận cấp 1** (`ket_qua_cap_1`: vd "Lỗi không liên hệ được", "Lỗi sai báo cáo"…) — danh mục có mô tả, Admin quản lý.
4. **QC chốt cấp 2** (từ DVBH): **xác nhận vi phạm** hoặc **bỏ (không tính)** → chi tiết hiện banner kết quả QC (đỏ / xanh) kèm người + giờ chốt.
- Loại lỗi nghi ngờ ban đầu (`loai_loi`) có mô tả chi tiết; KTV bấm (?) để đọc. Danh mục do Admin quản lý.

## 4. Vai trò & phạm vi xem

| Vai trò | Lấy từ | Xem / làm được |
|---|---|---|
| KTV | email khớp danh bạ KTV (tự kích hoạt) hoặc Admin duyệt; KTV có thể tự khai mã KTV | Chỉ vi phạm + thông báo của chính mình; nộp giải trình |
| Giám sát (GS khu vực) | `users.vai_tro_xem='Giam sat'` + bảng `user_khu_vuc` | **Chỉ xem** vi phạm của KTV thuộc các khu vực được gán |
| View | `vai_tro_xem='View'` | **Chỉ xem** toàn bộ |
| Admin | `users.vai_tro='Admin'` | Duyệt / từ chối / khoá tài khoản, gán KTV cho vi phạm chưa xác định, danh mục loại lỗi + kết luận cấp 1, thông báo công ty, kết nối Drive, xem toàn đội hoặc chọn 1 KTV |

- Tài khoản mới không khớp danh bạ → "Chờ duyệt"; bị từ chối / khoá thì không vào được (màn đăng nhập hiện đúng trạng thái).
- Vai trò hiệu lực = `COALESCE(vai_tro, vai_tro_xem)` — mỗi tài khoản chỉ 1 vai trò.

## 5. Thông báo

- Thông báo vi phạm cho KTV: trong app (chưa đọc / đã đọc, đánh dấu tất cả) + Web Push (VAPID) tới thiết bị đã đăng ký.
- **Thông báo công ty**: Admin soạn, chọn đích danh người nhận, xem danh sách đã đọc / chưa đọc.

## 6. Báo cáo nhanh

- KTV xem số liệu của mình; Admin xem toàn đội hoặc chọn 1 KTV.
- Gồm số liệu vi phạm (chưa giải trình, giải trình trong 48h, chờ chốt lỗi…), số liệu công việc từ DVBH, tỷ lệ nghi ngờ.

## 7. Lịch chạy tự động

| Lịch | Việc |
|---|---|
| Mỗi giờ (`0 * * * *`) | Gửi lại giải trình chưa đồng bộ được về DVBH |
| Mỗi giờ (do app linh kiện gọi sang) | Nhận danh bạ KTV |

## 8. Tài liệu liên quan

`UI_SPEC.md` (đặc tả giao diện chi tiết), `PARTNER_API_GUIDE.md` (API với DVBH), `DE_XUAT_API_THONG_KE_DVBH.md`, `DEPLOY.md`,
`SRS_tong_hop.md`, `nhat_ky_lam_viec.md`.

## Cửa sổ thông tin eOffice (popup Giám đốc)

`GET /api/cua-so` (không cần đăng nhập) → Worker gọi `csApi` eOffice bằng secret `CUA_SO_KHOA`, đệm 60 giây, kèm tranh SVG. Frontend `CuaSoThongTin` hiện mỗi lần mở app (và khi quay lại sau ≥ 10 phút ẩn), nút "Vào app" khoá theo `khoaNutGiay`. Lỗi / chậm / chưa có khoá → không hiện, vào app bình thường. Cùng 1 bộ mã ở mọi app hệ DVBH (bản gốc ở linh-kien-app).
