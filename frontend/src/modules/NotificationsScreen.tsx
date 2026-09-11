import { useEffect, useState } from "react";
import { Bell, ShieldCheck, UserCheck, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import type { ThongBao } from "../types";

interface Response {
  rows: ThongBao[];
  chuaDoc: number;
}

const ICON_BY_LOAI: Record<string, React.ReactNode> = {
  vi_pham_moi: <Bell size={16} />,
  qc_chot_cap_2: <ShieldCheck size={16} />,
  giai_trinh_gs_nhap: <UserCheck size={16} />,
};

export function NotificationsScreen({ onSelectViPham, onChanged }: { onSelectViPham: (id: string) => void; onChanged?: () => void }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get<Response>("/giai-trinh/thong-bao")
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleClick(tb: ThongBao) {
    if (!tb.da_doc) {
      await api.post(`/giai-trinh/thong-bao/${tb.id}/danh-dau-da-doc`);
      onChanged?.();
      load();
    }
    if (tb.link_type === "vi_pham" && tb.link_id) onSelectViPham(tb.link_id);
  }

  if (loading) return <div className="loading-state">Đang tải...</div>;
  if (!data || data.rows.length === 0) return <div className="empty-state">Chưa có thông báo nào.</div>;

  return (
    <div className="narrow">
      <div className="section-title" style={{ marginTop: 0 }}>
        Thông báo {data.chuaDoc > 0 && <span className="badge">{data.chuaDoc}</span>}
      </div>
      {data.rows.map((tb) => (
        <div key={tb.id} className={`card ${tb.link_type ? "card-clickable" : ""} ${!tb.da_doc ? "card-priority" : ""}`} onClick={() => handleClick(tb)} style={{ display: "flex", gap: 12 }}>
          <span className="icon-row-icon" style={{ marginTop: 2 }}>
            {ICON_BY_LOAI[tb.loai] ?? <Bell size={16} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: tb.da_doc ? 500 : 700 }}>
              {!tb.da_doc && <span className="dot-unread" />}
              {tb.noi_dung}
            </div>
            <div className="card-meta">
              <span>{tb.ngay_tao}</span>
            </div>
          </div>
          {tb.link_type && <ChevronRight size={18} color="var(--ink-400)" style={{ flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  );
}
