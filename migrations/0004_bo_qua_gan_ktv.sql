-- Migration 0004: Admin co the "Bo qua" 1 vi pham dang o hang doi "Chua xac dinh KTV" (xem
-- routes/adminViPham.ts) - vd ten KTV tho tu DVBH khong khop duoc ai va khong can gan (KTV nghi
-- viec, du lieu rac...). 0 = van con trong hang doi can gan (mac dinh), 1 = da bo qua, an khoi danh
-- sach can gan nhung KHONG xoa du lieu (co the mo rong sau thanh 1 tab "Da bo qua" rieng).
ALTER TABLE vi_pham ADD COLUMN bo_qua_gan_ktv INTEGER NOT NULL DEFAULT 0;
