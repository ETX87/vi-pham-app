# Nhật ký làm việc — App Chỉ số & giải trình (Vi phạm KTV)

> Mỗi đợt làm việc 1 mục, **mới nhất ở trên**: ngày, phiên bản, yêu cầu, đã làm gì, kiểm thử gì, việc còn dở. Chỉ ghi thêm, không xoá mục cũ.
> Không ghi tài khoản, mật khẩu, khoá hay mô tả lỗ hổng bảo mật vào file này (repo có thể công khai).

## 27/11/2026 — Sửa lỗi KTV không tải được ảnh bằng chứng

**Yêu cầu (nguyên văn):** "các ktv báo lỗi không thể up ảnh lên" (kèm ảnh chụp lỗi "Decryption failed … AES-GCM").

**Nguyên nhân:** 26/11/2026 10:26 (giờ VN) secret của Worker bị thay → khoá giải mã token Google Drive (suy ra từ `SESSION_SECRET`) đổi → token đã lưu không giải mã được, mọi lần tải ảnh đều lỗi. Ảnh tải được lần cuối 25/11 14:52; từ 26/11 tới lúc sửa có 28 giải trình gửi không kèm ảnh. Đồng thời màn Quản trị giấu nút "Kết nối Google Drive" khi đã có kết nối nên Admin không tự kết nối lại được.

**Đã sửa:** `GET /settings/google-drive/status` thử giải mã, trả `hong`; màn Quản trị báo đỏ "Kết nối Google Drive đã HỎNG" và luôn có nút "Kết nối lại Google Drive"; lỗi giải mã / Google thu hồi quyền → KTV thấy câu tiếng Việt "báo Admin kết nối lại" thay cho lỗi kỹ thuật; route tải ảnh ghi log lỗi để tra bằng `wrangler tail`.

**Còn phải làm (người):** Admin đăng nhập → Quản trị → "Kết nối lại Google Drive" bằng tài khoản Google chủ kho ảnh. Sau đó KTV thử lại. 28 giải trình đã gửi không ảnh không tự bổ sung được — KTV cần gửi ảnh cho Giám sát nếu cần.

## 27/11/2026 — Tài liệu hướng dẫn KTV dạng HTML + tab Hướng dẫn

**Yêu cầu (nguyên văn):** "tạo tài liệu hướng dẫn sử dụng cho KTV chi tiết trên giao diện html rồi đẩy lên tab hướng dẫn cho ktv".

**Đã làm:**
- `frontend/public/huong-dan-ktv/index.html` + 10 ảnh `img/` chụp từ app chạy máy (vai KTV, dữ liệu mẫu, email trên ảnh là email mẫu). Nội dung theo 5W1H: đăng nhập & cài đặt, luồng 1 vi phạm (luồng ngang), trạng thái, chi tiết, nộp giải trình + ảnh (bước, lỗi thường gặp), sau khi nộp / kết quả QC, báo cáo nhanh, thông báo, tài khoản, hỏi đáp, liên hệ. Bấm ảnh xem to.
- `HuongDanScreen.tsx`: nhúng trang trên (iframe). Desktop: tab "Hướng dẫn" trên topbar; điện thoại: Tài khoản → "Hướng dẫn sử dụng" (thay hộp 4 dòng cũ), có nút "Mở trang riêng".
- Sửa thêm: nút "Gửi giải trình" khoá trong lúc ảnh đang tải (trước đây bấm gửi được → ảnh chưa tải xong bị mất khỏi giải trình).

**Kiểm thử:** build + typecheck 0 lỗi; xem trên dev (khổ điện thoại và máy tính): tab mở đúng trang, 10 ảnh tải đủ.

**Ghi chú:** file Word cũ `Huong_dan_su_dung_app_vipham_KTV.docx` (chưa commit, ảnh tháng 9) không dùng nữa — giữ nguyên, không đụng.

## 27/11/2026 — Rà soát đính kèm ảnh bằng chứng khi KTV giải trình (tối đa 5 ảnh)

**Yêu cầu (nguyên văn):** "kiểm tra lại phân giải trình của ktv đã cho up ảnh bằng chứng, tối đa 5 ảnh".

**Hiện trạng:** đã có sẵn — màn "Tạo giải trình" cho chọn / chụp / kéo-thả ảnh, tải lên Drive, giới hạn 5 ảnh ở app, Worker (`POST /giai-trinh`) và khi gửi DVBH.

**Đã vá:** (1) kéo-thả thêm ảnh trong lúc đang tải có thể vượt 5 ảnh (ảnh thứ 6+ bị cắt âm thầm khi nộp) → chặn tải chồng; (2) chọn quá số ảnh còn lại thì báo rõ số ảnh bị bỏ; (3) giới hạn 10 MB/ảnh + Worker `POST /vi-pham/:id/anh` chỉ nhận `image/*` (415) và ≤ 10 MB (413); nhãn ô đính kèm ghi rõ giới hạn.

**Kiểm thử:** build frontend + typecheck backend 0 lỗi.

## 27/11/2026 — Khớp KTV theo mã KTV (sửa lỗi vi phạm không tới tay KTV)

**Yêu cầu (nguyên văn):** "trên dvbh có nhiều ca cần ktv giải trình nhưng trên app ktv lại không hiện ca cần giải trình là sao" → "gắn lại rồi sửa logic để bắt theo id ktv".

**Nguyên nhân:** từ 17/11/2026 tên KTV DVBH gửi sang có thêm đuôi ` - NS-xxxx` (vd `(phongld.mn1) CTV Tiền Giang - Lê Đăng Phong - NS-3296`), trong khi danh bạ không có đuôi → so nguyên chuỗi tên trượt → 94 vi phạm (17–26/11) nằm ở "Chưa xác định KTV", KTV không thấy.

**Đã làm:** `routes/nhanViPham.ts` — khớp KTV ưu tiên mã trong ngoặc, dự phòng so tên đã bỏ đuôi NS; thêm `ganLaiViPhamChuaXacDinh()` chạy trong cron mỗi đầu giờ (`index.ts`) để gán bù hàng đợi và báo KTV (chỉ vi phạm QC chưa chốt).

**Kiểm thử:** typecheck + build 0 lỗi; trước khi sửa đã đối chiếu trên DB thật: cả 94 vi phạm đều khớp đúng 1 KTV theo mã. Sau deploy kiểm lại hàng đợi sau lượt cron đầu tiên.

## 24/11/2026 — Cửa sổ thông tin eOffice (popup Giám đốc)

**Yêu cầu (nguyên văn):** "làm luôn cho toàn bộ hệ thống app dvbh: đặt lk, đổi trả, ông thợ, vi phạm, tiếp nhận..." (+ "thêm cả muahang", "cả ccdc") — tài liệu "API Cửa sổ thông tin — dành cho app ngoài (ETX87)".

**Đã làm:** chép nguyên bộ mã mẫu từ linh-kien-app v1.556: `backend/src/lib/cuaSoThongTin.ts` + `GET /api/cua-so` (không cần đăng nhập; Worker gọi `csApi` eOffice bằng secret `CUA_SO_KHOA`, đệm 60 giây, kèm tranh SVG) và `frontend/src/components/CuaSoThongTin.tsx` (gắn ở điểm render gốc, ngoài App → hiện cả màn đăng nhập, phủ trên mọi popup). Hiện mỗi lần mở app + khi quay lại sau ≥ 10 phút ẩn; nút "Vào app" khoá `khoaNutGiay` giây; Esc / Back chỉ đóng sau khi hết khoá. API lỗi / chậm / chưa đặt khoá → không hiện, vào app bình thường.

**Kiểm thử:** build 0 lỗi; sau deploy gọi `/api/cua-so` trên production trả đúng cửa sổ đang bật. Giao diện đã xem trên linh-kien-app (cùng 1 component).

**Còn dở:** đang dùng chung mã khoá với các app khác — nên xin mã riêng cho app này ở eOffice › Quản trị › Cửa sổ thông tin › Kết nối app ngoài rồi đặt lại secret `CUA_SO_KHOA`.

## 17/11/2026 — Tạo bộ tài liệu tổng hợp

- Yêu cầu: "dựa theo nguyên tắc tạo 3 file bắt buộc, rà soát toàn bộ các repo và tạo 3 file rồi đẩy lên repo etx87".
- Tạo `nhat_ky_lam_viec.md` (file này), `TONG_HOP_LOGIC.md`, `SRS_tong_hop.md`.
- Phần "Lịch sử dựng lại từ Git" bên dưới sinh tự động từ commit (bỏ commit gộp nhánh + commit tự động Workflow Mây). Từ nay ghi tay mục mới ở trên.

## Lịch sử dựng lại từ Git (37 commit, 2026-09-11 → 2026-11-17)

### 2026-11-17
- PARTNER_API_GUIDE: bo sung dinh dang ma case moi SCyyMMxxxxx cho tham so id (`7b9988f`)

### 2026-10-30
- Doi ten app thanh "Chi so & giai trinh" (`5813d30`)

### 2026-10-26
- Them 2 vai tro dang nhap: GS khu vuc va View (chi xem) (`6ba44fd`)
- Muc Vi pham: Admin chon KTV hoac xem toan doi (giong Bao cao nhanh), mo vi pham cua nguoi khac chi xem (`254dde6`)
- Bao cao nhanh cho Admin: xem toan doi hoac chon 1 KTV (truoc day Admin khong gan KTV nen toan so 0) (`e5ee7e9`)
- Bao cao nhanh: them so lieu cong viec tu DVBH, giai trinh va ty le nghi ngo (`530931e`)

### 2026-10-20
- Them thong bao cong ty: Admin soan + chon nguoi nhan, KTV xac nhan da doc (`86e4bd3`)

### 2026-09-28
- Hien KTV dang khop voi tung gmail dang nhap + nut mo sang linh-kien-app de gan lai (`1fe280d`)

### 2026-09-24
- Them tab 'Bao cao nhanh' cho KTV: chon thang, ty le loi da chot, 4 muc thong ke (`30ea227`)

### 2026-09-17
- Tim kiem vi pham theo ID chinh xac hon + toi uu dung luong icon PWA (`86540f6`)

### 2026-09-14
- Cho Admin bam vao card vi pham de xem chi tiet (read-only) nhu KTV (`e63f7a6`)
- Nhan them ghi_chu tu DVBH khi bao nghi ngo vi pham moi (`ca00227`)
- Them mo ta cho ket_qua_cap_1, doi ten nhan hien thi (`15c7d23`)
- Cho tu khai ma KTV luc cho duyet + quan ly tai khoan theo trang thai (`d13f8be`)
- Them muc Admin quan ly loai loi + mo ta, dau (?) tren card vi pham (`da20bca`)
- Them nut "Them vao man hinh chinh" (cai dat PWA) trong man Tai khoan (`ed8dd90`)
- Phan trang + nut Bo qua + gan hang loat cho hang doi Chua xac dinh KTV (`6075f6a`)
- Phan trang server-side cho danh sach vi pham, giam doc D1 (`4ec6fbe`)

### 2026-09-13
- Sort danh sach vi pham theo ngay ghi nhan loi (Z-A) thay vi thoi diem nhan (`605e352`)
- Mac dinh mo tab Chua doc khi vao man Thong bao (`3c433ce`)
- Them loc Da doc/Chua doc, nut danh dau tat ca, infinite scroll cho thong bao (`9fcf1b3`)
- Fix Back cua Android thoat luon app thay vi lui man hinh (`3d74674`)
- Hien case_id o goc tren ben phai card danh sach vi pham, in dam noi bat (`2886826`)
- Fix layout mobile: bottom tab bar bi lap canh man hinh, ten KH tran ra khoi card (`00f9b15`)
- Them log loi khi gui push that bai de chan doan (`f77b6ea`)
- Fix loi 500 khi GS giai trinh khong dien nguoi_giai_trinh (`233a284`)
- Them bo loc trang thai + phan trang cho man "Vi pham cua toi" (`52b8c43`)
- Fix loi thuc te tu phan hoi nguoi dung sau khi len san pham (`00cc823`)
- Fix crash popup case-lookup va vai loi hien thi/layout tren mobile (`a332089`)
- Doi mo hinh trang thai vi pham sang 4 muc (`9ca0dd9`)

### 2026-09-11
- Fix: giai trinh khong dong bo duoc ve DVBH vi loi 1042 (SSRF) (`8930f86`)
- Them man "Tat ca vi pham" cho Admin (`f6759f5`)
- Them badge so tren icon PWA (Badging API) (`172ae5e`)
- Initial commit: vi-pham-app (he giai trinh vi pham cho KTV) (`9915f17`)
