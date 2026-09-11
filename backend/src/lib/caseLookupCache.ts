import type { Env } from "../types";
import { lookupCase, type CaseLookupResult } from "./caseLookupClient";
import { formatVNFromMs } from "./vnTime";

// Rate-limit THU CONG theo tung nguoi dung khi bam "Dong bo" tra cuu case (khac han rate-limit
// 60/200 req/phut cua chinh DVBH o tang ha tang, muc 5 guide - lop nay chi de tranh 1 nguoi dung bam
// lien tuc/spam, khong lien quan gioi han cua DVBH):
//   - CUNG 1 case_id: toi thieu 5 PHUT/lan.
//   - KHAC case_id (bam qua lai giua nhieu vi pham khac nhau): toi thieu 5 GIAY/lan.
// Lan dau tien xem 1 case (chua co cache) KHONG bi chan boi rule "cung case" (chua tung dong bo) -
// nhung VAN bi chan boi rule "5 giay" neu nguoi dung vua dong bo 1 case KHAC ngay truoc do.
const SAME_CASE_COOLDOWN_MS = 5 * 60 * 1000;
const GLOBAL_COOLDOWN_MS = 5 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  reason?: "SAME_CASE" | "TOO_FAST";
  retryAfterMs?: number;
}

async function checkAndReserve(db: D1Database, nguoiDung: string, caseId: string, nowMs: number): Promise<RateLimitResult> {
  const sameCase = await db
    .prepare("SELECT synced_at_ms FROM case_lookup_sync_log WHERE nguoi_dung = ? AND case_id = ?")
    .bind(nguoiDung, caseId)
    .first<{ synced_at_ms: number }>();
  if (sameCase && nowMs - sameCase.synced_at_ms < SAME_CASE_COOLDOWN_MS) {
    return { allowed: false, reason: "SAME_CASE", retryAfterMs: SAME_CASE_COOLDOWN_MS - (nowMs - sameCase.synced_at_ms) };
  }

  const anyCase = await db.prepare("SELECT MAX(synced_at_ms) as m FROM case_lookup_sync_log WHERE nguoi_dung = ?").bind(nguoiDung).first<{ m: number | null }>();
  if (anyCase?.m && nowMs - anyCase.m < GLOBAL_COOLDOWN_MS) {
    return { allowed: false, reason: "TOO_FAST", retryAfterMs: GLOBAL_COOLDOWN_MS - (nowMs - anyCase.m) };
  }

  await db
    .prepare(
      `INSERT INTO case_lookup_sync_log (nguoi_dung, case_id, synced_at_ms) VALUES (?, ?, ?)
       ON CONFLICT(nguoi_dung, case_id) DO UPDATE SET synced_at_ms = excluded.synced_at_ms`,
    )
    .bind(nguoiDung, caseId, nowMs)
    .run();
  return { allowed: true };
}

interface CachedRow {
  found: number;
  preview_json: string | null;
  giai_trinh_json: string;
  fetched_at_ms: number;
}

export interface CaseLookupCacheView {
  found: boolean;
  preview: CaseLookupResult["preview"];
  giaiTrinh: CaseLookupResult["giaiTrinh"];
  fetchedAt: string;
}

export async function getCachedCaseLookup(db: D1Database, caseId: string): Promise<CaseLookupCacheView | null> {
  const row = await db.prepare("SELECT found, preview_json, giai_trinh_json, fetched_at_ms FROM case_lookup_cache WHERE case_id = ?").bind(caseId).first<CachedRow>();
  if (!row) return null;
  return {
    found: !!row.found,
    preview: row.preview_json ? JSON.parse(row.preview_json) : null,
    giaiTrinh: JSON.parse(row.giai_trinh_json || "[]"),
    fetchedAt: formatVNFromMs(row.fetched_at_ms),
  };
}

export type SyncOutcome =
  | { ok: true; data: CaseLookupCacheView }
  | { ok: false; kind: "RATE_LIMITED"; reason: "SAME_CASE" | "TOO_FAST"; retryAfterMs: number }
  | { ok: false; kind: "ERROR"; message: string };

/** Bam "Dong bo" (hoac tu dong lan dau xem 1 case chua co cache) - kiem tra rate-limit, neu qua thi
 * goi DVBH that va ghi de cache. LUON tieu 1 "luot" rate-limit ngay ca khi goi DVBH that bai (tranh
 * spam khi DVBH dang loi/cham). */
export async function syncCaseLookup(env: Env, db: D1Database, nguoiDung: string, caseId: string): Promise<SyncOutcome> {
  const nowMs = Date.now();
  const rl = await checkAndReserve(db, nguoiDung, caseId, nowMs);
  if (!rl.allowed) return { ok: false, kind: "RATE_LIMITED", reason: rl.reason!, retryAfterMs: rl.retryAfterMs! };

  let result: CaseLookupResult;
  try {
    result = await lookupCase(env, caseId);
  } catch (err) {
    return { ok: false, kind: "ERROR", message: err instanceof Error ? err.message : String(err) };
  }

  const fetchedAtMs = Date.now();
  await db
    .prepare(
      `INSERT INTO case_lookup_cache (case_id, found, preview_json, giai_trinh_json, fetched_at_ms)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(case_id) DO UPDATE SET
         found = excluded.found, preview_json = excluded.preview_json,
         giai_trinh_json = excluded.giai_trinh_json, fetched_at_ms = excluded.fetched_at_ms`,
    )
    .bind(caseId, result.found ? 1 : 0, result.preview ? JSON.stringify(result.preview) : null, JSON.stringify(result.giaiTrinh ?? []), fetchedAtMs)
    .run();

  return { ok: true, data: { found: result.found, preview: result.preview, giaiTrinh: result.giaiTrinh ?? [], fetchedAt: formatVNFromMs(fetchedAtMs) } };
}
