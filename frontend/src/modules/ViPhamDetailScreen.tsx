import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Clock, MapPin, Tag, User, Edit3, Send } from "lucide-react";
import { api, ApiError } from "../api/client";
import type { GiaiTrinh, ViPham } from "../types";
import { CaseLookupPanel } from "./CaseLookupPanel";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { loaiLoiLabel, ketQuaCap1Label } from "../lib/format";
import { LoaiLoiHelp } from "../components/LoaiLoiHelp";
import { KetQuaCap1Help } from "../components/KetQuaCap1Help";

const MAX_ANH = 5;
const MAX_CHARS = 1000;

interface DetailResponse {
  viPham: ViPham;
  giaiTrinh: GiaiTrinh[];
}

interface PhotoDraft {
  localId: string;
  thumbnailUrl: string;
}

export function ViPhamDetailScreen({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged?: () => void }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "form">("view");

  const [noiDung, setNoiDung] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; dongBoThanhCong?: boolean; error?: string } | null>(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    api
      .get<DetailResponse>(`/giai-trinh/vi-pham/${id}`)
      .then(setData)
      .catch(() => setLoadError("Không tải được chi tiết vi phạm."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function uploadFiles(files: File[]) {
    const remain = MAX_ANH - photos.length;
    if (remain <= 0) return;
    setUploading(true);
    try {
      for (const file of files.slice(0, remain)) {
        const bytes = await file.arrayBuffer();
        const { thumbnailUrl } = await api.postBinary<{ thumbnailUrl: string }>(`/giai-trinh/vi-pham/${id}/anh`, bytes, file.type || "image/jpeg");
        setPhotos((prev) => [...prev, { localId: crypto.randomUUID(), thumbnailUrl }]);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.detail ?? err.code ?? "Tải ảnh thất bại." : "Tải ảnh thất bại.";
      alert(message);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(localId: string) {
    setPhotos((prev) => prev.filter((p) => p.localId !== localId));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await api.post<{ ok: boolean; id: string; dongBoThanhCong: boolean }>(`/giai-trinh/vi-pham/${id}/giai-trinh`, {
        noi_dung_giai_trinh: noiDung.trim() || null,
        ghi_chu: ghiChu.trim() || null,
        anh_urls: photos.map((p) => p.thumbnailUrl),
      });
      setSubmitResult({ ok: true, dongBoThanhCong: res.dongBoThanhCong });
      load();
      onChanged?.();
      setMode("view");
    } catch {
      setSubmitResult({ ok: false, error: "Không thể lưu giải trình - vui lòng thử lại." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading-state">Đang tải...</div>;
  if (loadError || !data) return <div className="alert alert-error">{loadError ?? "Không có dữ liệu."}</div>;

  const { viPham, giaiTrinh } = data;
  const daNop = giaiTrinh.length > 0;
  const tieuDe = loaiLoiLabel(viPham.loai_loi);

  // ---------- Man con "Tao giai trinh" ----------
  if (mode === "form") {
    return (
      <div className="narrow">
        <div className="detail-header">
          <button className="detail-back" onClick={() => setMode("view")}>
            <ArrowLeft size={20} />
          </button>
          <div className="detail-title">Tạo giải trình</div>
        </div>

        <div className="card">
          <div style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 700, marginBottom: 2 }}>#{viPham.id}</div>
          <div className="card-title card-title-row" style={{ marginBottom: 0 }}>
            {tieuDe}
            <LoaiLoiHelp maLoi={viPham.loai_loi} tenHienThi={tieuDe} />
          </div>
        </div>

        <div className="field">
          <label className="field-label">Lý do giải trình *</label>
          <textarea rows={5} maxLength={MAX_CHARS} value={noiDung} onChange={(e) => setNoiDung(e.target.value)} placeholder="Nhập lý do giải trình của bạn..." />
          <div className="char-counter">
            {noiDung.length}/{MAX_CHARS}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Đính kèm hình ảnh (tối đa {MAX_ANH} ảnh)</label>
          {photos.length < MAX_ANH && (
            <div
              className={`dropzone ${dragOver ? "drag-over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                uploadFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
              }}
            >
              <div className="dropzone-icon">
                <Camera size={26} />
              </div>
              <div className="dropzone-title">{uploading ? "Đang tải lên..." : "Nhấn để chọn ảnh"}</div>
              <div className="dropzone-sub">hoặc kéo thả vào đây</div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                style={{ display: "none" }}
                disabled={uploading}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length) uploadFiles(files);
                }}
              />
            </div>
          )}
          {photos.length > 0 && (
            <div className="photo-grid" style={{ marginTop: 10 }}>
              {photos.map((p) => (
                <div key={p.localId} className="photo-thumb">
                  <img src={p.thumbnailUrl} alt="Ảnh bằng chứng" />
                  <button className="remove-btn" onClick={() => removePhoto(p.localId)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="char-counter">{photos.length}/{MAX_ANH}</div>
        </div>

        <div className="field">
          <label className="field-label">Ghi chú thêm (không bắt buộc)</label>
          <textarea rows={2} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
        </div>

        <button className="btn btn-primary" disabled={submitting || (!noiDung.trim() && photos.length === 0)} onClick={handleSubmit}>
          <Send size={16} /> {submitting ? "Đang gửi..." : "Gửi giải trình"}
        </button>
      </div>
    );
  }

  // ---------- Man xem chi tiet ----------
  return (
    <div className="narrow">
      <div className="detail-header" style={{ justifyContent: "space-between", flexWrap: "wrap", rowGap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button className="detail-back" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <div className="detail-title">Chi tiết vi phạm</div>
        </div>
        <StatusBadge vp={viPham} />
      </div>

      {viPham.chot_bo_cap_2 !== null && (
        <div className={viPham.chot_bo_cap_2 ? "alert alert-error" : "alert alert-success"}>
          QC đã {viPham.chot_bo_cap_2 ? "XÁC NHẬN đây là vi phạm" : "BỎ (không tính vi phạm)"}
          {viPham.nguoi_chot ? ` — ${viPham.nguoi_chot}` : ""}
          {viPham.ngay_chot ? `, lúc ${viPham.ngay_chot}` : ""}
        </div>
      )}

      <div className="card">
        <div style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 700, marginBottom: 2 }}>#{viPham.id}</div>
        <div className="card-title card-title-row" style={{ fontSize: 17, marginBottom: 10 }}>
          {tieuDe}
          <LoaiLoiHelp maLoi={viPham.loai_loi} tenHienThi={tieuDe} />
        </div>

        <div className="icon-row">
          <span className="icon-row-icon">
            <Clock size={16} />
          </span>
          <div>
            <div className="icon-row-label">Thời gian</div>
            <div className="icon-row-value">{viPham.ngay_ghi_nhan}</div>
          </div>
        </div>
        {viPham.khu_vuc && (
          <div className="icon-row">
            <span className="icon-row-icon">
              <MapPin size={16} />
            </span>
            <div>
              <div className="icon-row-label">Khu vực</div>
              <div className="icon-row-value">{viPham.khu_vuc}</div>
            </div>
          </div>
        )}
        {viPham.ket_qua_cap_1 && (
          <div className="icon-row">
            <span className="icon-row-icon">
              <Tag size={16} />
            </span>
            <div>
              <div className="icon-row-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                CSKH kết luận loại lỗi
                <KetQuaCap1Help ma={viPham.ket_qua_cap_1} tenHienThi={ketQuaCap1Label(viPham.ket_qua_cap_1)} />
              </div>
              <div className="icon-row-value">{ketQuaCap1Label(viPham.ket_qua_cap_1)}</div>
            </div>
          </div>
        )}
        <div className="icon-row">
          <span className="icon-row-icon">
            <User size={16} />
          </span>
          <div>
            <div className="icon-row-label">Người ghi nhận</div>
            <div className="icon-row-value">{viPham.nguoi_ghi_nhan}</div>
          </div>
        </div>
        {viPham.khach_hang && (
          <div className="icon-row">
            <span className="icon-row-icon">
              <User size={16} />
            </span>
            <div>
              <div className="icon-row-label">Khách hàng</div>
              <div className="icon-row-value">{viPham.khach_hang}</div>
            </div>
          </div>
        )}
        {viPham.seri_san_pham && (
          <div className="icon-row">
            <span className="icon-row-icon">
              <Tag size={16} />
            </span>
            <div>
              <div className="icon-row-label">Seri sản phẩm</div>
              <div className="icon-row-value">{viPham.seri_san_pham}</div>
            </div>
          </div>
        )}
        {viPham.case_id && (
          <div className="icon-row">
            <span className="icon-row-icon">
              <Tag size={16} />
            </span>
            <div>
              <div className="icon-row-label">Case</div>
              <button className="link-btn" onClick={() => setShowCaseModal(true)}>
                {viPham.case_id}
              </button>
            </div>
          </div>
        )}
      </div>

      {showCaseModal && viPham.case_id && (
        <Modal onClose={() => setShowCaseModal(false)}>
          <CaseLookupPanel viPhamId={id} />
        </Modal>
      )}

      {daNop ? (
        <div>
          <div className="section-title">Giải trình đã nộp</div>
          {giaiTrinh.map((gt) => {
            const anhUrls: string[] = JSON.parse(gt.anh_urls || "[]");
            return (
              <div key={gt.id} className="card">
                <div className="card-meta" style={{ marginBottom: 8 }}>
                  <span>Ngày giải trình: {gt.ngay_giai_trinh}</span>
                  {gt.nguon === "giam_sat_dvbh" ? (
                    <span className="tag tag-syncing">Giám sát nhập thay (trên DVBH)</span>
                  ) : gt.dong_bo_dvbh_luc ? (
                    <span className="tag tag-done">Đã đồng bộ về DVBH</span>
                  ) : (
                    <span className="tag tag-syncing">Đang chờ đồng bộ</span>
                  )}
                </div>
                {gt.noi_dung_giai_trinh && <div style={{ fontSize: 14, marginBottom: 8 }}>{gt.noi_dung_giai_trinh}</div>}
                {gt.ghi_chu && <div style={{ fontSize: 13, color: "var(--ink-600)", marginBottom: 8 }}>Ghi chú: {gt.ghi_chu}</div>}
                {anhUrls.length > 0 && (
                  <div className="photo-grid">
                    {anhUrls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="photo-thumb">
                        <img src={url} alt="Ảnh bằng chứng" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {submitResult?.ok && (
            <div className={submitResult.dongBoThanhCong ? "alert alert-success" : "alert alert-info"}>
              {submitResult.dongBoThanhCong ? "Đã lưu và gửi kết quả về DVBH thành công." : "Đã lưu giải trình - đang chờ đồng bộ về DVBH (hệ thống sẽ tự thử lại)."}
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setMode("form")}>
            <Edit3 size={16} /> Tạo giải trình
          </button>
        </div>
      )}
    </div>
  );
}
