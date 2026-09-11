-- Migration 0003: ho tro loai_su_kien = "cap_nhat" cua POST /api/nhan-vi-pham
-- (PARTNER_API_GUIDE.md muc 9.1.2, them 2026-09-11) - DVBH bao sang khi QC chot/bo vi pham cap 2,
-- hoac khi Giam sat nhap giai trinh thay TRUC TIEP trong DVBH (KTV khong dung app vipham).

-- vi_pham: them 3 cot luu ket qua chot cap 2 cua QC - khop dung ten field DVBH gui
-- (nguon_cap_nhat = "qc_chot_cap_2"). NULL ca 3 = QC chua chot.
ALTER TABLE vi_pham ADD COLUMN chot_bo_cap_2 INTEGER;
ALTER TABLE vi_pham ADD COLUMN nguoi_chot TEXT;
ALTER TABLE vi_pham ADD COLUMN ngay_chot TEXT;

-- vi_pham_giai_trinh: them cot "nguon" de phan biet giai trinh KTV tu nop qua app nay
-- ('ktv_qua_app', gia tri MAC DINH cho moi dong cu/moi qua POST .../giai-trinh) voi giai trinh Giam
-- sat nhap thay TRUC TIEP trong DVBH, DVBH bao sang qua nguon_cap_nhat = "giam_sat_giai_trinh"
-- ('giam_sat_dvbh' - loai nay KHONG can dong bo nguoc ve DVBH, du lieu goc da o do roi).
ALTER TABLE vi_pham_giai_trinh ADD COLUMN nguon TEXT NOT NULL DEFAULT 'ktv_qua_app' CHECK (nguon IN ('ktv_qua_app', 'giam_sat_dvbh'));
