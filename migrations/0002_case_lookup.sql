-- Migration 0002: cache ket qua tra cuu "case-lookup" tu DVBH (PARTNER_API_GUIDE.md muc 1-7) +
-- rate-limit thu cong theo tung nguoi dung. KTV mo 1 vi pham -> he thong tu dong xin thong tin case
-- tuong ung (theo case_id) tu DVBH ve, luu cache DUNG THEO case_id (khong theo vi_pham_id/nguoi
-- dung) vi 1 case co the bi nhieu vi_pham (nhieu loai loi) tham chieu toi, dung chung 1 cache la du
-- va tranh goi DVBH lap lai khong can thiet.

-- case_lookup_cache: 1 dong = ket qua GAN NHAT cua 1 case_id. Luu nguyen JSON tra ve tu DVBH (thay
-- vi tach cot rieng cho ~29 field cua "preview") - tranh migration moi moi lan DVBH doi field, va vi
-- day CHI la cache hien thi tham khao, khong dung de query/loc theo tung field.
CREATE TABLE case_lookup_cache (
    case_id             TEXT PRIMARY KEY,
    found               INTEGER NOT NULL,
    preview_json        TEXT,
    giai_trinh_json     TEXT NOT NULL DEFAULT '[]',
    fetched_at_ms       INTEGER NOT NULL
);

-- case_lookup_sync_log: 1 dong = lan dong bo GAN NHAT cua 1 (nguoi_dung, case_id) - dung de ap 2
-- lop rate-limit thu cong (khac han rate-limit 60/200 req/phut cua DVBH o tang ha tang):
--   1) cung 1 case_id: toi thieu 5 phut/lan (WHERE nguoi_dung=? AND case_id=?)
--   2) khac case_id: toi thieu 5 giay/lan (MAX(synced_at_ms) WHERE nguoi_dung=?, dung index duoi day)
-- Dung epoch millisecond (khong dung chuoi "YYYY-MM-DD HH:MM:SS" nhu cac cot khac trong he thong)
-- vi day la so lieu NOI BO de tinh khoang cach thoi gian, khong phai du lieu trao doi voi DVBH -
-- can chinh xac/de tinh toan hon la dung quy uoc hien thi.
CREATE TABLE case_lookup_sync_log (
    nguoi_dung          TEXT NOT NULL,
    case_id             TEXT NOT NULL,
    synced_at_ms        INTEGER NOT NULL,
    PRIMARY KEY (nguoi_dung, case_id)
);
CREATE INDEX idx_case_lookup_sync_log_nguoi_dung ON case_lookup_sync_log(nguoi_dung);
