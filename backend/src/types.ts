// Rut gon tu backend/src/types.ts cua linh-kien-app - chi giu dung nhung gi mien nghiep vu "Giai
// trinh vi pham" can (xem ke hoach xay dung, phan "vai_tro (Admin | NULL)"). Khong co he thong
// "modules"/nhieu vai tro nghiep vu nhu linh-kien-app - MVP chi phan biet Admin vs KTV thuong.

// "Giam sat" (GS khu vuc) / "View" (xem toan bo) - 2 vai tro CHI XEM, luu o cot users.vai_tro_xem
// (migration 0011), doc gop voi users.vai_tro thanh 1 gia tri duy nhat (xem middleware/loadUser.ts).
export type VaiTro = "Admin" | "Giam sat" | "View";

export type TrangThaiDuyet = "Cho duyet" | "Da duyet" | "Tu choi";

export interface AppUser {
  email: string;
  ten: string | null;
  vai_tro: VaiTro | null;
  trang_thai_duyet: TrangThaiDuyet;
  bi_khoa: boolean;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BOOTSTRAP_ADMIN_EMAIL: string;
  GOOGLE_REDIRECT_URI: string;
  FRONTEND_URL: string;
  // Dung CHUNG 1 Google OAuth Client (Client ID/Secret) voi linh-kien-app - CHOT voi nguoi dung,
  // xem ke hoach xay dung. Redirect URI cua vi-pham-app duoc them vao danh sach Authorized redirect
  // URIs cua CHINH Client do tren Google Cloud Console (khong tao Client moi).
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Them 2026-09-11: Service Binding toi Worker "dvbh" - dung cho ca lib/dvbhClient.ts (gui giai
  // trinh) va lib/caseLookupClient.ts (tra cuu case), tranh loi 1042 (chong SSRF cung tai khoan
  // Cloudflare) da xac nhan that trong production. Xem ghi chu wrangler.jsonc.
  DVBH_SERVICE: Fetcher;
  SESSION_SECRET: string;
  // Xac thuc DVBH goi SANG (POST /api/nhan-vi-pham, xem lib/inboundAuth.ts) - 1 secret co dinh 1-1,
  // KHONG dung bang partner_api_keys nhieu-key nhu linh-kien-app (chi co dung 1 doi tac goi vao
  // endpoint nay). Gia tri do vi-pham-app TU SINH, dua cho van hanh DVBH cau hinh lam
  // VIPHAM_APP_API_KEY (xem PARTNER_API_GUIDE.md muc 9.3).
  DVBH_INBOUND_API_KEY: string;
  // linh-kien-app -> vi-pham-app: linh-kien-app CHU DONG day danh ba KTV sang moi gio (cron co san
  // trong dvbhSyncClient.ts cua no, da them "vipham" lam dich thu 4 - khong phai vi-pham-app tu keo
  // ve). Endpoint nhan: POST /api/partner/sync/ktv, xem routes/syncKtv.ts + lib/inboundAuth.ts. Gia
  // tri do VI-PHAM-APP TU SINH, dua cho nguoi van hanh linh-kien-app cau hinh lam secret
  // VIPHAM_SYNC_API_KEY ben do.
  KTV_SYNC_API_KEY: string;
  // vi-pham-app -> DVBH: gui ket qua giai trinh (POST /api/partner/sync/giai-trinh-vi-pham, xem
  // lib/dvbhClient.ts). Key nay do van hanh DVBH cap rieng cho endpoint nay (khac han
  // DVBH_INBOUND_API_KEY o tren - 2 chieu, 2 key doc lap, xem PARTNER_API_GUIDE.md muc 9.3).
  DVBH_SYNC_API_KEY: string;
  // vi-pham-app -> DVBH: tra cuu 1 case theo ID (GET /api/partner/case-lookup, PARTNER_API_GUIDE.md
  // muc 1-7, xem lib/caseLookupClient.ts) - dung khi KTV mo 1 vi pham de xem chi tiet case goc. Day
  // la key THU 4, TACH BIET voi DVBH_SYNC_API_KEY/DVBH_INBOUND_API_KEY/KTV_SYNC_API_KEY o tren - lien
  // he van hanh DVBH de duoc cap rieng (giong cach linh-kien-app da duoc cap).
  CASE_LOOKUP_BASE_URL: string;
  CASE_LOOKUP_API_KEY: string;
  // Cua sau dang nhap CHI danh cho local dev (xem routes/auth.ts GET /dev-login), giong linh-kien-app.
  LOCAL_DEV_BYPASS_AUTH?: string;
  // Web Push (xem lib/webPush.ts) - VAPID_SUBJECT/PUBLIC_KEY khong nhay cam (dat trong "vars"),
  // rieng VAPID_SERVER_PRIVATE_KEY la khoa ky JWT, PHAI dat qua "wrangler secret put".
  VAPID_SUBJECT: string;
  VAPID_SERVER_PUBLIC_KEY: string;
  VAPID_SERVER_PRIVATE_KEY: string;
}

declare module "hono" {
  interface ContextVariableMap {
    email: string;
    user: AppUser;
    requestId: string;
  }
}
