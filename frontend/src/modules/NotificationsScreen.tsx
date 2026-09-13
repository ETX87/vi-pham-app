import { useEffect, useRef, useState } from "react";
import { Bell, ShieldCheck, UserCheck, ChevronRight, CheckCheck } from "lucide-react";
import { api } from "../api/client";
import type { ThongBao } from "../types";

interface Response {
  rows: ThongBao[];
  chuaDoc: number;
  hasMore: boolean;
}

const ICON_BY_LOAI: Record<string, React.ReactNode> = {
  vi_pham_moi: <Bell size={16} />,
  qc_chot_cap_2: <ShieldCheck size={16} />,
  giai_trinh_gs_nhap: <UserCheck size={16} />,
};

type TrangThai = "" | "chua_doc" | "da_doc";

const FILTER_OPTIONS: { value: TrangThai; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "chua_doc", label: "Chưa đọc" },
  { value: "da_doc", label: "Đã đọc" },
];

export function NotificationsScreen({ onSelectViPham, onChanged }: { onSelectViPham: (id: string) => void; onChanged?: () => void }) {
  const [trangThai, setTrangThai] = useState<TrangThai>("");
  const [rows, setRows] = useState<ThongBao[]>([]);
  const [chuaDoc, setChuaDoc] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Doi bo loc -> nap lai tu trang 1 (khong giu du lieu trang cu cua bo loc truoc).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<Response>(`/giai-trinh/thong-bao?trang_thai=${trangThai}&page=1`)
      .then((r) => {
        if (cancelled) return;
        setRows(r.rows);
        setChuaDoc(r.chuaDoc);
        setHasMore(r.hasMore);
        setPage(1);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trangThai]);

  function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    api
      .get<Response>(`/giai-trinh/thong-bao?trang_thai=${trangThai}&page=${nextPage}`)
      .then((r) => {
        setRows((prev) => [...prev, ...r.rows]);
        setChuaDoc(r.chuaDoc);
        setHasMore(r.hasMore);
        setPage(nextPage);
      })
      .finally(() => setLoadingMore(false));
  }

  // Infinite scroll kieu Facebook - cham sentinel o cuoi danh sach thi tu tai trang tiep theo, thay
  // vi nut "Xem them" hay tai het 1 lan (50 dong truoc day, ton doc D1 neu danh sach dai).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinelRef.current, hasMore, loadingMore, page, trangThai]);

  async function handleClick(tb: ThongBao) {
    if (!tb.da_doc) {
      await api.post(`/giai-trinh/thong-bao/${tb.id}/danh-dau-da-doc`);
      setRows((prev) => prev.map((r) => (r.id === tb.id ? { ...r, da_doc: 1 } : r)));
      setChuaDoc((c) => Math.max(0, c - 1));
      onChanged?.();
    }
    if (tb.link_type === "vi_pham" && tb.link_id) onSelectViPham(tb.link_id);
  }

  async function handleMarkAllRead() {
    if (markingAll || chuaDoc === 0) return;
    setMarkingAll(true);
    try {
      await api.post("/giai-trinh/thong-bao/danh-dau-tat-ca-da-doc");
      if (trangThai === "chua_doc") {
        // Dang loc "Chua doc" - toan bo dong hien tai vua thanh "da doc", khong con thuoc bo loc
        // nay nua nen xoa het khoi danh sach dang xem.
        setRows([]);
        setHasMore(false);
      } else {
        setRows((prev) => prev.map((r) => ({ ...r, da_doc: 1 })));
      }
      setChuaDoc(0);
      onChanged?.();
    } finally {
      setMarkingAll(false);
    }
  }

  if (loading) return <div className="loading-state">Đang tải...</div>;

  return (
    <div className="narrow">
      <div className="section-title" style={{ marginTop: 0, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span>
          Thông báo {chuaDoc > 0 && <span className="badge">{chuaDoc}</span>}
        </span>
        <button className="btn btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={handleMarkAllRead} disabled={markingAll || chuaDoc === 0}>
          <CheckCheck size={14} /> Đánh dấu tất cả đã đọc
        </button>
      </div>
      <div className="pill-tabs" style={{ marginBottom: 12 }}>
        {FILTER_OPTIONS.map((o) => (
          <button key={o.value} className={`pill-tab ${trangThai === o.value ? "active" : ""}`} onClick={() => setTrangThai(o.value)}>
            {o.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">{trangThai === "chua_doc" ? "Không có thông báo chưa đọc." : trangThai === "da_doc" ? "Không có thông báo đã đọc." : "Chưa có thông báo nào."}</div>
      ) : (
        <>
          {rows.map((tb) => (
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
          <div ref={sentinelRef} />
          {loadingMore && <div className="loading-state">Đang tải thêm...</div>}
        </>
      )}
    </div>
  );
}
