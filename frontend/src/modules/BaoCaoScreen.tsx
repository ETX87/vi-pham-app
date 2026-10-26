import { useEffect, useState } from "react";
import { Clock3, AlertTriangle, CheckCircle2, XCircle, FileCheck2, FileClock, Timer } from "lucide-react";
import { api } from "../api/client";

interface ThongKeThang {
  tong: number;
  soCase: number;
  dangCho: number;
  quaHan: number;
  daChot: number;
  daBo: number;
  tyLeChotLoi: number;
}

interface GiaiTrinhThang {
  daGiaiTrinh: number;
  chuaGiaiTrinh: number;
  dungHan: number;
  tyLeGiaiTrinh: number;
  tyLeDungHan: number;
}

interface LoaiLoiThang {
  loaiLoi: string;
  tenHienThi: string;
  soLuong: number;
  tyLe: number;
}

interface NhomNghiNgo {
  ma: string;
  tenHienThi: string;
  tong: number;
  daChot: number;
  daBo: number;
  tyLeTrenTong: number;
  tyLeChotLoi: number;
}

interface CongViecRow {
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

interface CongViec {
  row: CongViecRow | null;
  tinhLuc: string;
  layLuc: string | null;
  loi: boolean;
}

interface BaoCaoResponse {
  thang: string;
  thongKe: ThongKeThang;
  giaiTrinh: GiaiTrinhThang;
  theoLoaiLoi: LoaiLoiThang[];
  theoLoaiNghiNgo: NhomNghiNgo[];
  theoKetQuaCap1: NhomNghiNgo[];
  congViec: CongViec | null;
}

function pct(tu: number, mau: number): number {
  return mau > 0 ? Math.round((tu / mau) * 1000) / 10 : 0;
}

// Thang hien tai dang "YYYY-MM" theo gio VN (dung new Date() gio trinh duyet KTV - lech vai phut so
// voi gio server khong anh huong, chi dung lam gia tri mac dinh cho <input type="month">).
function thangHienTai(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const BAR_COLORS = ["var(--brand-600)", "var(--blue-600)", "var(--amber-500)", "var(--green-600)", "var(--red-600)", "var(--ink-400)"];

function ThanhTyLe({ tyLe, color }: { tyLe: number; color: string }) {
  return (
    <div style={{ background: "var(--line)", borderRadius: 999, height: 10, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(tyLe, 2)}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}

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
          <ThanhTyLe tyLe={r.tyLe} color={BAR_COLORS[i % BAR_COLORS.length]} />
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
        Tổng quan tháng ({thongKe.tong} vi phạm · {thongKe.soCase} case)
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

function TheGiaiTrinh({ gt }: { gt: GiaiTrinhThang }) {
  const items = [
    { icon: <FileCheck2 size={16} />, bg: "var(--green-600)", label: "Đã giải trình", value: `${gt.daGiaiTrinh}` },
    { icon: <FileClock size={16} />, bg: "var(--amber-500)", label: "Chưa giải trình", value: `${gt.chuaGiaiTrinh}` },
    { icon: <Timer size={16} />, bg: "var(--blue-600)", label: "Giải trình trong 48h", value: `${gt.dungHan} · ${gt.tyLeDungHan}%` },
  ];
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 4 }}>
        Giải trình
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
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>Tỷ lệ đã giải trình</span>
          <span style={{ color: "var(--ink-600)" }}>{gt.tyLeGiaiTrinh}%</span>
        </div>
        <ThanhTyLe tyLe={gt.tyLeGiaiTrinh} color="var(--green-600)" />
      </div>
    </div>
  );
}

// Bang nghi ngo theo nhom (loai nghi ngo DVBH gui / ket luan cap 1 cua CSKH): moi dong = so nghi ngo,
// % tren tong nghi ngo cua thang, va % da chot thanh loi that tren so da co ket luan QC (chot + bo).
function BangNghiNgo({ rows, rong }: { rows: NhomNghiNgo[]; rong: string }) {
  if (rows.length === 0) return <div className="empty-state">{rong}</div>;
  return (
    <div>
      {rows.map((r, i) => (
        <div key={r.ma || i} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{r.tenHienThi}</span>
            <span style={{ color: "var(--ink-600)", textAlign: "right" }}>
              {r.tong} nghi ngờ · {r.tyLeTrenTong}%
            </span>
          </div>
          <ThanhTyLe tyLe={r.tyLeTrenTong} color={BAR_COLORS[i % BAR_COLORS.length]} />
          <div className="card-meta" style={{ marginTop: 4 }}>
            <span>Chốt lỗi {r.daChot}</span>
            <span>Bỏ {r.daBo}</span>
            <span>Tỷ lệ chốt {r.daChot + r.daBo > 0 ? `${r.tyLeChotLoi}%` : "—"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const NHAN_NGHI_NGO: { key: keyof CongViecRow["nghi_ngo"]; label: string }[] = [
  { key: "loi_120p", label: "Lỗi 120 phút" },
  { key: "hen_qua_24h", label: "Hẹn quá 24h" },
  { key: "lo_ke_hoach", label: "Lỡ kế hoạch" },
  { key: "kh_hen_lai", label: "KH hẹn lại" },
];

// So lieu ca tu DVBH (dinh nghia giong dashboard DVBH): thang KPI theo ngay hoan thanh, rieng "tiep nhan" theo ngay CSKH
// tiep nhan - ghi chu duoi the de KTV khong cong 2 nhom so voi nhau.
function TheCongViec({ cv }: { cv: CongViec | null }) {
  if (!cv) {
    return (
      <div className="card">
        <div className="card-title" style={{ marginBottom: 6 }}>
          Công việc
        </div>
        <div className="empty-state">Chưa lấy được số liệu công việc từ hệ DVBH, vui lòng thử lại sau.</div>
      </div>
    );
  }
  const r = cv.row;
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 4 }}>
        Công việc
      </div>
      {cv.loi && (
        <div className="alert alert-info" style={{ marginBottom: 8 }}>
          Không cập nhật được từ DVBH, đang hiện số liệu lúc {cv.layLuc}.
        </div>
      )}
      {!r ? (
        <div className="empty-state">Không có ca nào của bạn trong tháng này.</div>
      ) : (
        <>
          <div className="kv-grid">
            <div className="kv-item">
              <div className="kv-label">Ca tiếp nhận</div>
              <div className="kv-value">
                {r.tong_ca_tiep_nhan}
                {r.ca_tiep_nhan_con_ton > 0 && <span style={{ fontWeight: 400, color: "var(--ink-400)" }}> (còn tồn {r.ca_tiep_nhan_con_ton})</span>}
              </div>
            </div>
            <div className="kv-item">
              <div className="kv-label">Ca đã đóng</div>
              <div className="kv-value">
                {r.ca_dong}
                <span style={{ fontWeight: 400, color: "var(--ink-400)" }}> · hoàn thành {r.ca_hoan_thanh}</span>
              </div>
            </div>
            <div className="kv-item">
              <div className="kv-label">Đúng hạn (SLA)</div>
              <div className="kv-value">
                {r.ca_dung_han}/{r.ca_tinh_sla} · {pct(r.ca_dung_han, r.ca_tinh_sla)}%
              </div>
            </div>
            <div className="kv-item">
              <div className="kv-label">Xử lý dưới 24h</div>
              <div className="kv-value">
                {r.ca_duoi_24h}/{r.ca_tinh_24h} · {pct(r.ca_duoi_24h, r.ca_tinh_24h)}%
              </div>
            </div>
            <div className="kv-item">
              <div className="kv-label">Thời gian xử lý TB</div>
              <div className="kv-value">{r.thoi_gian_xu_ly_tb_gio !== null ? `${r.thoi_gian_xu_ly_tb_gio} giờ` : "—"}</div>
            </div>
            <div className="kv-item">
              <div className="kv-label">Không hoàn thành</div>
              <div className="kv-value">{r.ca_khong_hoan_thanh}</div>
            </div>
          </div>

          {r.ca_tinh_24h > 0 && (
            <div className="kv-group">
              <div className="kv-group-title" style={{ marginBottom: 8 }}>
                Thời gian xử lý
              </div>
              {Object.entries(r.phan_bo_24h)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([nhom, sl], i) => (
                  <div key={nhom} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span>{nhom.replace(/^\d+\.\s*/, "")}</span>
                      <span style={{ color: "var(--ink-600)" }}>
                        {sl} ca · {pct(sl, r.ca_tinh_24h)}%
                      </span>
                    </div>
                    <ThanhTyLe tyLe={pct(sl, r.ca_tinh_24h)} color={BAR_COLORS[i % BAR_COLORS.length]} />
                  </div>
                ))}
            </div>
          )}

          <div className="kv-group">
            <div className="kv-group-title">Nghi ngờ vi phạm (theo DVBH)</div>
            <div className="kv-grid">
              <div className="kv-item">
                <div className="kv-label">Tổng nghi ngờ</div>
                <div className="kv-value">
                  {r.nghi_ngo.tong} · {pct(r.nghi_ngo.tong, r.ca_dong)}% số ca đóng
                </div>
              </div>
              <div className="kv-item">
                <div className="kv-label">Đã xác nhận lỗi</div>
                <div className="kv-value">
                  {r.vi_pham_xac_nhan} · {pct(r.vi_pham_xac_nhan, r.nghi_ngo.tong)}%
                </div>
              </div>
              {NHAN_NGHI_NGO.map((n) => (
                <div className="kv-item" key={n.key}>
                  <div className="kv-label">{n.label}</div>
                  <div className="kv-value">{r.nghi_ngo[n.key]}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="card-meta" style={{ marginTop: 10 }}>
        <span>Ca đóng, SLA, 24h, nghi ngờ tính theo ngày hoàn thành; ca tiếp nhận theo ngày CSKH tiếp nhận.</span>
        <span>Số liệu DVBH lúc {cv.tinhLuc}</span>
      </div>
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
          <TheCongViec cv={data.congViec} />
          <TheThongKe thongKe={data.thongKe} />
          <TheGiaiTrinh gt={data.giaiTrinh} />
          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>
              Tỷ lệ nghi ngờ theo loại
            </div>
            <div className="card-meta" style={{ marginBottom: 10 }}>
              <span>
                Tỷ lệ nghi ngờ thành lỗi thật: {data.thongKe.daChot + data.thongKe.daBo > 0 ? `${data.thongKe.tyLeChotLoi}%` : "—"}
              </span>
            </div>
            <BangNghiNgo rows={data.theoLoaiNghiNgo} rong="Không có nghi ngờ nào trong tháng này." />
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>
              Theo kết luận của CSKH
            </div>
            <BangNghiNgo rows={data.theoKetQuaCap1} rong="Không có nghi ngờ nào trong tháng này." />
          </div>
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
