-- Migration 0006: nguoi dang nhap lan dau ma gmail CHUA khop danh ba KTV (con "Cho duyet") tu khai
-- ma KTV cua minh tren man cho duyet - Admin doi chieu nhanh hon thay vi chi thay mot email tro
-- (xem phan hoi nguoi dung "them 1 o de nguoi dang nhap dien ma KTV"). Khong rang buoc gi voi
-- ktv_lien_he (chi la thong tin tham khao Admin tu doi chieu bang mat, khong tu dong khop).
ALTER TABLE users ADD COLUMN ma_ktv_tu_khai TEXT;
