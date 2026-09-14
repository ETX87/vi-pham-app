-- Migration 0008: them cot ghi_chu cho vi_pham - CSKH ben DVBH nhap luc ghi nhan nghi ngo (dac biet
-- quan trong khi ket_qua_cap_1 = "Loi khac", loai lỗi khong co mo ta san nhu 2 loai con lai) - truoc
-- gio field nay bi DVBH gui thieu trong payload "nghi_ngo_moi" nen KTV khong biet loi gi de tu giai
-- trinh (CHOT 2026-09-14, xem PARTNER_API_GUIDE.md muc 9.1.1 ben repo DVBH).
ALTER TABLE vi_pham ADD COLUMN ghi_chu TEXT;
