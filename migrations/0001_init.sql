-- Migration 0001: khoi tao toan bo schema cua vi-pham-app ("he Giai trinh vi pham" - xem
-- PARTNER_API_GUIDE.md muc 9 + ke hoach xay dung). Nhan ban kien truc linh-kien-app nhung rut gon
-- toi da (chi giu dung nhung gi luong loi can - nhan vi pham tu DVBH -> khop KTV -> thong bao ->
-- KTV giai trinh -> gui ket qua ve DVBH).

-- users: rut gon hon linh-kien-app - MVP chi can phan biet Admin (xu ly hang doi "chua xac dinh
-- KTV", ket noi Drive) voi KTV thuong (khong co vai_tro rieng, suy tu ktv_lien_he khi can).
CREATE TABLE users (
    email               TEXT PRIMARY KEY,
    ten                 TEXT,
    vai_tro             TEXT CHECK (vai_tro IN ('Admin')),
    trang_thai_duyet    TEXT NOT NULL DEFAULT 'Cho duyet' CHECK (trang_thai_duyet IN ('Cho duyet', 'Da duyet', 'Tu choi')),
    bi_khoa             INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ktv_lien_he: cache DOC-ONLY, ghi de moi gio tu GET {LINHKIEN_BASE_URL}/api/partner/ktv-lien-he
-- (xem lib/ktvDirectoryClient.ts) - KHONG co route CRUD thu cong nao ghi vao bang nay.
CREATE TABLE ktv_lien_he (
    ma_ktv              TEXT PRIMARY KEY,
    ten_hien_thi        TEXT,
    sdt                 TEXT,
    gmail               TEXT,
    email_dang_nhap     TEXT,
    vai_tro_ktv         TEXT CHECK (vai_tro_ktv IN ('KTV', 'CTV', 'Tram', 'Ve tinh')),
    khu_vuc_ma          TEXT,
    giam_sat_quan_ly    TEXT,
    cap_nhat_luc        TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Truy van chinh: khop dang nhap Google (auth.ts) + tra cuu ma_ktv cua 1 KTV dang dang nhap
-- (giaiTrinh.ts).
CREATE INDEX idx_ktv_lien_he_email_dang_nhap ON ktv_lien_he(email_dang_nhap);

-- vi_pham: 1 dong = 1 loi cu the cua 1 case (khong phai 1 case) - DVBH co the gui nhieu dong cho
-- cung 1 case_id neu bi nghi ngo nhieu loai loi cung luc (xem PARTNER_API_GUIDE.md muc 9). id =
-- dung nguyen "vi_pham_id" DVBH gui (vd "L-000123") - khoa noi 2 chieu voi DVBH, KHONG tu sinh.
CREATE TABLE vi_pham (
    id                      TEXT PRIMARY KEY,
    case_id                 TEXT,
    loai_loi                TEXT NOT NULL,
    ket_qua_cap_1           TEXT,
    khach_hang              TEXT,
    khu_vuc                 TEXT,
    -- Ten KTV THO tu DVBH gui (chuoi tu do, chua chuan hoa) - giu nguyen de doi chieu/debug khi
    -- khop ten that bai, khac ky_thuat_vien_ma_ktv la KET QUA khop.
    ky_thuat_vien_ten       TEXT,
    ky_thuat_vien_ma_ktv    TEXT REFERENCES ktv_lien_he(ma_ktv),
    seri_san_pham           TEXT,
    ngay_ghi_nhan           TEXT NOT NULL,
    nguoi_ghi_nhan          TEXT NOT NULL,
    nhan_luc                TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Truy van chinh: danh sach vi pham cua 1 KTV (giaiTrinh.ts GET /vi-pham).
CREATE INDEX idx_vi_pham_ktv ON vi_pham(ky_thuat_vien_ma_ktv);
-- Hang doi "chua xac dinh KTV" cho Admin (adminViPham.ts GET /vi-pham/chua-xac-dinh).
CREATE INDEX idx_vi_pham_chua_xac_dinh ON vi_pham(ky_thuat_vien_ma_ktv) WHERE ky_thuat_vien_ma_ktv IS NULL;

-- vi_pham_giai_trinh: 1 dong = 1 lan KTV nop giai trinh cho 1 vi_pham (id sinh moi bang uuid,
-- KHONG dung lai vi_pham_id lam PK vi ve nguyen tac co the nop lai/sua - MVP hien tai chi cho nop
-- 1 lan qua frontend nhung schema khong khoa cung dieu do).
CREATE TABLE vi_pham_giai_trinh (
    id                      TEXT PRIMARY KEY,
    vi_pham_id              TEXT NOT NULL REFERENCES vi_pham(id),
    nguoi_giai_trinh        TEXT NOT NULL,
    ngay_giai_trinh         TEXT NOT NULL,
    noi_dung_giai_trinh     TEXT,
    ghi_chu                 TEXT,
    -- JSON string[] (toi da 5 phan tu, ep buoc o backend luc nhan POST .../giai-trinh - xem
    -- routes/giaiTrinh.ts).
    anh_urls                TEXT NOT NULL DEFAULT '[]',
    tao_luc                 TEXT NOT NULL DEFAULT (datetime('now')),
    -- NULL = chua dong bo thanh cong ve DVBH -> hang doi retry cho cron (xem lib/dvbhClient.ts
    -- retryPendingGiaiTrinh()).
    dong_bo_dvbh_luc        TEXT,
    dong_bo_loi             TEXT
);
CREATE INDEX idx_vi_pham_giai_trinh_vi_pham ON vi_pham_giai_trinh(vi_pham_id);
CREATE INDEX idx_vi_pham_giai_trinh_pending ON vi_pham_giai_trinh(dong_bo_dvbh_luc) WHERE dong_bo_dvbh_luc IS NULL;

-- push_subscriptions / thong_bao: port nguyen ban tu linh-kien-app (migration 0006/0007) - chi 1
-- loai thong bao duy nhat trong he nay ("co vi pham can giai trinh"), khong can phan loai nhieu
-- nhu linh-kien-app.
CREATE TABLE push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nguoi_dung  TEXT NOT NULL REFERENCES users(email),
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    ngay_tao    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_push_subscriptions_nguoi_dung ON push_subscriptions(nguoi_dung);

CREATE TABLE thong_bao (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nguoi_nhan  TEXT NOT NULL REFERENCES users(email),
    -- Chi 1 gia tri duy nhat hien tai: "vi_pham_moi" - giu dang TEXT (khong CHECK cung 1 gia tri)
    -- de mo rong sau nay khong can migration.
    loai        TEXT NOT NULL,
    noi_dung    TEXT NOT NULL,
    link_type   TEXT,
    link_id     TEXT,
    da_doc      INTEGER NOT NULL DEFAULT 0,
    ngay_tao    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_thong_bao_nguoi_nhan ON thong_bao(nguoi_nhan, ngay_tao DESC);
CREATE INDEX idx_thong_bao_chua_doc ON thong_bao(nguoi_nhan, da_doc);

-- google_drive_oauth: port nguyen ban tu linh-kien-app - 1 tai khoan Google THAT duoc Admin uy
-- quyen (khong phai Service Account) de upload anh bang chung giai trinh qua uploadPublicImage().
CREATE TABLE google_drive_oauth (
    id                  INTEGER PRIMARY KEY,
    google_email        TEXT NOT NULL,
    refresh_token_enc   TEXT NOT NULL,
    folder_id           TEXT NOT NULL,
    authorized_by       TEXT REFERENCES users(email),
    authorized_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
