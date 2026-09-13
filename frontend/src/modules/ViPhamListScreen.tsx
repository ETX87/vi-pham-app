import { useEffect, useState } from "react";
import { ChevronRight, ClipboardList, AlertCircle, AlertTriangle, Clock3, CheckCircle2, LifeBuoy } from "lucide-react";
import { api } from "../api/client";
import type { ViPham } from "../types";
import { loaiLoiLabel } from "../lib/format";
import { StatusBadge, viPhamStatus } from "../components/StatusBadge";

interface ListResponse {
  rows: ViPham[];
  chuaXuLy: number;
}

const PAGE_SIZE = 10;

const TRANG_THAI_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "status-not-submitted", label: "Chưa giải trình" },
  { value: "status-overdue", label: "Quá hạn giải trình" },
  { value: "status-awaiting", label: "Chờ chốt lỗi" },
  { value: "status-decided", label: "Đã chốt lỗi" },
];

function ThongTinNhanh({ rows }: { rows: ViPham[] }) {
  const tong = rows.length;
  const dem = (cls: string) => rows.filter((r) => viPhamStatus(r).cls === cls).length;

  const items = [
    { icon: <ClipboardList size={16} />, bg: "var(--ink-400)", label: "Tổng vi phạm của tôi", value: tong },
    { icon: <AlertCircle size={16} />, bg: "var(--amber-500)", label: "Chưa giải trình", value: dem("status-not-submitted") },
    { icon: <AlertTriangle size={16} />, bg: "var(--red-600)", label: "Quá hạn giải trình", value: dem("status-overdue") },
    { icon: <Clock3 size={16} />, bg: "var(--blue-600)", label: "Chờ chốt lỗi", value: dem("status-awaiting") },
    { icon: <CheckCircle2 size={16} />, bg: "var(--green-600)", label: "Đã chốt lỗi", value: dem("status-decided") },
  ];

  return (
    <div>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 4 }}>
          Thông tin nhanh
        </div>
        {items.map((it) => (
          <div className="stat-row" key={it.label}>
            <div className="stat-row-icon" style={{ background: it.bg, color: "white" }}>
              {it.icon}
            </div>
            <div className="stat-row-label">{it.label}</div>
            <div className="stat-row-value">{it.value}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ display: "flex", gap: 10 }}>
        <LifeBuoy size={20} color="var(--brand-600)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>
            Cần hỗ trợ?
          </div>
          <div className="card-meta">Liên hệ Admin nếu bạn gặp vấn đề khi giải trình vi phạm.</div>
        </div>
      </div>
    </div>
  );
}

export function ViPhamListScreen({ onSelect }: { onSelect: (id: string) => void }) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trangThai, setTrangThai] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<ListResponse>("/giai-trinh/vi-pham")
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setError("Không tải được danh sách vi phạm."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="loading-state">Đang tải...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const rows = data?.rows ?? [];
  const filteredRows = trangThai ? rows.filter((vp) => viPhamStatus(vp).cls === trangThai) : rows;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const list =
    rows.length === 0 ? (
      <div className="empty-state">Bạn chưa có vi phạm nào cần giải trình. 🎉</div>
    ) : (
      <div>
        <div className="section-title" style={{ marginTop: 0, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span>
            Vi phạm cần xử lý {data && data.chuaXuLy > 0 && <span className="badge">{data.chuaXuLy}</span>}
          </span>
          <select
            value={trangThai}
            onChange={(e) => {
              setTrangThai(e.target.value);
              setPage(1);
            }}
            style={{ fontWeight: 400 }}
          >
            {TRANG_THAI_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {filteredRows.length === 0 ? (
          <div className="empty-state">Không có vi phạm nào khớp bộ lọc đã chọn.</div>
        ) : (
          <>
            {pageRows.map((vp) => {
              const status = viPhamStatus(vp);
              return (
                <div key={vp.id} className={`card card-clickable ${status.cls === "status-overdue" ? "card-priority" : ""}`} onClick={() => onSelect(vp.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 700, marginBottom: 2 }}>#{vp.id}</div>
                      <div className="card-title">{loaiLoiLabel(vp.loai_loi)}</div>
                      <div className="card-meta" style={{ marginTop: 4 }}>
                        <span>{vp.ngay_ghi_nhan}</span>
                        {vp.khu_vuc && <span>{vp.khu_vuc}</span>}
                        {vp.khach_hang && <span>KH: {vp.khach_hang}</span>}
                      </div>
                      {vp.chot_bo_cap_2 !== null && (
                        <div style={{ marginTop: 6 }}>
                          <span className={`tag ${vp.chot_bo_cap_2 ? "tag-pending" : "tag-done"}`}>{vp.chot_bo_cap_2 ? "QC xác nhận vi phạm" : "QC đã bỏ"}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      {vp.case_id && <span style={{ fontSize: 13, fontWeight: 800, color: "var(--brand-700)" }}>#{vp.case_id}</span>}
                      <StatusBadge vp={vp} />
                      <ChevronRight size={18} color="var(--ink-400)" />
                    </div>
                  </div>
                </div>
              );
            })}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", marginTop: 10 }}>
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Trước
                </button>
                <span className="card-meta">
                  Trang {page}/{totalPages}
                </span>
                <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Sau
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );

  return (
    <div className="desktop-layout">
      <div className="desktop-main">{list}</div>
      {rows.length > 0 && (
        <div className="desktop-sidebar">
          <ThongTinNhanh rows={rows} />
        </div>
      )}
    </div>
  );
}
