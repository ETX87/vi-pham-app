import { useEffect, useRef, useState } from "react";
import { ChevronRight, ClipboardList, AlertCircle, AlertTriangle, Clock3, CheckCircle2, LifeBuoy } from "lucide-react";
import { api } from "../api/client";
import type { ViPham } from "../types";
import { useKtvOptions } from "../hooks/useKtvOptions";
import { KtvCombobox } from "../components/KtvCombobox";
import { loaiLoiLabel } from "../lib/format";
import { StatusBadge, viPhamStatus } from "../components/StatusBadge";
import { LoaiLoiHelp } from "../components/LoaiLoiHelp";

interface ThongKe {
  tong: number;
  chuaGiaiTrinh: number;
  quaHan: number;
  choChot: number;
  daChot: number;
}

interface ListResponse {
  rows: ViPham[];
  hasMore: boolean;
  chuaXuLy: number;
  thongKe: ThongKe;
}

const TRANG_THAI_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "status-not-submitted", label: "Chưa giải trình" },
  { value: "status-overdue", label: "Quá hạn giải trình" },
  { value: "status-awaiting", label: "Chờ chốt lỗi" },
  { value: "status-decided", label: "Đã chốt lỗi" },
];

function ThongTinNhanh({ thongKe, nhanTong }: { thongKe: ThongKe; nhanTong: string }) {
  const items = [
    { icon: <ClipboardList size={16} />, bg: "var(--ink-400)", label: nhanTong, value: thongKe.tong },
    { icon: <AlertCircle size={16} />, bg: "var(--amber-500)", label: "Chưa giải trình", value: thongKe.chuaGiaiTrinh },
    { icon: <AlertTriangle size={16} />, bg: "var(--red-600)", label: "Quá hạn giải trình", value: thongKe.quaHan },
    { icon: <Clock3 size={16} />, bg: "var(--blue-600)", label: "Chờ chốt lỗi", value: thongKe.choChot },
    { icon: <CheckCircle2 size={16} />, bg: "var(--green-600)", label: "Đã chốt lỗi", value: thongKe.daChot },
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

// Admin/View/GS: o chon KTV giong "Bao cao nhanh", mac dinh toan doi (GS: toan nhom khu vuc minh). onSelect(id,
// readOnly): mo vi pham KHONG phai cua minh thi chi xem (backend cung chan nop giai trinh thay KTV).
// maKtv giu o App.tsx de khong mat lua chon khi mo chi tiet roi quay lai.
export function ViPhamListScreen({
  onSelect,
  xemNhieu,
  maKtv,
  setMaKtv,
}: {
  onSelect: (id: string, readOnly: boolean) => void;
  xemNhieu: boolean;
  maKtv: string;
  setMaKtv: (v: string) => void;
}) {
  const ktv = useKtvOptions(xemNhieu);
  const [trangThai, setTrangThai] = useState("");
  const [rows, setRows] = useState<ViPham[]>([]);
  const [chuaXuLy, setChuaXuLy] = useState(0);
  const [thongKe, setThongKe] = useState<ThongKe>({ tong: 0, chuaGiaiTrinh: 0, quaHan: 0, choChot: 0, daChot: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  function qs(p: number): string {
    const params = new URLSearchParams({ trang_thai: trangThai, page: String(p) });
    if (xemNhieu) {
      if (maKtv) params.set("ma_ktv", maKtv);
      else params.set("toan_doi", "1");
    }
    return params.toString();
  }

  // Doi bo loc trang thai/KTV -> nap lai tu trang 1 (khong giu du lieu trang cu cua bo loc truoc).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<ListResponse>(`/giai-trinh/vi-pham?${qs(1)}`)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setChuaXuLy(res.chuaXuLy);
        setThongKe(res.thongKe);
        setHasMore(res.hasMore);
        setPage(1);
      })
      .catch(() => !cancelled && setError("Không tải được danh sách vi phạm."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trangThai, maKtv, xemNhieu]);

  function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    api
      .get<ListResponse>(`/giai-trinh/vi-pham?${qs(nextPage)}`)
      .then((res) => {
        setRows((prev) => [...prev, ...res.rows]);
        setChuaXuLy(res.chuaXuLy);
        setThongKe(res.thongKe);
        setHasMore(res.hasMore);
        setPage(nextPage);
      })
      .finally(() => setLoadingMore(false));
  }

  // Infinite scroll kieu Facebook - cham sentinel o cuoi danh sach thi tu tai trang tiep theo, thay
  // vi tai toan bo vi pham cua KTV 1 lan (ton doc D1 neu KTV co hang tram vi pham).
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
  }, [sentinelRef.current, hasMore, loadingMore, page, trangThai, maKtv]);

  // O chon KTV dat NGOAI vung loading/empty de luon doi duoc KTV, ke ca khi KTV dang chon khong co vi pham nao.
  const boChonKtv = xemNhieu && (
    <div style={{ marginBottom: 12 }}>
      <KtvCombobox value={maKtv} onChange={setMaKtv} options={ktv.options} allLabel={ktv.allLabel} containerStyle={{ maxWidth: 360 }} />
      {ktv.chuaGanKhuVuc && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          Tài khoản Giám sát chưa được gán khu vực nào - liên hệ Admin để được gán.
        </div>
      )}
    </div>
  );

  if (loading)
    return (
      <div>
        {boChonKtv}
        <div className="loading-state">Đang tải...</div>
      </div>
    );
  if (error)
    return (
      <div>
        {boChonKtv}
        <div className="alert alert-error">{error}</div>
      </div>
    );

  const xemNguoiKhac = xemNhieu;
  const list =
    thongKe.tong === 0 ? (
      <div className="empty-state">{xemNguoiKhac ? "Không có vi phạm nào." : "Bạn chưa có vi phạm nào cần giải trình. 🎉"}</div>
    ) : (
      <div>
        <div className="section-title" style={{ marginTop: 0, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span>
            {xemNguoiKhac ? (maKtv ? "Vi phạm của KTV" : ktv.khuVuc ? "Vi phạm toàn nhóm" : "Vi phạm toàn đội") : "Vi phạm cần xử lý"} {chuaXuLy > 0 && <span className="badge">{chuaXuLy}</span>}
          </span>
          <select value={trangThai} onChange={(e) => setTrangThai(e.target.value)} style={{ fontWeight: 400 }}>
            {TRANG_THAI_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state">Không có vi phạm nào khớp bộ lọc đã chọn.</div>
        ) : (
          <>
            {rows.map((vp) => {
              const status = viPhamStatus(vp);
              return (
                <div key={vp.id} className={`card card-clickable ${status.cls === "status-overdue" ? "card-priority" : ""}`} onClick={() => onSelect(vp.id, xemNhieu && !vp.la_cua_toi)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 700, marginBottom: 2 }}>#{vp.id}</div>
                      <div className="card-title card-title-row">
                        {loaiLoiLabel(vp.loai_loi)}
                        <LoaiLoiHelp maLoi={vp.loai_loi} tenHienThi={loaiLoiLabel(vp.loai_loi)} />
                      </div>
                      <div className="card-meta" style={{ marginTop: 4 }}>
                        <span>{vp.ngay_ghi_nhan}</span>
                        {xemNguoiKhac && !maKtv && <span>KTV: {vp.ten_ktv_khop || vp.ky_thuat_vien_ten || "(chưa xác định)"}</span>}
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
            <div ref={sentinelRef} />
            {loadingMore && <div className="loading-state">Đang tải thêm...</div>}
          </>
        )}
      </div>
    );

  return (
    <div>
      {boChonKtv}
      <div className="desktop-layout">
        <div className="desktop-main">{list}</div>
        {thongKe.tong > 0 && (
          <div className="desktop-sidebar">
            <ThongTinNhanh thongKe={thongKe} nhanTong={xemNguoiKhac ? "Tổng vi phạm" : "Tổng vi phạm của tôi"} />
          </div>
        )}
      </div>
    </div>
  );
}
