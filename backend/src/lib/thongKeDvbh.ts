import type { Env } from "../types";
import { nowVN } from "./vnTime";

// So lieu cong viec theo KTV tu DVBH (GET /api/partner/thong-ke-ktv - PARTNER_API_GUIDE.md muc 14 ben repo DVBH). Dung
// lai CASE_LOOKUP_API_KEY: key doi tac ben DVBH khong phan quyen theo endpoint, key case-lookup goi duoc moi API doc.
// Keo CA THANG (moi KTV) 1 lan roi cache 1 gio trong thong_ke_dvbh_cache - DVBH cung chi tinh lai sau moi dot import CRM
// nen goi day hon khong co so moi.

export interface ThongKeDvbhRow {
  ma_ktv: string;
  ten_ktv: string | null;
  tong_ca_tiep_nhan: number;
  ca_tiep_nhan_con_ton: number;
  ca_dong: number;
  ca_hoan_thanh: number;
  ca_khong_hoan_thanh: number;
  ca_dung_han: number;
  ca_tinh_sla: number;
  ca_duoi_24h: number;
  ca_tinh_24h: number;
  phan_bo_24h: Record<string, number>;
  thoi_gian_xu_ly_tb_gio: number | null;
  nghi_ngo: { loi_120p: number; hen_qua_24h: number; lo_ke_hoach: number; kh_hen_lai: number; tong: number };
  vi_pham_da_khao_sat: number;
  vi_pham_xac_nhan: number;
}

interface ThongKeDvbhPayload {
  thang: string;
  tinh_luc: string;
  rows: ThongKeDvbhRow[];
}

export interface ThongKeDvbhKetQua {
  payload: ThongKeDvbhPayload | null;
  layLuc: string | null;
  // true = lan lam moi vua roi that bai, payload (neu co) la ban cu.
  loi: boolean;
}

const TTL_MS = 60 * 60 * 1000;

function vnToMs(s: string): number {
  return Date.parse(`${s.replace(" ", "T")}Z`) - 7 * 60 * 60 * 1000;
}

async function fetchTuDvbh(env: Env, thang: string): Promise<ThongKeDvbhPayload> {
  const base = (env.CASE_LOOKUP_BASE_URL || "https://dvbh.dichvu3t.workers.dev").replace(/\/$/, "");
  const res = await env.DVBH_SERVICE.fetch(`${base}/api/partner/thong-ke-ktv?thang=${encodeURIComponent(thang)}`, {
    headers: { "X-API-Key": env.CASE_LOOKUP_API_KEY },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP_${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ThongKeDvbhPayload;
}

export async function getThongKeDvbh(env: Env, thang: string): Promise<ThongKeDvbhKetQua> {
  const cached = await env.DB.prepare("SELECT du_lieu, lay_luc FROM thong_ke_dvbh_cache WHERE thang = ?")
    .bind(thang)
    .first<{ du_lieu: string; lay_luc: string }>();
  if (cached && Date.now() - vnToMs(cached.lay_luc) < TTL_MS) {
    return { payload: JSON.parse(cached.du_lieu) as ThongKeDvbhPayload, layLuc: cached.lay_luc, loi: false };
  }

  try {
    const payload = await fetchTuDvbh(env, thang);
    const layLuc = nowVN();
    await env.DB.prepare(
      `INSERT INTO thong_ke_dvbh_cache (thang, du_lieu, lay_luc) VALUES (?, ?, ?)
       ON CONFLICT(thang) DO UPDATE SET du_lieu = excluded.du_lieu, lay_luc = excluded.lay_luc`,
    )
      .bind(thang, JSON.stringify(payload), layLuc)
      .run();
    return { payload, layLuc, loi: false };
  } catch (err) {
    // DVBH loi/qua tai (429) - tra ban cache cu neu co thay vi lam hong ca man bao cao.
    console.error(`getThongKeDvbh(${thang}) that bai`, err);
    return cached
      ? { payload: JSON.parse(cached.du_lieu) as ThongKeDvbhPayload, layLuc: cached.lay_luc, loi: true }
      : { payload: null, layLuc: null, loi: true };
  }
}
