-- Migration 0009: thong bao cong ty (Admin soan, broadcast toi nguoi nhan Admin CHON khi soan,
-- KTV xac nhan da doc tung thong bao) - khac voi bang thong_bao hien co (chi danh cho su kien vi
-- pham tu dong sinh, 1-dong-1-nguoi, khong co nhu cau xem "ai da doc" tren nhieu nguoi).

CREATE TABLE thong_bao_cong_ty (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tieu_de     TEXT NOT NULL,
    noi_dung    TEXT NOT NULL,
    nguoi_tao   TEXT NOT NULL REFERENCES users(email),
    tao_luc     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Roster snapshot nguoi nhan TAI THOI DIEM gui (Admin tu chon, khong phai toan bo users) -
-- da_doc_luc NULL = chua doc. Khong tu them nguoi moi duyet sau/khong tu xoa nguoi bi khoa sau do,
-- giu nguyen trang thai lich su luc gui.
CREATE TABLE thong_bao_cong_ty_xac_nhan (
    thong_bao_id    INTEGER NOT NULL REFERENCES thong_bao_cong_ty(id),
    nguoi_nhan      TEXT NOT NULL REFERENCES users(email),
    da_doc_luc      TEXT,
    PRIMARY KEY (thong_bao_id, nguoi_nhan)
);
-- Truy van chinh: danh sach "thong bao cong ty cua toi" + dem chua doc (badge) - giaiTrinh.ts.
CREATE INDEX idx_tbct_xacnhan_nguoi_nhan ON thong_bao_cong_ty_xac_nhan(nguoi_nhan, da_doc_luc);
-- Admin xem roster da doc/chua doc cua 1 thong bao - adminThongBaoCongTy.ts.
CREATE INDEX idx_tbct_xacnhan_thong_bao ON thong_bao_cong_ty_xac_nhan(thong_bao_id);
