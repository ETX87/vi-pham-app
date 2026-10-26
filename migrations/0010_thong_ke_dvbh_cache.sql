-- Migration 0010: cache so lieu cong viec theo KTV keo tu DVBH (GET /api/partner/thong-ke-ktv, PARTNER_API_GUIDE.md
-- muc 14 ben DVBH) - 1 dong = TOAN BO KTV cua 1 thang (JSON nguyen response), lam moi toi da 1 lan/gio (xem
-- backend/src/lib/thongKeDvbh.ts). KTV mo "Bao cao nhanh" doc tu day, khong goi DVBH moi lan.
CREATE TABLE thong_ke_dvbh_cache (
    thang       TEXT PRIMARY KEY,
    du_lieu     TEXT NOT NULL,
    lay_luc     TEXT NOT NULL
);
