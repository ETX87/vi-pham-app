import type { Env } from "../types";
import { nowVN } from "./vnTime";

// Gui ket qua giai trinh ve DVBH (PARTNER_API_GUIDE.md muc 9.2, "chieu 2" cua tich hop 2 chieu).
// DVBH la SERVER co dinh (base URL that, khong doi theo moi truong) - dung hang so thay vi bien
// env, khop dung danh sach "Vars thuong" trong ke hoach xay dung (khong co bien base-url rieng cho
// DVBH). Dung Service Binding (env.DVBH_SERVICE) thay fetch() toan cuc - xac nhan loi 1042 that
// trong production 2026-09-11, xem ghi chu wrangler.jsonc.
const DVBH_SYNC_URL = "https://dvbh.dichvu3t.workers.dev/api/partner/sync/giai-trinh-vi-pham";

export interface GiaiTrinhSyncRow {
  id: string; // vi_pham_giai_trinh.id (uuid noi bo, KHONG gui di - chi dung de cap nhat lai DB)
  vi_pham_id: string;
  nguoi_giai_trinh: string | null;
  ngay_giai_trinh: string;
  noi_dung_giai_trinh: string | null;
  ghi_chu: string | null;
  anh_urls: string[];
}

interface DvbhSyncRowResult {
  vi_pham_id: string;
  ok: boolean;
  error?: string;
}

interface DvbhSyncResponse {
  results?: DvbhSyncRowResult[];
  error?: string; // loi muc REQUEST (401/400/429) - khong co "results" trong truong hop nay
}

async function postBatch(env: Env, rows: GiaiTrinhSyncRow[]): Promise<{ ok: boolean; results: Map<string, DvbhSyncRowResult>; requestError?: string }> {
  const body = {
    rows: rows.map((r) => ({
      vi_pham_id: r.vi_pham_id,
      nguoi_giai_trinh: r.nguoi_giai_trinh,
      ngay_giai_trinh: r.ngay_giai_trinh,
      noi_dung_giai_trinh: r.noi_dung_giai_trinh,
      ghi_chu: r.ghi_chu,
      anh_urls: r.anh_urls.slice(0, 5), // guide: thua se bi cat bot phia DVBH, cat truoc cho chac
    })),
  };

  let res: Response;
  try {
    res = await env.DVBH_SERVICE.fetch(DVBH_SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": env.DVBH_SYNC_API_KEY },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, results: new Map(), requestError: `FETCH_FAILED: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let code = `HTTP_${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) code = j.error;
    } catch {
      /* body khong phai JSON */
    }
    return { ok: false, results: new Map(), requestError: `${code}: ${text.slice(0, 300)}` };
  }

  const json = (await res.json().catch(() => null)) as DvbhSyncResponse | null;
  const map = new Map<string, DvbhSyncRowResult>();
  for (const r of json?.results ?? []) map.set(r.vi_pham_id, r);
  return { ok: true, results: map };
}

/** Dong bo 1 dong giai trinh ngay trong luc KTV submit (routes/giaiTrinh.ts POST .../giai-trinh) -
 * goi ngay trong request, KHONG chan response cho KTV neu that bai (loi/timeout thi vi_pham_id van
 * duoc luu cuc bo, dong_bo_dvbh_luc de NULL cho cron retry - xem retryPendingGiaiTrinh ben duoi). */
export async function syncGiaiTrinhToDvbh(env: Env, row: GiaiTrinhSyncRow): Promise<{ ok: boolean; error?: string }> {
  const { ok, results, requestError } = await postBatch(env, [row]);
  if (!ok) return { ok: false, error: requestError ?? "UNKNOWN_ERROR" };
  const result = results.get(row.vi_pham_id);
  if (!result) return { ok: false, error: "NO_RESULT_RETURNED" };
  if (!result.ok) return { ok: false, error: result.error ?? "UNKNOWN_ROW_ERROR" };
  return { ok: true };
}

export interface RetryPendingResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

/** Quet cac giai trinh chua dong bo duoc (dong_bo_dvbh_luc IS NULL) va thu lai - goi tu
 * scheduled() moi gio (index.ts) + co the goi tay qua route debug neu can. Gui theo lo toi da 200
 * dong/lan (dung gioi han cua guide muc 9.2). */
export async function retryPendingGiaiTrinh(env: Env, db: D1Database, limit = 200): Promise<RetryPendingResult> {
  const { results: pendingRows } = await db
    .prepare(
      `SELECT id, vi_pham_id, nguoi_giai_trinh, ngay_giai_trinh, noi_dung_giai_trinh, ghi_chu, anh_urls
       FROM vi_pham_giai_trinh WHERE dong_bo_dvbh_luc IS NULL ORDER BY tao_luc LIMIT ?`,
    )
    .bind(limit)
    .all<{
      id: string;
      vi_pham_id: string;
      nguoi_giai_trinh: string | null;
      ngay_giai_trinh: string;
      noi_dung_giai_trinh: string | null;
      ghi_chu: string | null;
      anh_urls: string;
    }>();

  if (pendingRows.length === 0) return { attempted: 0, succeeded: 0, failed: 0 };

  const rows: GiaiTrinhSyncRow[] = pendingRows.map((r) => ({
    id: r.id,
    vi_pham_id: r.vi_pham_id,
    nguoi_giai_trinh: r.nguoi_giai_trinh,
    ngay_giai_trinh: r.ngay_giai_trinh,
    noi_dung_giai_trinh: r.noi_dung_giai_trinh,
    ghi_chu: r.ghi_chu,
    anh_urls: JSON.parse(r.anh_urls || "[]") as string[],
  }));

  const { ok, results, requestError } = await postBatch(env, rows);
  const now = nowVN();

  if (!ok) {
    // Loi o MUC REQUEST (vd key sai/429) - khong dong cho dong nao, ghi loi chung vao tung dong de
    // Admin thay nguyen nhan gan nhat khi tra cuu.
    const statements = rows.map((r) => db.prepare("UPDATE vi_pham_giai_trinh SET dong_bo_loi = ? WHERE id = ?").bind(requestError ?? "UNKNOWN_ERROR", r.id));
    await db.batch(statements);
    return { attempted: rows.length, succeeded: 0, failed: rows.length };
  }

  const statements = rows.map((r) => {
    const result = results.get(r.vi_pham_id);
    if (result?.ok) {
      return db.prepare("UPDATE vi_pham_giai_trinh SET dong_bo_dvbh_luc = ?, dong_bo_loi = NULL WHERE id = ?").bind(now, r.id);
    }
    return db.prepare("UPDATE vi_pham_giai_trinh SET dong_bo_loi = ? WHERE id = ?").bind(result?.error ?? "NO_RESULT_RETURNED", r.id);
  });
  await db.batch(statements);

  const succeeded = rows.filter((r) => results.get(r.vi_pham_id)?.ok).length;
  return { attempted: rows.length, succeeded, failed: rows.length - succeeded };
}
