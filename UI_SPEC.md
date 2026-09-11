# Đặc tả giao diện — "Giải trình vi phạm" (3T)

Tài liệu mô tả toàn bộ màn hình, nội dung, trạng thái và hành vi của ứng dụng web (PWA, dùng được cả
desktop lẫn mobile) hiện đã có bản UI chức năng (tối giản, chưa đầu tư thiết kế) — dùng tài liệu này
làm đầu vào để thiết kế lại giao diện đẹp/chuyên nghiệp hơn, **giữ nguyên nội dung/luồng nghiệp vụ**,
không cần giữ nguyên cách trình bày hiện tại.

## 0. Bối cảnh & người dùng

- Đối tượng dùng chính: **KTV** (kỹ thuật viên hiện trường) — nhận thông báo khi bị nghi ngờ vi phạm
  SLA, vào xem thông tin case và **tự giải trình** (viết lý do + đính kèm tối đa 5 ảnh).
- Vai trò phụ: **Admin** — kết nối Google Drive (nơi lưu ảnh giải trình), xử lý các vi phạm hệ thống
  chưa tự xác định được đúng KTV để gán tay.
- Ứng dụng dạng PWA (cài được lên màn hình chính điện thoại), có Web Push notification.
- Đăng nhập bằng Google OAuth (dùng chung tài khoản Google với hệ "linh-kien-app" cùng công ty).
- 2 chế độ hiển thị bắt buộc:
  - **Desktop/web** (≥768px): thanh điều hướng nằm NGANG trên đầu (top bar).
  - **Mobile** (<768px): thanh điều hướng dạng **bottom tab bar cố định đáy màn hình, tối đa 5 nút**.
- Ngôn ngữ: tiếng Việt 100%. Không có chế độ tối (dark mode) hiện tại — có thể bổ sung nếu muốn.

### Bảng màu thương hiệu tham khảo (không bắt buộc giữ nguyên)

| Token | Giá trị | Dùng cho |
|---|---|---|
| Brand chính | `#7a1f1f` (đỏ đô) | Header, nút chính, tab active |
| Brand đậm | `#4a1414` | Gradient nền màn đăng nhập |
| Nền trang | `#f7f4f1` (be nhạt) | Background |
| Thẻ/card | `#ffffff` | Nền card |
| Chữ chính | `#1a1a1a` | Text |
| Chữ phụ | `#55524f` / `#8a8683` | Label, meta |
| Thành công | `#2f7d4f` (xanh) | Tag "đã xong", alert success |
| Cảnh báo/chờ | `#b7791f` (vàng) | Tag "đang chờ", alert info |
| Lỗi/cần xử lý | `#b3312c` (đỏ) | Badge, tag "chưa xử lý", alert error |

Logo: icon vuông bo góc, chữ "3T", nền đỏ đô — dùng cho favicon/app icon/PWA install.

---

## 1. Màn hình Đăng nhập

**Khi nào hiện**: chưa đăng nhập, hoặc tài khoản ở trạng thái không được vào thẳng app. Có **4 biến
thể nội dung** dùng chung 1 layout (card giữa màn hình, nền gradient đỏ đô):

| Biến thể | Tiêu đề | Mô tả phụ | Có nút hành động? |
|---|---|---|---|
| `login` (mặc định) | "Giải trình vi phạm" | "Hệ thống giải trình vi phạm cho KTV - Dịch Vụ 3T" | Có — nút "Đăng nhập bằng Google" (logo Google 4 màu) |
| `pending` | "Đang chờ duyệt" | "Tài khoản của bạn đã được ghi nhận, vui lòng chờ Admin phê duyệt." | Không |
| `rejected` | "Tài khoản bị từ chối" | "Liên hệ Admin nếu bạn cho rằng đây là nhầm lẫn." | Không |
| `disabled` | "Tài khoản đã bị khóa" | "Liên hệ Admin để được mở khóa lại." | Không |

Nội dung card (biến thể `login`):
- Icon app (logo vuông bo góc) phía trên tiêu đề.
- Tiêu đề + mô tả phụ.
- Nút "Đăng nhập bằng Google" (icon Google + text), full-width.
- Ghi chú nhỏ bên dưới: "Chỉ tài khoản KTV hợp lệ hoặc đã được Admin phê duyệt mới truy cập được."
- (Chỉ môi trường phát triển) 1 nút phụ "🔧 Đăng nhập DEV" — **KHÔNG cần thiết kế cho bản chính
  thức**, chỉ tồn tại lúc code local.

---

## 2. Khung điều hướng chính (áp dụng cho mọi màn hình sau khi đăng nhập)

### 2.1. Web/Desktop — Top bar

Thanh ngang cố định trên cùng, chia 3 vùng:
1. **Trái**: icon app (24px) + tên app "Giải trình vi phạm".
2. **Giữa**: các tab điều hướng dạng nút bo góc, tab đang chọn có nền trắng nổi bật:
   - "Vi phạm của tôi" — kèm **badge số đỏ** = số vi phạm đang chờ xử lý (chỉ hiện khi >0).
   - "Thông báo" — kèm **badge số đỏ** = số thông báo chưa đọc (chỉ hiện khi >0).
   - "Quản trị" — **chỉ hiện với tài khoản Admin**.
3. **Phải**: 
   - Nút bật/tắt thông báo đẩy: "🔔 Đã bật thông báo" hoặc "🔕 Bật thông báo đẩy" (chỉ hiện nếu
     trình duyệt hỗ trợ Web Push).
   - Tên hiển thị (hoặc email nếu chưa có tên) của người đang đăng nhập.
   - Link "Đăng xuất".

### 2.2. Mobile — Bottom tab bar

Thanh cố định **đáy màn hình**, layout icon-trên + label-dưới, **tối đa 5 nút** (hiện tại dùng 4, còn
dư 1 chỗ để mở rộng sau này):

| Icon (gợi ý) | Nhãn | Badge | Hiện khi nào |
|---|---|---|---|
| 📋 | Vi phạm | Số vi phạm chưa xử lý | Luôn hiện |
| 🔔 | Thông báo | Số thông báo chưa đọc | Luôn hiện |
| ⚙️ | Quản trị | — | Chỉ Admin |
| 👤 | Tài khoản | — | Luôn hiện |

Trên mobile, top bar được rút gọn: **chỉ còn icon + tên app** (ẩn hết tabs/thông tin user — các
chức năng đó chuyển hết vào tab "Tài khoản" hoặc màn tương ứng).

---

## 3. Màn hình "Vi phạm của tôi" (danh sách)

**Mục đích**: KTV xem toàn bộ vi phạm được gán cho mình, chọn 1 để xem chi tiết/giải trình.

**Trạng thái tải**:
- Đang tải: text "Đang tải...".
- Lỗi: banner đỏ "Không tải được danh sách vi phạm.".
- Rỗng (0 vi phạm): "Bạn chưa có vi phạm nào cần giải trình. 🎉".

**Nội dung khi có dữ liệu**:
- Tiêu đề mục: "Vi phạm cần xử lý" + **badge số** (chỉ đếm những vi phạm **chưa giải trình VÀ chưa
  bị QC "bỏ"** — không đếm cái đã xong hoặc đã bị QC loại).
- Danh sách card, mỗi card = 1 vi phạm, **bấm vào mở màn Chi tiết**. Mỗi card gồm:
  - Dòng tiêu đề: **loại lỗi** (vd "Lỗi 120 phút", "Hẹn quá 24h", "Lỗi lỡ kế hoạch", "KH hẹn lại")
    + các thẻ (tag) trạng thái, có thể xuất hiện đồng thời:
    - "Đã giải trình" (xanh) hoặc "Chưa giải trình" (đỏ nhạt) — luôn có 1 trong 2.
    - "QC xác nhận vi phạm" — chỉ khi QC đã chốt là CÓ vi phạm.
    - "QC đã bỏ" (xanh) — chỉ khi QC đã kết luận KHÔNG tính vi phạm.
  - Dòng meta (các mục cách nhau, xuống dòng tự động nếu chật): mã Case, tên khách hàng, khu vực,
    thời điểm ghi nhận.

---

## 4. Màn hình Chi tiết 1 vi phạm

**Mục đích**: xem đầy đủ thông tin 1 vi phạm + thông tin case gốc (kéo từ hệ CRM/DVBH), và nộp giải
trình (nếu chưa nộp).

**Header**: nút quay lại (←) + tiêu đề = loại lỗi.

**Trạng thái tải/lỗi**: "Đang tải..." / banner đỏ nếu lỗi hoặc không có dữ liệu.

**4.1. Banner kết quả QC** (chỉ hiện nếu QC đã ra quyết định — ẩn hoàn toàn nếu chưa):
- Nếu QC xác nhận vi phạm: banner màu đỏ/cảnh báo — "QC đã XÁC NHẬN đây là vi phạm — <email QC>,
  lúc <ngày giờ chốt>".
- Nếu QC bỏ qua: banner màu xanh/thành công — "QC đã BỎ (không tính vi phạm) — <email QC>, lúc
  <ngày giờ chốt>".

**4.2. Thẻ thông tin cơ bản** (dạng lưới nhãn/giá trị 2 cột, ẩn từng ô nếu rỗng):
- **Case** (mã case bảo hành) — **hiển thị dạng link/nút bấm được** (gạch chân, màu brand), bấm vào
  mở **popup** mục 4.3 bên dưới. Đây là cách duy nhất để xem thông tin case gốc — không hiện sẵn
  ngay trên trang, giữ trang chi tiết gọn.
- Kết luận cấp 1 (kết luận ban đầu của CSKH — vd "Lỗi không liên hệ được", "Lỗi sai báo cáo", "Lỗi
  khác")
- Khách hàng
- Khu vực
- Seri sản phẩm
- Ngày ghi nhận (luôn hiện, không bao giờ rỗng)

**4.3. Popup "Thông tin case (DVBH)"** — mở khi bấm vào mã Case ở mục 4.2 (chỉ tồn tại nếu vi phạm
có gắn mã case). Dạng modal/popup nổi giữa màn hình, nền phía sau làm mờ, có nút đóng "✕" góc trên
phải popup, bấm ra ngoài vùng popup cũng đóng được. Đây là dữ liệu **tự động lấy về** từ hệ CRM gốc
ngay lần đầu popup mở ra (không cần bấm gì thêm), có nút đồng bộ lại thủ công bên trong:

- Header trong popup: tiêu đề "Thông tin case (DVBH)" + nút nhỏ "🔄 Đồng bộ" (góc phải).
- Dòng nhỏ: "Đã đồng bộ lúc: <ngày giờ>" (chỉ hiện sau khi có dữ liệu ít nhất 1 lần).
- Vùng thông báo (khi có): 
  - Màu vàng/info — thông báo giới hạn tần suất, 2 kiểu nội dung:
    - "Case này vừa được đồng bộ gần đây - vui lòng chờ khoảng N phút rồi thử lại." (nếu vừa đồng bộ
      case NÀY trong vòng 5 phút gần nhất)
    - "Bạn đang gọi thông tin quá nhanh, vui lòng chờ Ns rồi thử lại." (nếu vừa đồng bộ MỘT case
      KHÁC trong vòng 5 giây gần nhất)
  - Nếu lỗi kết nối: "Không thể lấy thông tin case từ DVBH lúc này - vui lòng thử lại sau."
- Nếu chưa có dữ liệu / không tìm thấy case: "Chưa có dữ liệu." hoặc "Không tìm thấy case này bên
  DVBH."
- Khi có dữ liệu — hiển thị dạng lưới nhãn/giá trị (ẩn ô nào rỗng), gồm các nhóm nội dung sau (thứ
  tự gợi ý, có thể nhóm lại theo khối cho đẹp hơn):
  - **KTV & khách hàng**: KTV phụ trách, Khách hàng, Seri sản phẩm, Khu vực, Tỉnh/thành, Quận/huyện
  - **Sản phẩm & yêu cầu**: Hãng, Sản phẩm bảo hành, Nhóm sản phẩm, Mô tả lỗi, Nhóm yêu cầu, Loại
    yêu cầu, Hình thức bảo hành, Ngày mua
  - **Tiến độ xử lý**: Tiến độ hoàn thành, CSKH tiếp nhận (thời điểm), Hẹn xử lý (thời điểm), Hoàn
    thành (thời điểm), Lý do quá hạn, Đúng/trễ hạn, Nhóm xử lý 24h, Lý do hủy case, Ngày import (vào
    hệ DVBH), Cập nhật gần nhất
  - **Nghiệp vụ/tổ chức**: Đối tác, Ngành hàng, Loại ngành hàng, Nhóm khách hàng, Cách thức xử lý
  - **Định giá** (đơn vị VND, format có dấu phân cách nghìn + "đ"): Định giá sản phẩm, Định giá
    linh kiện, Định giá dịch vụ
  - Đoạn văn bản dài (không phải lưới, hiển thị full-width): "Nội dung xử lý", "Lưu ý lỗi linh
    kiện"
  - **Ảnh báo cáo công việc** (do chính KTV đã upload lúc xử lý case, khác với ảnh giải trình vi
    phạm) — dạng lưới thumbnail vuông, bấm vào mở ảnh gốc tab mới. Ẩn cả khối nếu rỗng.
  - Link "Xem case trên CRM ↗" (mở tab mới) — chỉ hiện nếu có link.
  - **Lịch sử giải trình chậm trễ của case này** (khác với giải trình vi phạm — đây là lịch sử các
    lần case bị trễ tiến độ trước đây) — danh sách card nhỏ, mỗi card: lý do chậm + ngày giải trình
    + nội dung. Ẩn cả khối nếu rỗng.

**4.4. Khu vực giải trình** — 2 trạng thái loại trừ nhau:

**A) Đã có giải trình** (hiển thị, không cho sửa):
- Tiêu đề "Giải trình đã nộp".
- 1 card / lần giải trình (thường chỉ 1, nhưng có thể nhiều nếu giải trình lại), mỗi card:
  - Dòng meta: "Ngày giải trình: <ngày>" + 1 tag trạng thái:
    - "Giám sát nhập thay (trên DVBH)" — nếu KTV không tự nộp qua app này mà Giám sát đã nhập thay
      trực tiếp bên hệ DVBH.
    - "Đã đồng bộ về DVBH" (xanh) — nếu KTV tự nộp qua app này và đã gửi thành công về DVBH.
    - "Đang chờ đồng bộ" (vàng) — nếu KTV tự nộp nhưng hệ thống chưa gửi thành công về DVBH được
      (sẽ tự thử lại nền, không cần người dùng làm gì).
  - Nội dung giải trình (đoạn văn bản).
  - Ghi chú thêm (nếu có).
  - Ảnh bằng chứng — lưới thumbnail, bấm mở ảnh gốc.

**B) Chưa có giải trình** (form nhập liệu):
- Tiêu đề "Nộp giải trình".
- Banner kết quả sau khi bấm gửi (nếu có): xanh "Đã lưu và gửi kết quả về DVBH thành công." / vàng
  "Đã lưu giải trình - đang chờ đồng bộ về DVBH (hệ thống sẽ tự thử lại)." / đỏ "Không thể lưu giải
  trình - vui lòng thử lại.".
- Ô nhập "Nội dung giải trình" (textarea nhiều dòng, placeholder "Trình bày lý do...").
- Ô nhập "Ghi chú thêm (không bắt buộc)" (textarea).
- Khu vực "Ảnh bằng chứng (tối đa 5)": lưới ô ảnh đã chọn (có nút ✕ xoá từng ảnh) + 1 ô "+" để thêm
  ảnh mới (mở camera/thư viện ảnh trên mobile), disable khi đã đủ 5 ảnh hoặc đang tải lên.
- Nút "Gửi giải trình" (disable nếu chưa nhập nội dung VÀ chưa có ảnh nào, hoặc đang gửi — text đổi
  thành "Đang gửi...").

---

## 5. Màn hình Thông báo

**Mục đích**: xem lịch sử các thông báo hệ thống đã gửi cho mình (vi phạm mới cần giải trình, QC đã
chốt kết quả, Giám sát đã giải trình thay).

**Trạng thái**: "Đang tải..." / rỗng: "Chưa có thông báo nào."

**Nội dung**:
- Tiêu đề "Thông báo" + badge số chưa đọc.
- Danh sách card, mỗi thông báo:
  - Chấm tròn nhỏ màu brand ở đầu dòng **nếu chưa đọc** (ẩn nếu đã đọc).
  - Nội dung thông báo (câu hoàn chỉnh, ví dụ: "Bạn có 1 vi phạm cần giải trình: Lỗi 120 phút (case
    CASE-2026-00123)", "QC đã XÁC NHẬN là vi phạm: ...", "Giám sát đã nhập giải trình thay bạn: ...").
  - Thời điểm tạo thông báo.
  - Bấm vào 1 thông báo: đánh dấu đã đọc + **điều hướng sang màn Chi tiết vi phạm liên quan**.

---

## 6. Màn hình Tài khoản (chỉ hiện trên mobile — desktop các mục này nằm sẵn ở top bar)

**Mục đích**: xem thông tin tài khoản, bật/tắt thông báo đẩy, đăng xuất — gộp các chức năng vốn nằm
ở góc phải top bar desktop vào 1 màn hình riêng cho mobile.

**Nội dung**:
- Tiêu đề "Tài khoản".
- Card thông tin cá nhân: tên hiển thị (hoặc email nếu chưa có tên), email, vai trò (nếu có, vd
  "Admin").
- Card "Thông báo đẩy" (chỉ hiện nếu thiết bị hỗ trợ):
  - Mô tả trạng thái hiện tại: "Đã bật - thiết bị này sẽ nhận thông báo khi có vi phạm mới." hoặc
    "Chưa bật - bật để không bỏ lỡ vi phạm cần giải trình."
  - Nút bật/tắt: "🔔 Tắt thông báo đẩy" / "🔕 Bật thông báo đẩy".
- Nút "Đăng xuất" (đưa về màn đăng nhập).

---

## 7. Màn hình Quản trị (chỉ Admin)

**Mục đích**: 2 việc vận hành bắt buộc phải có — kết nối nơi lưu ảnh giải trình, và xử lý các vi
phạm hệ thống chưa tự xác định được đúng KTV để gán tay.

**7.1. Khối "Kết nối Google Drive"**:
- Đang tải: "Đang tải...".
- Đã kết nối: banner xanh "Đã kết nối: <email Google>" + dòng nhỏ "Kết nối bởi <người> lúc <thời
  điểm>".
- Chưa kết nối: banner vàng "Chưa kết nối Google Drive - ảnh bằng chứng giải trình sẽ không tải lên
  được." + nút "Kết nối Google Drive" (chuyển hướng sang luồng cấp quyền Google).

**7.2. Khối "Danh bạ KTV (linh-kien-app tự đẩy sang mỗi giờ)"**:
- Hiển thị: "Số lượng KTV: <n>" và "Cập nhật gần nhất: <thời điểm hoặc 'chưa từng'>".
- Nếu số lượng = 0: banner cảnh báo nhắc kiểm tra cấu hình đồng bộ giữa 2 hệ thống (nội dung kỹ
  thuật, chủ yếu dành người vận hành).
- **Không có** nút "đồng bộ ngay" — chiều đồng bộ là hệ khác chủ động đẩy sang, màn này chỉ đọc.

**7.3. Khối "Chưa xác định KTV"** — hàng đợi các vi phạm hệ thống nhận từ DVBH nhưng **khớp tên KTV
thất bại** (0 hoặc >1 người trùng tên), cần Admin gán tay:
- Tiêu đề + badge số lượng đang chờ.
- Rỗng: "Không có vi phạm nào đang chờ gán KTV."
- Mỗi vi phạm: card gồm loại lỗi, mã Case (nếu có), "Tên KTV (thô từ DVBH): <tên>" (hoặc "(trống)"),
  thời điểm ghi nhận + 1 dropdown chọn đúng KTV (danh sách "Tên hiển thị (mã KTV)") + nút "Gán".
  Sau khi gán thành công, card biến mất khỏi danh sách.

---

## 8. Quy tắc hiển thị chung cần giữ khi thiết kế lại

1. **Badge số đỏ** dùng nhất quán cho mọi nơi đếm số lượng "cần chú ý" (menu điều hướng, tiêu đề
   mục) — không dùng cho số lượng thông tin trung tính.
2. **3 màu trạng thái** dùng xuyên suốt: xanh = xong/thành công, vàng = đang chờ/thông tin, đỏ =
   cần xử lý/lỗi. Áp dụng nhất quán cho tag, banner, alert.
3. Mọi trường dữ liệu **có thể null/rỗng đều phải ẩn gọn gàng** (không hiện nhãn kèm giá trị trống)
   — dữ liệu case-lookup đặc biệt nhiều field tùy chọn.
4. Ảnh (bằng chứng giải trình, báo cáo công việc) luôn hiển thị dạng **lưới thumbnail vuông**, bấm
   để mở full-size tab mới — không cần lightbox phức tạp.
5. Mobile bắt buộc: bottom tab bar tối đa 5 nút, không được nhiều hơn; nội dung trang phải chừa
   khoảng trống đáy để không bị thanh này che mất nút cuối trang (đặc biệt nút "Gửi giải trình").
6. Toàn bộ thời gian hiển thị cho người dùng là **giờ Việt Nam dạng chữ** (`YYYY-MM-DD HH:MM:SS`),
   không cần/không được tự quy đổi múi giờ.
7. Popup/modal (như mục 4.3) dùng chung 1 kiểu: nền sau làm mờ, panel nổi giữa/căn theo màn hình,
   nút đóng góc trên phải, bấm ra ngoài vùng nội dung cũng đóng được — style này nên tái dùng cho
   bất kỳ chi tiết phụ nào cần xem "gọn" mà không rời khỏi trang hiện tại.
