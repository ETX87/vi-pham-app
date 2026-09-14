-- Migration 0005: Admin tu dinh nghia ten hien thi + mo ta chi tiet cho tung loai_loi tho DVBH gui
-- (vi_pham.loai_loi) - truoc gio KTV chi thay ten loi ngan gon (qua loaiLoiLabel() frontend), khong
-- hieu ro loi cu the la gi (xem phan hoi nguoi dung). "ma" LUON khop CHINH XAC voi chuoi vi_pham.loai_loi
-- (khong tu sinh id rieng) de tra cuu truc tiep, khong can JOIN qua bang trung gian nao khac.
CREATE TABLE loai_loi_mo_ta (
    ma              TEXT PRIMARY KEY,
    ten_hien_thi    TEXT NOT NULL,
    mo_ta           TEXT NOT NULL,
    cap_nhat_luc    TEXT NOT NULL DEFAULT (datetime('now')),
    cap_nhat_boi    TEXT REFERENCES users(email)
);

-- Seed 4 loai loi hien co (dung khop voi frontend/src/lib/format.ts LOAI_LOI_LABEL truoc migration
-- nay) - Admin co the sua/them qua man Quan tri sau khi trien khai.
INSERT INTO loai_loi_mo_ta (ma, ten_hien_thi, mo_ta) VALUES
    ('Loi lo ke hoach', 'Lỗi lỡ kế hoạch', 'Ghi nhận vi phạm đặt lịch hẹn với khách hàng trên hệ thống nhưng quá 24h vẫn chưa thấy triển khai'),
    ('Hen qua 24h', 'Hẹn quá 24h', 'Ghi nhận vi phạm khi thời gian hẹn quá 24h so với thời gian mở ca và CSKH xác nhận lại với khách hàng là không đúng'),
    ('Loi 120 phut', 'Lỗi 120 phút', 'Ghi nhận vi phạm trong 120 phút sau khi tiếp nhận ca không có báo cáo thời gian hẹn lịch hoặc không gọi hẹn với khách hàng'),
    ('KH hen lai', 'Khách hàng hẹn lại', 'Ghi nhận vi phạm KTV chọn lý do chậm là khách hàng hẹn lại thời gian, nhưng thực tế khách hàng phản hồi chủ động hẹn');
