-- Migration 0011: them 2 vai tro chi-xem "Giam sat" (GS khu vuc) va "View" (xem toan bo).
-- KHONG mo rong CHECK cua users.vai_tro (SQLite khong sua duoc CHECK, phai dung lai ca bang users -
-- rui ro vi 7 bang khac REFERENCES users(email)) - them 1 cot rieng, doc gop
-- COALESCE(vai_tro, vai_tro_xem). Admin PATCH luon dat 1 trong 2 cot va xoa cot con lai (adminUsers.ts),
-- nen 1 tai khoan chi co 1 vai tro hieu luc.
ALTER TABLE users ADD COLUMN vai_tro_xem TEXT CHECK (vai_tro_xem IN ('Giam sat', 'View'));

-- Khu vuc GS phu trach (Admin gan tay trong Quan tri) - khu_vuc_ma khop ktv_lien_he.khu_vuc_ma (dong bo
-- tu linh-kien-app). GS xem duoc vi pham cua moi KTV co khu_vuc_ma nam trong danh sach nay.
CREATE TABLE user_khu_vuc (
    user_email      TEXT NOT NULL REFERENCES users(email),
    khu_vuc_ma      TEXT NOT NULL,
    PRIMARY KEY (user_email, khu_vuc_ma)
);
CREATE INDEX idx_ktv_lien_he_khu_vuc ON ktv_lien_he(khu_vuc_ma);
