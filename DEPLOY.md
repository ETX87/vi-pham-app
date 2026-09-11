# DEPLOY.md — Checklist triển khai lần đầu

Repo này có đầy đủ mã nguồn sẵn sàng deploy, nhưng CHƯA có tài nguyên Cloudflare/Google thật. Làm
theo đúng thứ tự dưới đây (thứ tự lấy từ kế hoạch xây dựng đã duyệt — xem
`C:\Users\meomeo3101\.claude\plans\reflective-sauteeing-salamander.md`). **Xác nhận với người yêu
cầu trước khi chạy bất kỳ lệnh nào ở đây** nếu bạn là một phiên AI mới không chắc đã được uỷ quyền —
đây đều là hành động tạo/sửa tài nguyên thật, và bước 7 mở một tích hợp API 2 chiều thật với hệ DVBH
sản xuất.

## 1. Thêm redirect URI của vi-pham-app vào Google OAuth Client SẴN CÓ của linh-kien-app

Hệ này dùng CHUNG 1 Google OAuth Client (Client ID/Secret) với `linh-kien-app` — **không tạo OAuth
Client mới**.

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → mở đúng project đang chứa OAuth
   Client của `linh-kien-app`.
2. APIs & Services → Credentials → mở OAuth Client hiện có → mục "Authorized redirect URIs" → thêm:
   - `https://vipham.dichvu3t.workers.dev/api/auth/callback` (production)
   - `http://localhost:8790/api/auth/callback` (tuỳ chọn, test local)
3. Lấy lại `Client ID`/`Client Secret` của Client này (giống hệt giá trị đã dùng cho
   `linh-kien-app`) — dùng ở bước 3.
4. Google Drive API đã được bật sẵn cho project này (linh-kien-app đã bật) — không cần bật lại,
   chỉ cần scope `drive.file` (đã khai trong `backend/src/routes/settings.ts`).

## 2. Tạo Worker + D1 database thật

```bash
# Chay tu thu muc goc cua repo NAY
npx wrangler d1 create vi-pham-db
```

Lệnh trên in ra `database_id` — dán vào `wrangler.jsonc` (`d1_databases[0].database_id`), thay cho
placeholder `00000000-0000-0000-0000-000000000000`.

Domain Worker đã CHỐT SẴN: `name: "vipham"` trong `wrangler.jsonc` → deploy ra
`https://vipham.dichvu3t.workers.dev`. Xác nhận domain này chưa bị Worker nào khác trong tài khoản
Cloudflare chiếm trước khi deploy lần đầu (bước 5).

## 3. Đặt secrets (KHÔNG đặt trong `wrangler.jsonc` — dùng `wrangler secret put`)

```bash
npx wrangler secret put GOOGLE_CLIENT_ID        # gia tri GIONG HET linh-kien-app
npx wrangler secret put GOOGLE_CLIENT_SECRET    # gia tri GIONG HET linh-kien-app
npx wrangler secret put SESSION_SECRET          # chuoi ngau nhien rieng, vd: openssl rand -hex 32
npx wrangler secret put DVBH_INBOUND_API_KEY    # TU SINH (vd openssl rand -hex 32) - xem buoc 7
npx wrangler secret put KTV_SYNC_API_KEY        # TU SINH (vd openssl rand -hex 32) - xem buoc 5
npx wrangler secret put DVBH_SYNC_API_KEY       # nhan tu van hanh DVBH - xem buoc 7
npx wrangler secret put CASE_LOOKUP_API_KEY     # nhan RIENG tu van hanh DVBH (khac DVBH_SYNC_API_KEY o tren) - xem buoc 7
npx wrangler secret put VAPID_SERVER_PRIVATE_KEY
```

VAPID key pair (public/private) sinh 1 lần bằng `npx web-push generate-vapid-keys` (hoặc bất kỳ
công cụ tương thích) — `VAPID_SERVER_PUBLIC_KEY` điền vào `wrangler.jsonc vars` (thay placeholder
`REPLACE_WITH_REAL_VAPID_PUBLIC_KEY`), `VAPID_SERVER_PRIVATE_KEY` đặt qua secret ở trên. KHÔNG dùng
chung cặp VAPID key với `linh-kien-app` (mỗi Worker nên có key riêng — subscription của 1 Worker
không portable sang Worker khác dùng key khác).

Google Drive (ảnh giải trình) không cần secret riêng — dùng chung `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET` ở trên qua cơ chế OAuth (kết nối thật trong Settings sau khi deploy, bước 6).

## 4. Migrate + deploy vi-pham-app (PHẢI làm TRƯỚC bước 5)

Danh bạ KTV đi theo chiều **linh-kien-app chủ động đẩy sang** (Service Binding gọi tới script tên
`vipham`) — nên Worker này cần tồn tại trước khi cấu hình phía linh-kien-app:

```bash
npm install
npm run db:migrate:remote
npm run deploy
```

Xác nhận domain `https://vipham.dichvu3t.workers.dev` (tên script `vipham` trong `wrangler.jsonc`)
chưa bị Worker nào khác trong tài khoản Cloudflare chiếm trước khi deploy.

## 5. Deploy Phần A lên `linh-kien-app` (thêm đích đồng bộ "vipham")

Thay đổi này nằm trong repo KHÁC (`linh-kien-app`, không phải repo này) — xem kế hoạch xây dựng mục
"Phần A". Đã thêm sẵn `"vipham"` làm đích thứ 4 trong `backend/src/lib/dvbhSyncClient.ts` (cùng cơ
chế Service Binding + cron hàng giờ đang đẩy tới `dvbh`/`suachua`/`khovan`), nhưng cần hoàn tất cấu
hình thật:

1. Trong `linh-kien-app/wrangler.jsonc`, xác nhận entry `services` cho `VIPHAM_SYNC_SERVICE` trỏ đúng
   tên script đã deploy ở bước 4 (mặc định `"vipham"` — sửa lại nếu tên script thật khác) và
   `VIPHAM_SYNC_BASE_URL` khớp domain thật (mặc định đoán `https://vipham.dichvu3t.workers.dev`).
2. `npx wrangler secret put VIPHAM_SYNC_API_KEY` (chạy trong repo `linh-kien-app`) — dán ĐÚNG giá trị
   đã đặt cho secret `KTV_SYNC_API_KEY` của vi-pham-app ở bước 3 (đây là CÙNG 1 giá trị, chỉ khác tên
   biến ở 2 phía — vi-pham-app tự sinh, linh-kien-app chỉ cấu hình lại).
3. Deploy lại `linh-kien-app` (`npm run deploy` trong repo đó) để Service Binding có hiệu lực.
4. Chờ tới đầu giờ tiếp theo (cron `0 * * * *`) hoặc kích cron thủ công (`wrangler` không có lệnh
   trigger cron trực tiếp — dùng route debug nếu `linh-kien-app` có, hoặc đơn giản là chờ) rồi kiểm
   tra `GET https://vipham.dichvu3t.workers.dev/api/settings/ktv-lien-he-status` (đăng nhập Admin
   trước) thấy `soLuong > 0`.

**Lưu ý rủi ro 1042**: KHÔNG áp dụng cho chiều này — `linh-kien-app` đã dùng Service Binding sẵn (xem
`dvbhSyncClient.ts`), không bị chặn bởi lỗi 1042 (chỉ ảnh hưởng gọi `fetch()` thẳng URL `*.workers.dev`
giữa 2 Worker cùng tài khoản). Rủi ro này CHỈ còn áp dụng cho chiều vi-pham-app → DVBH (bước 7,
`lib/dvbhClient.ts` dùng `fetch()` thẳng) — xem ghi chú trong `wrangler.jsonc` của repo này.

## 6. Đăng nhập lần đầu + kết nối Google Drive

1. Mở `https://vipham.dichvu3t.workers.dev` → đăng nhập Google bằng đúng email đặt trong
   `BOOTSTRAP_ADMIN_EMAIL` (mặc định `smarttrade.vp@gmail.com`, xem `wrangler.jsonc vars`) → tự
   động lên Admin.
2. Vào tab "Quản trị" → "Kết nối Google Drive" → xác nhận trạng thái "Đã kết nối" (bắt buộc để
   upload ảnh bằng chứng giải trình hoạt động).
3. Xác nhận danh bạ KTV đã nhận được từ bước 5.4 (số lượng KTV > 0 trong tab "Quản trị").

## 7. Bật chiều DVBH → vi-pham-app (chỉ làm SAU KHI bước 5-6 đã xong và test ổn)

Theo `PARTNER_API_GUIDE.md` mục 9.3: **2 key riêng biệt, khác chiều, không dùng chung**.

1. `DVBH_INBOUND_API_KEY` (đã tự sinh ở bước 3) + URL Worker thật
   (`https://vipham.dichvu3t.workers.dev`) — gửi 2 giá trị này cho vận hành DVBH qua kênh liên lạc
   AN TOÀN (không qua chat/email thường) để họ cấu hình secret nội bộ `VIPHAM_APP_API_KEY`/
   `VIPHAM_APP_URL` bên hệ DVBH gốc (`cloudflare smarttrade base`, KHÔNG phải repo này).
2. Liên hệ vận hành DVBH để được cấp **2 key riêng biệt** cùng lúc (khác nhau, không dùng chung):
   - `DVBH_SYNC_API_KEY` — cho chiều gửi kết quả giải trình (`POST /api/partner/sync/giai-trinh-vi-pham`).
   - `CASE_LOOKUP_API_KEY` — cho tra cứu thông tin case gốc khi KTV mở 1 vi phạm
     (`GET /api/partner/case-lookup`, mục 1-7 guide — giống cách `linh-kien-app` đã được cấp).
   Dán 2 giá trị vào đúng 2 secret tương ứng (bước 3).
3. **Trước khi hoàn tất bước 1**, DVBH sẽ KHÔNG gọi gì sang vi-pham-app (chiều 1 tự động tắt cho tới
   khi có URL/key — xem guide mục 9.1). Chỉ báo cho vận hành DVBH cấu hình sau khi đã xác nhận toàn
   bộ luồng nội bộ (đăng nhập, Drive, danh bạ KTV) hoạt động ổn định.

## Kiểm thử local trước khi deploy thật (khuyến nghị)

```bash
cp .dev.vars.example .dev.vars     # dien gia tri that hoac de placeholder cho GOOGLE_CLIENT_ID/SECRET
npm run db:migrate:local
npm run dev:worker      # port 8790
npm run dev:frontend    # port 5176, proxy /api sang 8790
```

Mở `http://localhost:5176` → nút "🔧 Đăng nhập DEV" (chỉ hiện khi `vite dev` + `LOCAL_DEV_BYPASS_AUTH=true`
trong `.dev.vars`) để vào thẳng vai trò Admin, không cần Google OAuth thật.

Giả lập DVBH gọi vào (thay `<key>` bằng giá trị `DVBH_INBOUND_API_KEY` trong `.dev.vars`) — cùng 1
endpoint `/api/nhan-vi-pham` xử lý 3 loại sự kiện, phân biệt qua `loai_su_kien`/`nguon_cap_nhat`
(mục 9.1/9.1.2 guide):

```bash
# 1) Nghi ngờ vi phạm mới (loai_su_kien mặc định "nghi_ngo_moi" nếu bỏ trống)
curl -s -X POST http://localhost:8790/api/nhan-vi-pham \
  -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"vi_pham_id":"L-TEST-001","case_id":"CASE-TEST","loai_loi":"Loi 120 phut",
       "ket_qua_cap_1":"Loi khong lien he","khach_hang":"Nguyen Van Test","khu_vuc":"Mien Bac",
       "ky_thuat_vien":"Nguyen Van A","seri_san_pham":"SN000000",
       "ngay_ghi_nhan":"2026-09-11 09:15:23","nguoi_ghi_nhan":"cskh@dichvu3t.vn"}'

# 2) QC chốt/bỏ vi phạm cấp 2 (mục 9.1.2a) - thông báo KTV kết quả cuối
curl -s -X POST http://localhost:8790/api/nhan-vi-pham \
  -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"loai_su_kien":"cap_nhat","nguon_cap_nhat":"qc_chot_cap_2","vi_pham_id":"L-TEST-001",
       "case_id":"CASE-TEST","chot_bo_cap_2":true,"nguoi_chot":"qc@dichvu3t.vn",
       "ngay_chot":"2026-09-11 10:30:00"}'

# 3) Giám sát nhập giải trình thay TRỰC TIẾP trong DVBH (mục 9.1.2b, KTV không dùng app này)
curl -s -X POST http://localhost:8790/api/nhan-vi-pham \
  -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"loai_su_kien":"cap_nhat","nguon_cap_nhat":"giam_sat_giai_trinh","vi_pham_id":"L-TEST-001",
       "case_id":"CASE-TEST","nguoi_giai_trinh":"Nguyen Van A","ngay_giai_trinh":"2026-09-11",
       "noi_dung_giai_trinh":"Do khach yeu cau doi lich, da bao CSKH truoc"}'
```

Cả 2 sự kiện "cập nhật" đều là **no-op an toàn** (vẫn trả `{"ok":true}`, không lỗi) nếu gọi trước khi
sự kiện "nghi_ngo_moi" tương ứng đã tạo dòng `vi_pham` — kiểm tra log server nếu nghi ngờ bị bỏ sót
(không có bảng đối soát nào khác ngoài log, đúng tinh thần "không có hàng đợi retry" của guide).

Thêm trước 1 dòng `ktv_lien_he` test (`ten_hien_thi = "Nguyen Van A"`, `email_dang_nhap` = email KTV
test) qua `npx wrangler d1 execute DB --local --config wrangler.jsonc --command "..."` để kiểm tra
khớp tên tự động — thay cho việc chờ linh-kien-app đẩy sang thật lúc test local.

Giả lập linh-kien-app đẩy danh bạ KTV sang (thay `<key>` bằng giá trị `KTV_SYNC_API_KEY` trong
`.dev.vars`):

```bash
curl -s -X POST http://localhost:8790/api/partner/sync/ktv \
  -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"rows":[{"ma_ktv":"KTV001","ten_hien_thi":"Nguyen Van A","sdt":"0912345678",
       "gmail":"a@gmail.com","vai_tro_ktv":"KTV","email_dang_nhap":"a@gmail.com"}]}'
```

`DVBH_SYNC_API_KEY` vẫn cần trỏ tới hệ DVBH thật (hoặc hệ đang chạy local) để test đầy đủ chiều gửi
giải trình về DVBH — nếu chưa có, luồng đó sẽ báo lỗi kết nối nhưng không chặn phần còn lại của app
(giải trình vẫn lưu cục bộ, cron sẽ tự retry).
