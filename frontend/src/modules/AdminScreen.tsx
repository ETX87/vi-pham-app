import { useEffect, useState } from "react";
import { HardDrive, Users, AlertTriangle, UserCog, ListChecks } from "lucide-react";
import { api } from "../api/client";
import type { AppUser, KtvOption, ViPham } from "../types";
import { loaiLoiLabel } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";

interface DriveStatus {
  connected: boolean;
  google_email?: string;
  folder_id?: string;
  authorized_by?: string;
  authorized_at?: string;
}

interface KtvDirectoryStatus {
  soLuong: number;
  capNhatGanNhat: string | null;
}

const TRANG_THAI_LABEL: Record<AppUser["trang_thai_duyet"], { label: string; cls: string }> = {
  "Cho duyet": { label: "Chờ duyệt", cls: "tag-pending" },
  "Da duyet": { label: "Đã duyệt", cls: "tag-done" },
  "Tu choi": { label: "Từ chối", cls: "tag-pending" },
};

type ViPhamRowTatCa = ViPham & { ten_ktv_khop: string | null };

const TRANG_THAI_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "chua-xu-ly", label: "Chưa xử lý" },
  { value: "dang-cho-dong-bo", label: "Đang chờ đồng bộ" },
  { value: "da-xu-ly", label: "Đã xử lý" },
];

// Muc Admin: xem TOAN BO vi pham he thong (khong loc theo nguoi dang nhap nhu man KTV) - thieu
// phan nay Admin chi thay duoc hang doi "chua xac dinh KTV", khong co cach nao xem tong quan toan
// he (xem phan hoi nguoi dung "admin co nhin thay toan bo khong?"). Khong cho click vao chi tiet vi
// backend GET /giai-trinh/vi-pham/:id chi cho phep chinh chu KTV xem (403 neu Admin xem ho - dung y
// thiet ke rieng tu, khong mo rong o day).
function TatCaViPham({ ktvOptions }: { ktvOptions: KtvOption[] }) {
  const [maKtv, setMaKtv] = useState("");
  const [trangThai, setTrangThai] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: ViPhamRowTatCa[]; total: number; pageSize: number } | null>(null);
  const pageSize = 50;

  function load() {
    setData(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(maKtv ? { ma_ktv: maKtv } : {}),
      ...(trangThai ? { trang_thai: trangThai } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    });
    api
      .get<{ rows: ViPhamRowTatCa[]; total: number; pageSize: number }>(`/admin/vi-pham/tat-ca?${qs.toString()}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0, pageSize }));
  }

  useEffect(load, [page, maKtv, trangThai]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div>
      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ListChecks size={15} /> Tất cả vi phạm {data && <span className="badge">{data.total}</span>}
      </div>
      <div className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <select
            value={maKtv}
            onChange={(e) => {
              setPage(1);
              setMaKtv(e.target.value);
            }}
          >
            <option value="">Tất cả KTV</option>
            {ktvOptions.map((k) => (
              <option key={k.ma_ktv} value={k.ma_ktv}>
                {k.ten_hien_thi ?? k.ma_ktv}
              </option>
            ))}
          </select>
          <select
            value={trangThai}
            onChange={(e) => {
              setPage(1);
              setTrangThai(e.target.value);
            }}
          >
            {TRANG_THAI_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Tìm case/khách hàng/seri..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
            style={{ flex: 1, minWidth: 160 }}
          />
          <button className="btn btn-sm" onClick={() => (setPage(1), load())}>
            Tìm
          </button>
        </div>

        {data === null ? (
          <div className="loading-state">Đang tải...</div>
        ) : data.rows.length === 0 ? (
          <div className="empty-state">Không tìm thấy vi phạm nào.</div>
        ) : (
          <>
            {data.rows.map((vp) => (
              <div key={vp.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 700, marginBottom: 2 }}>#{vp.id}</div>
                    <div className="card-title">{loaiLoiLabel(vp.loai_loi)}</div>
                    <div className="card-meta" style={{ marginTop: 4 }}>
                      {vp.case_id && <span>Case: {vp.case_id}</span>}
                      <span>KTV: {vp.ten_ktv_khop ?? vp.ky_thuat_vien_ten ?? "(chưa xác định)"}</span>
                      {vp.khu_vuc && <span>{vp.khu_vuc}</span>}
                      {vp.khach_hang && <span>KH: {vp.khach_hang}</span>}
                      <span>{vp.ngay_ghi_nhan}</span>
                    </div>
                  </div>
                  <StatusBadge vp={vp} />
                </div>
              </div>
            ))}
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
    </div>
  );
}

// Muc Admin: duyet/tu choi/khoa tai khoan - thieu phan nay thi tai khoan khong tu khop duoc KTV
// (email dang nhap khac email_dang_nhap trong danh ba) ket "Cho duyet" vinh vien, khong ai xu ly
// duoc (xem backend routes/adminUsers.ts + middleware/loadUser.ts).
function QuanLyTaiKhoan() {
  const [tab, setTab] = useState<"cho-duyet" | "tat-ca">("cho-duyet");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AppUser[] | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  function load() {
    setRows(null);
    const qs = new URLSearchParams({ tab, ...(search.trim() ? { search: search.trim() } : {}) });
    api
      .get<{ rows: AppUser[] }>(`/admin/users?${qs.toString()}`)
      .then((r) => setRows(r.rows))
      .catch(() => setRows([]));
  }

  useEffect(load, [tab]);

  async function patch(email: string, body: Partial<Pick<AppUser, "trang_thai_duyet" | "vai_tro" | "bi_khoa">>) {
    setBusyEmail(email);
    try {
      await api.patch(`/admin/users/${encodeURIComponent(email)}`, body);
      load();
    } catch {
      alert("Cập nhật tài khoản thất bại - vui lòng thử lại.");
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div>
      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <UserCog size={15} /> Quản lý tài khoản
      </div>
      <div className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <button className={`btn btn-sm ${tab === "cho-duyet" ? "btn-primary" : ""}`} onClick={() => setTab("cho-duyet")}>
            Chờ duyệt
          </button>
          <button className={`btn btn-sm ${tab === "tat-ca" ? "btn-primary" : ""}`} onClick={() => setTab("tat-ca")}>
            Tất cả
          </button>
          <input
            type="text"
            placeholder="Tìm theo email/tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            style={{ flex: 1, minWidth: 160 }}
          />
          <button className="btn btn-sm" onClick={load}>
            Tìm
          </button>
        </div>

        {rows === null ? (
          <div className="loading-state">Đang tải...</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">{tab === "cho-duyet" ? "Không có tài khoản nào đang chờ duyệt." : "Không tìm thấy tài khoản nào."}</div>
        ) : (
          rows.map((u) => {
            const st = TRANG_THAI_LABEL[u.trang_thai_duyet];
            const busy = busyEmail === u.email;
            return (
              <div key={u.email} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="card-title">{u.ten || u.email}</div>
                    <div className="card-meta" style={{ marginTop: 4 }}>
                      <span>{u.email}</span>
                      {u.vai_tro === "Admin" && <span>Admin</span>}
                    </div>
                  </div>
                  <span className={`tag ${st.cls}`}>{st.label}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {u.trang_thai_duyet !== "Da duyet" && (
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => patch(u.email, { trang_thai_duyet: "Da duyet" })}>
                      Duyệt
                    </button>
                  )}
                  {u.trang_thai_duyet !== "Tu choi" && (
                    <button className="btn btn-sm" disabled={busy} onClick={() => patch(u.email, { trang_thai_duyet: "Tu choi" })}>
                      Từ chối
                    </button>
                  )}
                  {u.trang_thai_duyet === "Da duyet" && (
                    <button className="btn btn-sm" disabled={busy} onClick={() => patch(u.email, { bi_khoa: !u.bi_khoa })}>
                      {u.bi_khoa ? "Mở khóa" : "Khóa"}
                    </button>
                  )}
                  {u.trang_thai_duyet === "Da duyet" && (
                    <button className="btn btn-sm" disabled={busy} onClick={() => patch(u.email, { vai_tro: u.vai_tro === "Admin" ? null : "Admin" })}>
                      {u.vai_tro === "Admin" ? "Bỏ quyền Admin" : "Gán quyền Admin"}
                    </button>
                  )}
                </div>
                {u.bi_khoa === true && <div className="alert alert-error" style={{ marginTop: 8 }}>Tài khoản đang bị khóa - không đăng nhập được.</div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AdminScreen() {
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [ktvStatus, setKtvStatus] = useState<KtvDirectoryStatus | null>(null);

  const [chuaXacDinh, setChuaXacDinh] = useState<ViPham[] | null>(null);
  const [ktvOptions, setKtvOptions] = useState<KtvOption[]>([]);
  const [assigning, setAssigning] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  function loadAll() {
    api.get<DriveStatus>("/settings/google-drive/status").then(setDriveStatus).catch(() => setDriveStatus({ connected: false }));
    api.get<KtvDirectoryStatus>("/settings/ktv-lien-he-status").then(setKtvStatus).catch(() => {});
    api.get<{ rows: ViPham[] }>("/admin/vi-pham/chua-xac-dinh").then((r) => setChuaXacDinh(r.rows)).catch(() => setChuaXacDinh([]));
    api.get<{ rows: KtvOption[] }>("/admin/vi-pham/ktv-options").then((r) => setKtvOptions(r.rows)).catch(() => {});
  }

  useEffect(loadAll, []);

  async function handleAssign(viPhamId: string) {
    const maKtv = assigning[viPhamId];
    if (!maKtv) return;
    setSavingId(viPhamId);
    try {
      await api.patch(`/admin/vi-pham/${viPhamId}/gan-ktv`, { ma_ktv: maKtv });
      setChuaXacDinh((prev) => (prev ? prev.filter((v) => v.id !== viPhamId) : prev));
    } catch {
      alert("Gán KTV thất bại - vui lòng thử lại.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="narrow">
      <div className="section-title" style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <HardDrive size={15} /> Kết nối Google Drive
      </div>
      <div className="card">
        {driveStatus === null ? (
          <div className="loading-state">Đang tải...</div>
        ) : driveStatus.connected ? (
          <div>
            <div className="alert alert-success">Đã kết nối: {driveStatus.google_email}</div>
            <div className="card-meta">Kết nối bởi {driveStatus.authorized_by} lúc {driveStatus.authorized_at}</div>
          </div>
        ) : (
          <div>
            <div className="alert alert-info">Chưa kết nối Google Drive - ảnh bằng chứng giải trình sẽ không tải lên được.</div>
            <a className="btn btn-primary btn-sm" href="/api/settings/google-drive/authorize">
              Kết nối Google Drive
            </a>
          </div>
        )}
      </div>

      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Users size={15} /> Danh bạ KTV (linh-kien-app tự đẩy sang mỗi giờ)
      </div>
      <div className="card">
        <div className="card-meta">
          <span>Số lượng KTV: {ktvStatus?.soLuong ?? "…"}</span>
          <span>Cập nhật gần nhất: {ktvStatus?.capNhatGanNhat ?? "chưa từng"}</span>
        </div>
        {ktvStatus && ktvStatus.soLuong === 0 && (
          <div className="alert alert-info" style={{ marginTop: 10 }}>
            Chưa nhận được dữ liệu KTV nào — kiểm tra lại secret <code>KTV_SYNC_API_KEY</code> đã cấu
            hình khớp giữa 2 hệ và cron đồng bộ bên linh-kien-app đã chạy chưa.
          </div>
        )}
      </div>

      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <AlertTriangle size={15} /> Chưa xác định KTV {chuaXacDinh && chuaXacDinh.length > 0 && <span className="badge">{chuaXacDinh.length}</span>}
      </div>
      {chuaXacDinh === null ? (
        <div className="loading-state">Đang tải...</div>
      ) : chuaXacDinh.length === 0 ? (
        <div className="empty-state">Không có vi phạm nào đang chờ gán KTV.</div>
      ) : (
        chuaXacDinh.map((vp) => (
          <div key={vp.id} className="card">
            <div className="card-title">{loaiLoiLabel(vp.loai_loi)}</div>
            <div className="card-meta" style={{ marginBottom: 10 }}>
              {vp.case_id && <span>Case: {vp.case_id}</span>}
              <span>Tên KTV (thô từ DVBH): {vp.ky_thuat_vien_ten || "(trống)"}</span>
              <span>Ghi nhận: {vp.ngay_ghi_nhan}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={assigning[vp.id] ?? ""}
                onChange={(e) => setAssigning((prev) => ({ ...prev, [vp.id]: e.target.value }))}
              >
                <option value="">-- Chọn KTV --</option>
                {ktvOptions.map((k) => (
                  <option key={k.ma_ktv} value={k.ma_ktv}>
                    {k.ten_hien_thi ?? k.ma_ktv} ({k.ma_ktv})
                  </option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" disabled={!assigning[vp.id] || savingId === vp.id} onClick={() => handleAssign(vp.id)}>
                {savingId === vp.id ? "Đang lưu..." : "Gán"}
              </button>
            </div>
          </div>
        ))
      )}

      <TatCaViPham ktvOptions={ktvOptions} />
      <QuanLyTaiKhoan />
    </div>
  );
}
