# Đề xuất hợp đồng API: Thống kê công việc KTV (DVBH → vi-pham-app)

**Bên đề xuất**: đội `vi-pham-app` (`https://vipham.dichvu3t.workers.dev`)
**Bên cần triển khai**: đội vận hành hệ DVBH (`https://dvbh.dichvu3t.workers.dev`)
**Trạng thái**: ĐÃ TRIỂN KHAI 2026-10-26. Hợp đồng chính thức nằm ở `PARTNER_API_GUIDE.md` mục 14 bên repo DVBH. Phần
dưới (mục 1–8) là bản đề xuất ban đầu, giữ lại để tham khảo; chỗ nào khác bản chính thức thì theo bản chính thức.

### Kết quả: 8 câu hỏi được trả lời từ code DVBH

1. **Khóa KTV**: mã trong tiền tố `(mã) Tên` của `ky_thuat_vien`, đúng cách DVBH khớp `ma_ktv` ở danh sách loại trừ khảo
   sát, và là cột DVBH gửi sang vipham khi báo nghi ngờ. Không dùng `ktv_trien_khai`.
2. **Tháng của case**: các chỉ số KPI tính theo **ngày hoàn thành** (giống dashboard DVBH). Riêng `tong_ca_tiep_nhan` tính
   theo ngày CSKH tiếp nhận.
3. **Case hủy**: không tính ở đâu cả (`huy_bo_at IS NULL`, giống view `case_hieu_luc`).
4. **Nhóm 24h**: dùng nguyên nhãn của `xu_ly_24h_bucket` (`0. Dưới 24h`, `1. Từ 1-2 ngày`, `2. Từ 2-3 ngày`, `3. Trên 3 ngày`).
5. **SLA**: DVBH định nghĩa SLA = `dung_han = 'Đúng hạn'`. Không có dữ liệu thời điểm liên hệ khách lần đầu, nên thay
   `sla.lien_he_120_phut` bằng số cờ nghi ngờ theo 4 loại (`nghi_ngo.loi_120p`...).
6. **Đúng hạn**: `'Đúng hạn'` / `'Quá hạn'`; `'KHÔNG TÍNH'` bị loại qua cờ `tinh_vao_kpi = 0`.
7. **Giới hạn**: 30 request/phút/key. DVBH cache theo tháng, chỉ tính lại sau mỗi đợt import CRM.
8. **Key**: không cần key mới. Key đối tác bên DVBH không phân quyền theo endpoint, vipham dùng lại `CASE_LOOKUP_API_KEY`.

Thời gian xử lý TB lấy từ `so_gio_xu_ly` (giờ), bỏ giá trị ngoài [0, 8760) vì dữ liệu import cũ có dòng lưu sai đơn vị.

---

## 1. Bối cảnh và mục đích

App "Giải trình vi phạm" muốn có màn **Báo cáo nhanh** cho KTV (và cho Admin xem toàn đội), gồm
số liệu công việc theo tháng: tổng ca tiếp nhận, ca hoàn thành, ca đúng hạn, tốc độ xử lý trung
bình, SLA, xử lý trong 24h, tỷ lệ ca bị nghi ngờ vi phạm...

Các số này tính trên **toàn bộ case** của KTV, không chỉ các case bị nghi ngờ. Hiện vi-pham-app chỉ
nhận được các case bị nghi ngờ (qua mục 9.1 của `PARTNER_API_GUIDE.md`), nên **không tự tính được**.
Endpoint `case-lookup` hiện có chỉ tra 1 case/lần và guide mục 5 đã ghi rõ không dùng nó để quét
hàng loạt. Vì vậy cần 1 endpoint mới, trả về **số đã tổng hợp sẵn** (không trả danh sách case,
không chứa dữ liệu khách hàng).

Phần số liệu vi phạm/giải trình (số vi phạm, đã/chưa giải trình, tỷ lệ chốt lỗi...) vi-pham-app
**tự tính** từ dữ liệu của mình, không cần DVBH trả.

## 2. Thông tin kết nối

| | |
|---|---|
| Endpoint | `GET /api/partner/thong-ke-ktv` |
| Xác thực | Header `X-API-Key` — **key mới, riêng** cho endpoint này (không dùng lại key `case-lookup` hay key `/sync/giai-trinh-vi-pham`) |
| Cách gọi | vi-pham-app gọi qua Service Binding `DVBH_SERVICE` (đã có sẵn, tránh lỗi 1042) |
| Tần suất dự kiến | Thấp: vi-pham-app **cache kết quả 1 giờ** trong D1 của mình. Ước tính dưới 100 request/ngày |

## 3. Request

```
GET /api/partner/thong-ke-ktv?thang=2026-10&ma_ktv=KTV001
X-API-Key: <key_rieng_cho_thong_ke>
```

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `thang` | Có | Tháng cần thống kê, dạng `YYYY-MM`. Case được tính vào tháng theo `thoi_gian_cskh_tiep_nhan` (giờ VN), xem câu hỏi Q2 |
| `ma_ktv` | Không | Mã KTV (khớp `ma_ktv` của danh bạ KTV đồng bộ qua `/sync/ktv`, mục 8.1). **Bỏ trống = trả tất cả KTV có case trong tháng** (dùng cho màn Admin) |

Thiếu hoặc sai `thang` → `400 { "error": "INVALID_THANG" }`.

## 4. Response

HTTP 200, `Content-Type: application/json`. Luôn trả mảng `rows`, kể cả khi lọc 1 KTV (0 hoặc 1 phần tử).

```json
{
  "thang": "2026-10",
  "tinh_luc": "2026-10-26 08:00:00",
  "rows": [
    {
      "ma_ktv": "KTV001",
      "ten_ktv": "Nguyen Van A",
      "tong_ca_tiep_nhan": 120,
      "ca_hoan_thanh": 104,
      "ca_huy": 4,
      "ca_dang_xu_ly": 12,
      "ca_dung_han": 92,
      "ca_tre_han": 12,
      "thoi_gian_xu_ly_tb_gio": 18.6,
      "xu_ly_24h": { "duoi_24h": 70, "tu_24_den_48h": 22, "tren_48h": 12 },
      "sla": {
        "lien_he_120_phut_dat": 110,
        "lien_he_120_phut_tong": 116,
        "dung_ke_hoach_dat": 101,
        "dung_ke_hoach_tong": 104
      },
      "ca_nghi_ngo_vi_pham": 9,
      "ca_chot_vi_pham": 5
    }
  ]
}
```

### 4.1. Định nghĩa từng field (DVBH xác nhận hoặc sửa)

| Field | Kiểu | Định nghĩa đề xuất |
|---|---|---|
| `tinh_luc` | string | Thời điểm DVBH tính số liệu, giờ VN `YYYY-MM-DD HH:MM:SS` |
| `ma_ktv` | string | Mã KTV |
| `ten_ktv` | string \| null | Tên hiển thị KTV (để Admin đọc, vi-pham-app không dùng làm khóa) |
| `tong_ca_tiep_nhan` | number | Số case có `thoi_gian_cskh_tiep_nhan` trong tháng, gán cho KTV này. **Tính cả case đã hủy** |
| `ca_hoan_thanh` | number | Trong số trên, case đã có `thoi_gian_hoan_thanh` và không bị hủy |
| `ca_huy` | number | Trong số trên, case có `ly_do_huy` khác null |
| `ca_dang_xu_ly` | number | `tong_ca_tiep_nhan − ca_hoan_thanh − ca_huy` |
| `ca_dung_han` | number | Trong số `ca_hoan_thanh`, case có `dung_han` = "Đúng hạn" (theo đúng logic DVBH đang dùng cho field `dung_han` ở guide mục 3.3.1) |
| `ca_tre_han` | number | `ca_hoan_thanh − ca_dung_han` |
| `thoi_gian_xu_ly_tb_gio` | number \| null | Trung bình (`thoi_gian_hoan_thanh − thoi_gian_cskh_tiep_nhan`) tính bằng giờ, 1 chữ số thập phân, trên các `ca_hoan_thanh`. `null` nếu chưa có ca hoàn thành |
| `xu_ly_24h.*` | number | Phân bổ `ca_hoan_thanh` theo đúng các nhóm của field `xu_ly_24h_bucket` DVBH đang có. Tổng 3 nhóm = `ca_hoan_thanh`. Nếu DVBH đang chia nhóm khác thì trả đúng nhóm của DVBH (xem Q4) |
| `sla.lien_he_120_phut_*` | number | Số case KTV liên hệ khách trong 120 phút (`_dat`) trên tổng case áp dụng SLA này (`_tong`). Xem Q5 |
| `sla.dung_ke_hoach_*` | number | Số case xử lý đúng lịch hẹn (`thoi_gian_hen_xu_ly`) trên tổng case có lịch hẹn. Xem Q5 |
| `ca_nghi_ngo_vi_pham` | number | Số **case** (không phải số lỗi) trong tháng bị CSKH ghi nhận ít nhất 1 nghi ngờ vi phạm |
| `ca_chot_vi_pham` | number | Trong số trên, case có ít nhất 1 lỗi QC chốt là vi phạm (`chot_bo_cap_2 = true`) |

Các field trong `sla` có thể trả `null` nếu DVBH chưa có dữ liệu để tính. vi-pham-app sẽ ẩn mục đó.

### 4.2. Các tỷ lệ — vi-pham-app tự tính, DVBH không cần trả

- Tỷ lệ hoàn thành = `ca_hoan_thanh / (tong_ca_tiep_nhan − ca_huy)`
- Tỷ lệ đúng hạn = `ca_dung_han / ca_hoan_thanh`
- Tỷ lệ xử lý dưới 24h = `xu_ly_24h.duoi_24h / ca_hoan_thanh`
- Tỷ lệ đạt SLA = `_dat / _tong` cho từng loại
- Tỷ lệ ca bị nghi ngờ = `ca_nghi_ngo_vi_pham / tong_ca_tiep_nhan`
- Tỷ lệ nghi ngờ thành vi phạm thật = `ca_chot_vi_pham / ca_nghi_ngo_vi_pham`

Trả số đếm thay vì tỷ lệ để hai bên dễ đối soát, và để vi-pham-app tự cộng gộp được khi xem cả đội.

## 5. Mã lỗi

Giữ đúng quy ước guide mục 4:

| HTTP | `error` | Ý nghĩa |
|---|---|---|
| 400 | `INVALID_THANG` | Thiếu hoặc sai định dạng `thang` |
| 401 | `MISSING_API_KEY` / `INVALID_API_KEY` | Thiếu hoặc sai key |
| 429 | `TOO_MANY_REQUESTS_IP` / `TOO_MANY_REQUESTS_KEY` | Vượt giới hạn tần suất |

`ma_ktv` không tồn tại hoặc không có case trong tháng → HTTP 200 với `rows: []` (không phải lỗi).

## 6. Bảo mật và phạm vi dữ liệu

- Response **chỉ có số đếm**, không có tên khách hàng, seri, định giá hay link CRM.
- vi-pham-app tự phân quyền phía mình: KTV thường chỉ xem được số của chính mình (khớp `ma_ktv` qua
  email đăng nhập), Admin xem được cả đội.
- Key lưu bằng `wrangler secret`, chỉ dùng phía server, không bao giờ đưa xuống trình duyệt.

## 7. Câu hỏi cần DVBH xác nhận trước khi chốt

1. **Khóa KTV**: case trong DVBH đang gắn với KTV bằng gì? Guide mục 3.3.1 chỉ có `ky_thuat_vien`
   (tên dạng chữ). DVBH có map được case sang `ma_ktv` không? Nếu chỉ có tên, vi-pham-app phải tự
   khớp tên như đang làm với vi phạm (dễ sai khi trùng tên).
2. **Tháng của case**: tính theo `thoi_gian_cskh_tiep_nhan` (đề xuất) hay `ngay_import` hay
   `thoi_gian_hoan_thanh`?
3. **Case hủy**: có tính vào `tong_ca_tiep_nhan` không? Đề xuất: có tính, nhưng loại khỏi mẫu số các tỷ lệ.
4. **Nhóm 24h**: field `xu_ly_24h_bucket` hiện có những giá trị nào? Mốc tính từ lúc tiếp nhận
   đến lúc hoàn thành, hay đến lúc KTV tới nơi?
5. **SLA**: DVBH đang theo dõi những chỉ tiêu SLA nào, và có dữ liệu thời điểm KTV liên hệ khách lần
   đầu không? Bốn loại nghi ngờ hiện có (`Loi 120 phut`, `Hen qua 24h`, `Loi lo ke hoach`,
   `KH hen lai`) gợi ý SLA liên hệ 120 phút và SLA đúng kế hoạch — nếu DVBH có chỉ tiêu khác thì đề
   nghị liệt kê để bổ sung vào `sla`.
6. **Định nghĩa "Đúng hạn"**: field `dung_han` có những giá trị chuỗi nào? Cần biết chính xác giá trị
   nào được tính là "đúng hạn".
7. **Giới hạn tần suất**: đề xuất 60 request/phút/key là đủ (đã có cache 1 giờ phía vi-pham-app).
8. **Thời gian triển khai** dự kiến, và cách gửi key mới (qua kênh an toàn như các key trước, mục 9.3).

## 8. Kế hoạch phía vi-pham-app sau khi DVBH chốt

1. Thêm secret `THONG_KE_API_KEY` và client gọi qua `DVBH_SERVICE`.
2. Bảng cache `thong_ke_dvbh_cache (thang, ma_ktv, du_lieu_json, lay_luc)`, hết hạn sau 1 giờ.
3. Mở rộng tab "Báo cáo nhanh": thêm nhóm "Công việc" (số từ DVBH) cạnh nhóm "Vi phạm & giải trình"
   (số tự tính, đã có).
4. Nếu DVBH lỗi hoặc chưa sẵn sàng: nhóm "Công việc" hiện "Chưa có dữ liệu", không ảnh hưởng phần còn lại.
