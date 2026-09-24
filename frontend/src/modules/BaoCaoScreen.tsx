import { useEffect, useState } from "react";
import { Clock3, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { api } from "../api/client";

interface ThongKeThang {
  tong: number;
  dangCho: number;
  quaHan: number;
  daChot: number;
  daBo: number;
}

interface LoaiLoiThang {
  loaiLoi: string;
  tenHienThi: string;
  soLuong: number;
  tyLe: number;
}

interface BaoCaoResponse {
  thang: string;
  thongKe: ThongKeThang;
  theoLoaiLoi: LoaiLoiThang[];
}

// Thang hien tai dang "YYYY-MM" theo gio VN (dung new Date() gio trinh duyet KTV - lech vai phut so
// voi gio server khong anh huong, chi dung lam gia tri mac dinh cho <input type="month">).
function thangHienTai(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const BAR_COLORS = ["var(--brand-600)", "var(--blue-600)", "var(--amber-500)", "var(--green-600)", "var(--red-600)", "var(--ink-400)"];

function BieuDoLoaiLoi({ rows }: { rows: LoaiLoiThang[] }) {
  if (rows.length === 0) {
    return <div className="empty-state">Chưa có lỗi nào được chốt trong tháng này.</div>;
  }
  return (
    <div>
      {rows.map((r, i) => (
        <div key={r.loaiLoi} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{r.tenHienThi}</span>
            <span style={{ color: "var(--ink-600)" }}>
              {r.soLuong} lỗi · {r.tyLe}%
            </span>
          </div>
          <div style={{ background: "var(--line)", borderRadius: 999, height: 10, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(r.tyLe, 2)}%`,
                height: "100%",
                background: BAR_COLORS[i % BAR_COLORS.length],
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TheThongKe({ thongKe }: { thongKe: ThongKeThang }) {
  const items = [
    { icon: <Clock3 size={16} />, bg: "var(--blue-600)", label: "Đang chờ xử lý", value: thongKe.dangCho },
    { icon: <AlertTriangle size={16} />, bg: "var(--red-600)", label: "Quá hạn giải trình", value: thongKe.quaHan },
    { icon: <CheckCircle2 size={16} />, bg: "var(--green-600)", label: "Đã chốt lỗi", value: thongKe.daChot },
    { icon: <XCircle size={16} />, bg: "var(--ink-400)", label: "Đã bỏ lỗi", value: thongKe.daBo },
  ];
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 4 }}>
        Tổng quan tháng ({thongKe.tong} vi phạm)
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
  );
}

export function BaoCaoScreen() {
  const [thang, setThang] = useState(thangHienTai());
  const [data, setData] = useState<BaoCaoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<BaoCaoResponse>(`/giai-trinh/bao-cao?thang=${thang}`)
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setError("Không tải được báo cáo."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [thang]);

  return (
    <div>
      <div className="section-title" style={{ marginTop: 0, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span>Báo cáo nhanh</span>
        <input type="month" value={thang} max={thangHienTai()} onChange={(e) => e.target.value && setThang(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-state">Đang tải...</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : data ? (
        <>
          <TheThongKe thongKe={data.thongKe} />
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>
              Tỷ lệ lỗi đã chốt theo loại
            </div>
            <BieuDoLoaiLoi rows={data.theoLoaiLoi} />
          </div>
        </>
      ) : null}
    </div>
  );
}
