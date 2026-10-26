import type { AppUser } from "../types";

// Pham vi XEM vi pham theo vai tro (migration 0011):
//   - Admin, View: toan bo KTV.
//   - Giam sat: KTV co ktv_lien_he.khu_vuc_ma nam trong khu vuc Admin gan cho GS (user_khu_vuc).
//   - KTV thuong: chi cua chinh minh.
// Ca 3 vai tro tren chi XEM vi pham cua nguoi khac - nop giai trinh/upload anh van chi chu so huu.

/** Duoc chon KTV / xem toan doi (toan nhom voi GS) o man Vi pham va Bao cao nhanh. */
export function xemNhieuKtv(user: AppUser): boolean {
  return user.vai_tro === "Admin" || user.vai_tro === "View" || user.vai_tro === "Giam sat";
}

/** Email GS de gioi han theo nhom (bind vao sqlKtvCuaGs) - null = khong gioi han them. */
export function emailNhomGs(user: AppUser): string | null {
  return user.vai_tro === "Giam sat" ? user.email : null;
}

/** Subquery tap ma_ktv thuoc khu vuc GS phu trach - `param` la placeholder cua email GS (vd "?3"). */
export function sqlKtvCuaGs(param: string): string {
  return `SELECT k.ma_ktv FROM ktv_lien_he k JOIN user_khu_vuc uk ON uk.khu_vuc_ma = k.khu_vuc_ma WHERE uk.user_email = ${param}`;
}

/** Danh sach ma_ktv GS duoc xem (dung loc so lieu DVBH - khong loc duoc bang SQL vi lay tu cache JSON). */
export async function dsKtvCuaGs(db: D1Database, email: string): Promise<Set<string>> {
  const { results } = await db.prepare(sqlKtvCuaGs("?")).bind(email).all<{ ma_ktv: string }>();
  return new Set(results.map((r) => r.ma_ktv));
}

/** Duoc XEM chi tiet 1 vi pham (khong phai nop ho): chu so huu, Admin/View, hoac GS phu trach khu vuc cua KTV do. */
export async function duocXemViPham(db: D1Database, user: AppUser, maKtv: string | null, chuSoHuu: string | null): Promise<boolean> {
  if (user.vai_tro === "Admin" || user.vai_tro === "View") return true;
  if (maKtv && maKtv === chuSoHuu) return true;
  if (user.vai_tro !== "Giam sat" || !chuSoHuu) return false;
  const row = await db.prepare(`SELECT 1 as x FROM (${sqlKtvCuaGs("?1")}) WHERE ma_ktv = ?2`).bind(user.email, chuSoHuu).first();
  return !!row;
}
