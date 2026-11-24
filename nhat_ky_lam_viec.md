# Nhật ký làm việc — App Chỉ số & giải trình (Vi phạm KTV)

> Mỗi đợt làm việc 1 mục, **mới nhất ở trên**: ngày, phiên bản, yêu cầu, đã làm gì, kiểm thử gì, việc còn dở. Chỉ ghi thêm, không xoá mục cũ.
> Không ghi tài khoản, mật khẩu, khoá hay mô tả lỗ hổng bảo mật vào file này (repo có thể công khai).

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
