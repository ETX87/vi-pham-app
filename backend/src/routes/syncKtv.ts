import { Hono } from "hono";
import type { Env } from "../types";
import { inboundAuth } from "../lib/inboundAuth";
import { nowVN } from "../lib/vnTime";

// POST /api/partner/sync/ktv - linh-kien-app CHU DONG goi vao moi gio (cron co san trong
// dvbhSyncClient.ts cua no, da them "vipham" lam dich thu 4 - xem ke hoach xay dung, "Phan A"). KHONG
// phai vi-pham-app tu keo ve. Dung DUNG payload/dinh dang PARTNER_API_GUIDE.md muc 8.1 (endpoint goc
// ben DVBH) vi linh-kien-app tai dung chung 1 lop gui cho ca 4 dich.
//
// Chi 1 doi tac goi vao endpoint nay (linh-kien-app) - xac thuc bang 1 secret co dinh
// (env.KTV_SYNC_API_KEY, xem lib/inboundAuth.ts), khong can bang partner_api_keys nhieu-key.
const syncKtv = new Hono<{ Bindings: Env }>();

interface SyncKtvRow {
  ma_ktv?: string;
  ten_hien_thi?: string | null;
  sdt?: string | null;
  ghi_chu?: string | null;
  gmail?: string | null;
  vai_tro_ktv?: string | null;
  giam_sat_quan_ly?: string | null;
  email_dang_nhap?: string | null;
  khu_vuc_ma?: string | null;
  ktv_cap1_phu_trach?: string | null;
}

const MAX_ROWS = 200;

syncKtv.post("/ktv", inboundAuth((env) => env.KTV_SYNC_API_KEY), async (c) => {
  const body = await c.req.json<{ rows?: SyncKtvRow[] }>().catch(() => null);
  if (!body || !Array.isArray(body.rows)) return c.json({ error: "INVALID_BODY" }, 400);
  if (body.rows.length > MAX_ROWS) return c.json({ error: "TOO_MANY_ROWS" }, 400);

  const capNhatLuc = nowVN();
  const errors: string[] = [];
  const statements = [];
  for (const r of body.rows) {
    if (!r.ma_ktv) {
      errors.push("Thieu ma_ktv, bo qua 1 dong.");
      continue;
    }
    // vi-pham-app chi can 1 tap con cot cua PARTNER_API_GUIDE.md muc 8.1 (khong luu ghi_chu/
    // ktv_cap1_phu_trach - khong dung cho nghiep vu giai trinh vi pham) - cac field thua trong payload
    // bi bo qua, khong bao loi.
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO ktv_lien_he (ma_ktv, ten_hien_thi, sdt, gmail, email_dang_nhap, vai_tro_ktv, khu_vuc_ma, giam_sat_quan_ly, cap_nhat_luc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(ma_ktv) DO UPDATE SET
           ten_hien_thi = excluded.ten_hien_thi, sdt = excluded.sdt, gmail = excluded.gmail,
           email_dang_nhap = excluded.email_dang_nhap, vai_tro_ktv = excluded.vai_tro_ktv,
           khu_vuc_ma = excluded.khu_vuc_ma, giam_sat_quan_ly = excluded.giam_sat_quan_ly,
           cap_nhat_luc = excluded.cap_nhat_luc`,
      ).bind(
        r.ma_ktv,
        r.ten_hien_thi ?? null,
        r.sdt ?? null,
        r.gmail ?? null,
        r.email_dang_nhap ?? null,
        r.vai_tro_ktv ?? null,
        r.khu_vuc_ma ?? null,
        r.giam_sat_quan_ly ?? null,
        capNhatLuc,
      ),
    );
  }

  let upserted = 0;
  // D1 batch() gioi han so statement/kich thuoc 1 lan goi - an toan chia nho theo lo 100 dong (danh
  // ba KTV thuc te chi vai chuc-vai tram dong, khong can toi uu hon).
  const BATCH_SIZE = 100;
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await c.env.DB.batch(statements.slice(i, i + BATCH_SIZE));
    upserted += Math.min(BATCH_SIZE, statements.length - i);
  }

  return c.json({ upserted, errors });
});

export default syncKtv;
