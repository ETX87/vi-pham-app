import { useEffect, useState } from "react";
import { HardDrive, Users, AlertTriangle, UserCog, ListChecks, HelpCircle, Plus, Pencil, ChevronRight, ExternalLink } from "lucide-react";
import { api, ApiError } from "../api/client";
import type { AppUser, KetQuaCap1DinhNghia, KtvOption, LoaiLoiDinhNghia, ViPham } from "../types";
import { loaiLoiLabel } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import { KtvCombobox } from "../components/KtvCombobox";
import { LoaiLoiHelp } from "../components/LoaiLoiHelp";
import { useLoaiLoiMap } from "../contexts/LoaiLoiContext";
import { useKetQuaCap1Map } from "../contexts/KetQuaCap1Context";
import { ViPhamDetailScreen } from "./ViPhamDetailScreen";

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
  { value: "chua-giai-trinh", label: "Chưa giải trình" },
  { value: "qua-han", label: "Quá hạn giải trình" },
  { value: "cho-chot-loi", label: "Chờ chốt lỗi" },
  { value: "da-chot-loi", label: "Đã chốt lỗi" },
];

// Muc Admin: xem TOAN BO vi pham he thong (khong loc theo nguoi dang nhap nhu man KTV) - thieu
// phan nay Admin chi thay duoc hang doi "chua xac dinh KTV", khong co cach nao xem tong quan toan
// he (xem phan hoi nguoi dung "admin co nhin thay toan bo khong?"). Card bam duoc de xem chi tiet
// (readOnly, giong KTV dang xem - xem phan hoi nguoi dung "cho phep click vao card vi pham de xem
// noi dung ben trong nhu ktv dang xem") - backend GET /giai-trinh/vi-pham/:id da mo cho Admin xem
// CUA BAT KY KTV nao (xem duocXemViPham() trong routes/giaiTrinh.ts), rieng nop giai trinh thay KTV
// van KHONG duoc phep.
function TatCaViPham({ ktvOptions, onSelect }: { ktvOptions: KtvOption[]; onSelect: (id: string) => void }) {
  const [maKtv, setMaKtv] = useState("");
  const [trangThai, setTrangThai] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: ViPhamRowTatCa[]; total: number; pageSize: number } | null>(null);
  const pageSize = 10;

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
          <KtvCombobox
            value={maKtv}
            onChange={(v) => {
              setPage(1);
              setMaKtv(v);
            }}
            options={ktvOptions}
            allLabel="Tất cả KTV"
            containerStyle={{ flex: "1 1 200px" }}
          />
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
              <div key={vp.id} className="card card-clickable" style={{ marginBottom: 8 }} onClick={() => onSelect(vp.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 700, marginBottom: 2 }}>#{vp.id}</div>
                    <div className="card-title card-title-row">
                      {loaiLoiLabel(vp.loai_loi)}
                      <LoaiLoiHelp maLoi={vp.loai_loi} tenHienThi={loaiLoiLabel(vp.loai_loi)} />
                    </div>
                    <div className="card-meta" style={{ marginTop: 4 }}>
                      {vp.case_id && <span>Case: {vp.case_id}</span>}
                      <span>KTV: {vp.ten_ktv_khop || vp.ky_thuat_vien_ten || "(chưa xác định)"}</span>
                      {vp.khu_vuc && <span>{vp.khu_vuc}</span>}
                      {vp.khach_hang && <span>KH: {vp.khach_hang}</span>}
                      <span>{vp.ngay_ghi_nhan}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <StatusBadge vp={vp} />
                    <ChevronRight size={18} color="var(--ink-400)" />
                  </div>
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
const TAI_KHOAN_TAB_OPTIONS: { value: "cho-duyet" | "da-duyet" | "tu-choi" | "tat-ca"; label: string }[] = [
  { value: "cho-duyet", label: "Chờ duyệt" },
  { value: "da-duyet", label: "Đã duyệt" },
  { value: "tu-choi", label: "Từ chối" },
  { value: "tat-ca", label: "Tất cả" },
];

// Danh ba KTV (ktv_lien_he) o vi-pham-app CHI la cache doc-only, bi linh-kien-app ghi de toan bo moi
// gio - gan/doi lai email_dang_nhap PHAI sua tai nguon (linh-kien-app), khong the sua tam thoi o day
// (se mat trong vong 1 tieng khi cron sync tiep theo chay). Nut duoi day chi MO SANG dung tab "KTV
// hien truong" cua linh-kien-app, tim san theo email de Admin sua nhanh, khong tu ghi gi ca.
const LINH_KIEN_APP_URL = "https://linhkien.dichvu3t.workers.dev";
function moLinkSuaKtv(email: string) {
  window.open(`${LINH_KIEN_APP_URL}/?ktvSearch=${encodeURIComponent(email)}`, "_blank", "noopener,noreferrer");
}

function QuanLyTaiKhoan() {
  const [tab, setTab] = useState<"cho-duyet" | "da-duyet" | "tu-choi" | "tat-ca">("cho-duyet");
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
          {TAI_KHOAN_TAB_OPTIONS.map((o) => (
            <button key={o.value} className={`btn btn-sm ${tab === o.value ? "btn-primary" : ""}`} onClick={() => setTab(o.value)}>
              {o.label}
            </button>
          ))}
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
                    {u.ma_ktv_tu_khai && (
                      <div className="card-meta" style={{ marginTop: 2 }}>
                        <span>Mã KTV tự khai: {u.ma_ktv_tu_khai}</span>
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      {u.khop_ma_ktv ? (
                        <span className="tag tag-done">
                          Đang khớp KTV: {u.khop_ten_ktv || u.khop_ma_ktv} ({u.khop_ma_ktv})
                        </span>
                      ) : (
                        <span className="tag tag-pending">Chưa khớp KTV nào trong danh bạ</span>
                      )}
                    </div>
                  </div>
                  <span className={`tag ${st.cls}`}>{st.label}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => moLinkSuaKtv(u.email)}>
                    <ExternalLink size={13} /> {u.khop_ma_ktv ? "Gán lại KTV" : "Gán KTV"} (Đặt mua linh kiện)
                  </button>
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

// Muc Admin: dinh nghia ten hien thi + mo ta chi tiet cho tung loai_loi (migration 0005) - de KTV
// bam dau (?) tren card vi pham hieu ro dang bi vi pham gi (truoc gio chi thay ten ngan gon, xem
// phan hoi nguoi dung "hien tai chi hien ten nen KTV khong hieu loi gi"). "ma" phai go dung CHINH
// XAC chuoi vi_pham.loai_loi tho DVBH gui (vd "Loi 120 phut") thi tooltip moi tra ra dung mo ta -
// doi chieu qua cot ten loi hien trong "Tat ca vi pham"/card cua KTV neu can loai moi chua co san.
function QuanLyLoaiLoi() {
  const { map, reload } = useLoaiLoiMap();
  const rows = Object.values(map).sort((a, b) => a.ten_hien_thi.localeCompare(b.ten_hien_thi, "vi"));

  const [editingMa, setEditingMa] = useState<string | null>(null);
  const [editTen, setEditTen] = useState("");
  const [editMoTa, setEditMoTa] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newMa, setNewMa] = useState("");
  const [newTen, setNewTen] = useState("");
  const [newMoTa, setNewMoTa] = useState("");
  const [adding, setAdding] = useState(false);

  function startEdit(row: LoaiLoiDinhNghia) {
    setEditingMa(row.ma);
    setEditTen(row.ten_hien_thi);
    setEditMoTa(row.mo_ta);
  }

  async function saveEdit(ma: string) {
    if (!editTen.trim() || !editMoTa.trim()) return;
    setSavingEdit(true);
    try {
      await api.patch(`/loai-loi/${encodeURIComponent(ma)}`, { ten_hien_thi: editTen.trim(), mo_ta: editMoTa.trim() });
      setEditingMa(null);
      reload();
    } catch {
      alert("Cập nhật thất bại - vui lòng thử lại.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAdd() {
    if (!newMa.trim() || !newTen.trim() || !newMoTa.trim()) return;
    setAdding(true);
    try {
      await api.post("/loai-loi", { ma: newMa.trim(), ten_hien_thi: newTen.trim(), mo_ta: newMoTa.trim() });
      setNewMa("");
      setNewTen("");
      setNewMoTa("");
      setShowAdd(false);
      reload();
    } catch (err) {
      alert(err instanceof ApiError && err.code === "DA_TON_TAI" ? "Mã lỗi này đã tồn tại." : "Thêm thất bại - vui lòng thử lại.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(ma: string) {
    if (!confirm("Xóa mô tả loại lỗi này? (không ảnh hưởng các vi phạm đã ghi nhận, chỉ ẩn dấu (?) mô tả)")) return;
    try {
      await api.delete(`/loai-loi/${encodeURIComponent(ma)}`);
      reload();
    } catch {
      alert("Xóa thất bại - vui lòng thử lại.");
    }
  }

  return (
    <div>
      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <HelpCircle size={15} /> Loại nghi ngờ &amp; mô tả
      </div>
      <div className="card">
        <div className="card-meta" style={{ marginBottom: 10 }}>
          Nội dung ở đây hiện khi KTV bấm dấu (?) cạnh tên lỗi trên card vi phạm.
        </div>
        {rows.map((row) => {
          const isEditing = editingMa === row.ma;
          return (
            <div key={row.ma} className="card" style={{ marginBottom: 8 }}>
              {isEditing ? (
                <div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label className="field-label">Tên hiển thị</label>
                    <input type="text" value={editTen} onChange={(e) => setEditTen(e.target.value)} />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label className="field-label">Mô tả</label>
                    <textarea rows={3} value={editMoTa} onChange={(e) => setEditMoTa(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" disabled={savingEdit} onClick={() => saveEdit(row.ma)}>
                      {savingEdit ? "Đang lưu..." : "Lưu"}
                    </button>
                    <button className="btn btn-sm" disabled={savingEdit} onClick={() => setEditingMa(null)}>
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="card-title">{row.ten_hien_thi}</div>
                      <div className="card-meta" style={{ marginBottom: 6 }}>
                        <span>Mã khớp: {row.ma}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--ink-600)" }}>{row.mo_ta}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-sm" onClick={() => startEdit(row)} aria-label="Sửa">
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-sm" onClick={() => handleDelete(row.ma)} aria-label="Xóa">
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div className="empty-state">Chưa có loại lỗi nào được mô tả.</div>}

        {showAdd ? (
          <div className="card" style={{ marginTop: 8 }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label className="field-label">Mã lỗi (khớp đúng "loại lỗi" DVBH gửi sang, vd: Loi 120 phut)</label>
              <input type="text" value={newMa} onChange={(e) => setNewMa(e.target.value)} placeholder="Loi 120 phut" />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label className="field-label">Tên hiển thị</label>
              <input type="text" value={newTen} onChange={(e) => setNewTen(e.target.value)} placeholder="Lỗi 120 phút" />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label className="field-label">Mô tả</label>
              <textarea rows={3} value={newMoTa} onChange={(e) => setNewMoTa(e.target.value)} placeholder="Giải thích lỗi này để KTV hiểu rõ..." />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={adding} onClick={handleAdd}>
                {adding ? "Đang lưu..." : "Thêm"}
              </button>
              <button className="btn btn-sm" disabled={adding} onClick={() => setShowAdd(false)}>
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-sm" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Thêm loại lỗi
          </button>
        )}
      </div>
    </div>
  );
}

// Muc Admin: dinh nghia ten hien thi + mo ta chi tiet cho tung ket_qua_cap_1 ("CSKH ket luan loai
// loi" - ket luan CSKH dua ra SAU khi xac minh voi khach hang, khac loai_loi la loai NGHI NGO ban
// dau tu DVBH gui, xem QuanLyLoaiLoi() o tren + migration 0007). Cau truc giong het QuanLyLoaiLoi(),
// chi khac endpoint + noi dung hien thi.
function QuanLyKetQuaCap1() {
  const { map, reload } = useKetQuaCap1Map();
  const rows = Object.values(map).sort((a, b) => a.ten_hien_thi.localeCompare(b.ten_hien_thi, "vi"));

  const [editingMa, setEditingMa] = useState<string | null>(null);
  const [editTen, setEditTen] = useState("");
  const [editMoTa, setEditMoTa] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newMa, setNewMa] = useState("");
  const [newTen, setNewTen] = useState("");
  const [newMoTa, setNewMoTa] = useState("");
  const [adding, setAdding] = useState(false);

  function startEdit(row: KetQuaCap1DinhNghia) {
    setEditingMa(row.ma);
    setEditTen(row.ten_hien_thi);
    setEditMoTa(row.mo_ta);
  }

  async function saveEdit(ma: string) {
    if (!editTen.trim() || !editMoTa.trim()) return;
    setSavingEdit(true);
    try {
      await api.patch(`/ket-qua-cap-1/${encodeURIComponent(ma)}`, { ten_hien_thi: editTen.trim(), mo_ta: editMoTa.trim() });
      setEditingMa(null);
      reload();
    } catch {
      alert("Cập nhật thất bại - vui lòng thử lại.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAdd() {
    if (!newMa.trim() || !newTen.trim() || !newMoTa.trim()) return;
    setAdding(true);
    try {
      await api.post("/ket-qua-cap-1", { ma: newMa.trim(), ten_hien_thi: newTen.trim(), mo_ta: newMoTa.trim() });
      setNewMa("");
      setNewTen("");
      setNewMoTa("");
      setShowAdd(false);
      reload();
    } catch (err) {
      alert(err instanceof ApiError && err.code === "DA_TON_TAI" ? "Mã kết luận này đã tồn tại." : "Thêm thất bại - vui lòng thử lại.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(ma: string) {
    if (!confirm("Xóa mô tả kết luận này? (không ảnh hưởng các vi phạm đã ghi nhận, chỉ ẩn dấu (?) mô tả)")) return;
    try {
      await api.delete(`/ket-qua-cap-1/${encodeURIComponent(ma)}`);
      reload();
    } catch {
      alert("Xóa thất bại - vui lòng thử lại.");
    }
  }

  return (
    <div>
      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <HelpCircle size={15} /> Lỗi vi phạm &amp; mô tả
      </div>
      <div className="card">
        <div className="card-meta" style={{ marginBottom: 10 }}>
          Nội dung ở đây hiện khi KTV bấm dấu (?) cạnh "CSKH kết luận loại lỗi" trên chi tiết vi phạm.
        </div>
        {rows.map((row) => {
          const isEditing = editingMa === row.ma;
          return (
            <div key={row.ma} className="card" style={{ marginBottom: 8 }}>
              {isEditing ? (
                <div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label className="field-label">Tên hiển thị</label>
                    <input type="text" value={editTen} onChange={(e) => setEditTen(e.target.value)} />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label className="field-label">Mô tả</label>
                    <textarea rows={3} value={editMoTa} onChange={(e) => setEditMoTa(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" disabled={savingEdit} onClick={() => saveEdit(row.ma)}>
                      {savingEdit ? "Đang lưu..." : "Lưu"}
                    </button>
                    <button className="btn btn-sm" disabled={savingEdit} onClick={() => setEditingMa(null)}>
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="card-title">{row.ten_hien_thi}</div>
                      <div className="card-meta" style={{ marginBottom: 6 }}>
                        <span>Mã khớp: {row.ma}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--ink-600)" }}>{row.mo_ta}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-sm" onClick={() => startEdit(row)} aria-label="Sửa">
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-sm" onClick={() => handleDelete(row.ma)} aria-label="Xóa">
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div className="empty-state">Chưa có kết luận nào được mô tả.</div>}

        {showAdd ? (
          <div className="card" style={{ marginTop: 8 }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label className="field-label">Mã kết luận (khớp đúng "ket_qua_cap_1" DVBH gửi sang, vd: Loi khong lien he)</label>
              <input type="text" value={newMa} onChange={(e) => setNewMa(e.target.value)} placeholder="Loi khong lien he" />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label className="field-label">Tên hiển thị</label>
              <input type="text" value={newTen} onChange={(e) => setNewTen(e.target.value)} placeholder="Lỗi không liên hệ" />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label className="field-label">Mô tả</label>
              <textarea rows={3} value={newMoTa} onChange={(e) => setNewMoTa(e.target.value)} placeholder="Giải thích kết luận này để KTV hiểu rõ..." />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={adding} onClick={handleAdd}>
                {adding ? "Đang lưu..." : "Thêm"}
              </button>
              <button className="btn btn-sm" disabled={adding} onClick={() => setShowAdd(false)}>
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-sm" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Thêm kết luận
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [ktvStatus, setKtvStatus] = useState<KtvDirectoryStatus | null>(null);

  const CHUA_XAC_DINH_PAGE_SIZE = 10;
  const [chuaXacDinh, setChuaXacDinh] = useState<ViPham[] | null>(null);
  const [chuaXacDinhTotal, setChuaXacDinhTotal] = useState(0);
  const [chuaXacDinhPage, setChuaXacDinhPage] = useState(1);
  const [ktvOptions, setKtvOptions] = useState<KtvOption[]>([]);
  const [assigning, setAssigning] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ignoringId, setIgnoringId] = useState<string | null>(null);

  function loadChuaXacDinh() {
    setChuaXacDinh(null);
    api
      .get<{ rows: ViPham[]; total: number }>(`/admin/vi-pham/chua-xac-dinh?page=${chuaXacDinhPage}`)
      .then((r) => {
        setChuaXacDinh(r.rows);
        setChuaXacDinhTotal(r.total);
      })
      .catch(() => {
        setChuaXacDinh([]);
        setChuaXacDinhTotal(0);
      });
  }

  useEffect(() => {
    api.get<DriveStatus>("/settings/google-drive/status").then(setDriveStatus).catch(() => setDriveStatus({ connected: false }));
    api.get<KtvDirectoryStatus>("/settings/ktv-lien-he-status").then(setKtvStatus).catch(() => {});
    api.get<{ rows: KtvOption[] }>("/admin/vi-pham/ktv-options").then((r) => setKtvOptions(r.rows)).catch(() => {});
  }, []);

  useEffect(loadChuaXacDinh, [chuaXacDinhPage]);

  // Sau khi gan/bo qua lam mat 1 (hoac nhieu, vd gan hang loat) dong khoi trang dang xem - neu trang
  // hien tai het sach VA khong phai trang 1 thi lui ve trang truoc (effect o tren se tu tai lai), con
  // lai thi tai lai CHINH trang dang xem (tong so + cac dong con lai co the da doi).
  function refreshChuaXacDinhSauThayDoi(soDongMat: number) {
    const conLaiTrenTrang = (chuaXacDinh?.length ?? 0) - soDongMat;
    if (conLaiTrenTrang <= 0 && chuaXacDinhPage > 1) setChuaXacDinhPage((p) => p - 1);
    else loadChuaXacDinh();
  }

  async function handleAssign(viPhamId: string) {
    const maKtv = assigning[viPhamId];
    if (!maKtv) return;
    setSavingId(viPhamId);
    try {
      const res = await api.patch<{ ok: boolean; soLuongDaGan: number }>(`/admin/vi-pham/${viPhamId}/gan-ktv`, { ma_ktv: maKtv });
      if (res.soLuongDaGan > 1) alert(`Đã tự động gán ${res.soLuongDaGan} vi phạm cùng tên KTV này.`);
      refreshChuaXacDinhSauThayDoi(res.soLuongDaGan);
    } catch {
      alert("Gán KTV thất bại - vui lòng thử lại.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleIgnore(viPhamId: string) {
    setIgnoringId(viPhamId);
    try {
      await api.patch(`/admin/vi-pham/${viPhamId}/bo-qua-gan-ktv`);
      refreshChuaXacDinhSauThayDoi(1);
    } catch {
      alert("Bỏ qua thất bại - vui lòng thử lại.");
    } finally {
      setIgnoringId(null);
    }
  }

  const chuaXacDinhTotalPages = Math.max(1, Math.ceil(chuaXacDinhTotal / CHUA_XAC_DINH_PAGE_SIZE));

  // Admin bam vao 1 card trong "Tat ca vi pham" -> xem chi tiet READ-ONLY (giong KTV dang xem, xem
  // phan hoi nguoi dung) thay vi toan bo dashboard Admin - back() quay lai dashboard, KHONG doi tab.
  if (selectedId) {
    return <ViPhamDetailScreen id={selectedId} onBack={() => setSelectedId(null)} readOnly />;
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

      <div className="section-title" style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Users size={15} /> Danh bạ KTV
        </span>
        <span style={{ fontWeight: 400, color: "var(--ink-400)", fontSize: 12 }}>(linh-kien-app tự đẩy sang mỗi giờ)</span>
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

      <QuanLyLoaiLoi />
      <QuanLyKetQuaCap1 />

      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <AlertTriangle size={15} /> Chưa xác định KTV {chuaXacDinhTotal > 0 && <span className="badge">{chuaXacDinhTotal}</span>}
      </div>
      {chuaXacDinh === null ? (
        <div className="loading-state">Đang tải...</div>
      ) : chuaXacDinh.length === 0 ? (
        <div className="empty-state">Không có vi phạm nào đang chờ gán KTV.</div>
      ) : (
        <>
          {chuaXacDinh.map((vp) => (
            <div key={vp.id} className="card">
              <div className="card-title card-title-row">
                {loaiLoiLabel(vp.loai_loi)}
                <LoaiLoiHelp maLoi={vp.loai_loi} tenHienThi={loaiLoiLabel(vp.loai_loi)} />
              </div>
              <div className="card-meta" style={{ marginBottom: 10 }}>
                {vp.case_id && <span>Case: {vp.case_id}</span>}
                <span>Tên KTV (thô từ DVBH): {vp.ky_thuat_vien_ten || "(trống)"}</span>
                <span>Ghi nhận: {vp.ngay_ghi_nhan}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <KtvCombobox
                  value={assigning[vp.id] ?? ""}
                  onChange={(v) => setAssigning((prev) => ({ ...prev, [vp.id]: v }))}
                  options={ktvOptions}
                  placeholder="-- Chọn KTV --"
                  containerStyle={{ flex: "1 1 200px" }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flexShrink: 0 }}
                  disabled={!assigning[vp.id] || savingId === vp.id}
                  onClick={() => handleAssign(vp.id)}
                >
                  {savingId === vp.id ? "Đang lưu..." : "Gán"}
                </button>
                <button className="btn btn-sm" style={{ flexShrink: 0 }} disabled={ignoringId === vp.id} onClick={() => handleIgnore(vp.id)}>
                  {ignoringId === vp.id ? "Đang lưu..." : "Bỏ qua"}
                </button>
              </div>
            </div>
          ))}
          {chuaXacDinhTotalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", marginTop: 10, marginBottom: 20 }}>
              <button className="btn btn-sm" disabled={chuaXacDinhPage <= 1} onClick={() => setChuaXacDinhPage((p) => p - 1)}>
                Trước
              </button>
              <span className="card-meta">
                Trang {chuaXacDinhPage}/{chuaXacDinhTotalPages}
              </span>
              <button className="btn btn-sm" disabled={chuaXacDinhPage >= chuaXacDinhTotalPages} onClick={() => setChuaXacDinhPage((p) => p + 1)}>
                Sau
              </button>
            </div>
          )}
        </>
      )}

      <TatCaViPham ktvOptions={ktvOptions} onSelect={setSelectedId} />
      <QuanLyTaiKhoan />
    </div>
  );
}
