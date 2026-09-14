-- Migration 0007: tuong tu migration 0005 (loai_loi_mo_ta) nhung cho ket_qua_cap_1 - "CSKH ket luan
-- loai loi" (doi ten hien thi tu "Ket luan cap 1", xem phan hoi nguoi dung) la ket luan CSKH dua ra
-- SAU khi da xac minh voi khach hang, khac voi loai_loi la loai NGHI NGO ban dau tu DVBH gui sang.
CREATE TABLE ket_qua_cap_1_mo_ta (
    ma              TEXT PRIMARY KEY,
    ten_hien_thi    TEXT NOT NULL,
    mo_ta           TEXT NOT NULL,
    cap_nhat_luc    TEXT NOT NULL DEFAULT (datetime('now')),
    cap_nhat_boi    TEXT REFERENCES users(email)
);

-- Seed 3 gia tri hien co (dung khop voi frontend/src/lib/format.ts KET_QUA_CAP_1_LABEL truoc
-- migration nay - "Loi khong lien he" doi ten hien thi tu "Lỗi không liên hệ được" -> "Lỗi không
-- liên hệ" theo phan hoi nguoi dung).
INSERT INTO ket_qua_cap_1_mo_ta (ma, ten_hien_thi, mo_ta) VALUES
    ('Loi khong lien he', 'Lỗi không liên hệ', 'CSKH kết luận lỗi do KTV không liên hệ với khách hàng'),
    ('Loi sai bao cao', 'Lỗi sai báo cáo', 'CSKH kết luận lỗi do KTV báo cáo sai thông tin so với thực tế'),
    ('Loi khac', 'Lỗi khác', 'CSKH kết luận lỗi khác');
