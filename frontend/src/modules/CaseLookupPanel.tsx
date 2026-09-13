import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { api, ApiError } from "../api/client";
import type { CaseLookupCache, CaseLookupPreview } from "../types";

function formatTien(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("vi-VN") + " đ";
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="kv-item">
      <div className="kv-label">{label}</div>
      <div className="kv-value">{value}</div>
    </div>
  );
}

interface FieldDef {
  label: string;
  value: string | null | undefined;
}

// 1 khoi = 1 nhom field lien quan (goi y nhom trong UI_SPEC.md muc 4.3) - AN CA KHOI (khong chi tung
// o) neu khong co field nao trong nhom co gia tri, tranh hien tieu de khoi troi mot minh.
function FieldGroup({ title, fields }: { title: string; fields: FieldDef[] }) {
  const visible = fields.filter((f) => !!f.value);
  if (visible.length === 0) return null;
  return (
    <div className="kv-group">
      <div className="kv-group-title">{title}</div>
      <div className="kv-grid">
        {visible.map((f) => (
          <Field key={f.label} label={f.label} value={f.value} />
        ))}
      </div>
    </div>
  );
}

// Man tra cuu thong tin GOC cua case tu DVBH (GET /api/partner/case-lookup, PARTNER_API_GUIDE.md muc
// 1-7) - tu dong xin du lieu lan dau khi mo 1 vi pham co case_id, sau do chi doc cache tru khi nguoi
// dung bam "Dong bo" (co rate-limit 2 lop, xem backend lib/caseLookupCache.ts).
export function CaseLookupPanel({ viPhamId }: { viPhamId: string }) {
  const [data, setData] = useState<CaseLookupCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync(silent: boolean) {
    setSyncing(true);
    if (!silent) setMessage(null);
    try {
      const res = await api.post<{ cached: CaseLookupCache }>(`/giai-trinh/vi-pham/${viPhamId}/case-lookup/sync`);
      setData(res.cached);
      setMessage(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        const retryAfterMs = typeof err.body?.retryAfterMs === "number" ? err.body.retryAfterMs : 5000;
        const reason = err.body?.reason;
        setMessage(
          reason === "SAME_CASE"
            ? `Case này vừa được đồng bộ gần đây - vui lòng chờ khoảng ${Math.ceil(retryAfterMs / 60000)} phút rồi thử lại.`
            : `Bạn đang gọi thông tin quá nhanh, vui lòng chờ ${Math.ceil(retryAfterMs / 1000)}s rồi thử lại.`,
        );
      } else {
        setMessage("Không thể lấy thông tin case từ DVBH lúc này - vui lòng thử lại sau.");
      }
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ cached: CaseLookupCache | null }>(`/giai-trinh/vi-pham/${viPhamId}/case-lookup`)
      .then(async (res) => {
        if (cancelled) return;
        setData(res.cached);
        setLoading(false);
        if (!res.cached) await sync(true); // lan dau xem case nay - chua co cache, tu dong xin ve
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viPhamId]);

  if (loading) return <div className="loading-state">Đang tải thông tin case...</div>;

  const preview: CaseLookupPreview | null = data?.preview ?? null;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          Thông tin case (DVBH)
        </div>
        <button className="btn btn-ghost btn-sm" disabled={syncing} onClick={() => sync(false)}>
          <RefreshCw size={14} className={syncing ? "spin" : ""} /> {syncing ? "Đang đồng bộ..." : "Đồng bộ"}
        </button>
      </div>
      {data && <div className="card-meta" style={{ marginBottom: 10 }}>Đã đồng bộ lúc: {data.fetchedAt}</div>}
      {message && <div className="alert alert-info">{message}</div>}

      {!data || !data.found || !preview ? (
        <div className="empty-state">{data && !data.found ? "Không tìm thấy case này bên DVBH." : "Chưa có dữ liệu."}</div>
      ) : (
        <>
          <FieldGroup
            title="KTV & khách hàng"
            fields={[
              { label: "KTV phụ trách", value: preview.ky_thuat_vien },
              { label: "Khách hàng", value: preview.khach_hang },
              { label: "Seri sản phẩm", value: preview.seri_san_pham },
              { label: "Khu vực", value: preview.khu_vuc },
              { label: "Tỉnh/thành", value: preview.tinh },
              { label: "Quận/huyện", value: preview.quan_huyen },
            ]}
          />
          <FieldGroup
            title="Sản phẩm & yêu cầu"
            fields={[
              { label: "Hãng", value: preview.hang },
              { label: "Sản phẩm bảo hành", value: preview.san_pham_bao_hanh },
              { label: "Nhóm sản phẩm", value: preview.nhom_san_pham },
              { label: "Mô tả lỗi", value: preview.mo_ta_loi },
              { label: "Nhóm yêu cầu", value: preview.nhom_yeu_cau },
              { label: "Loại yêu cầu", value: preview.loai_yeu_cau },
              { label: "Hình thức bảo hành", value: preview.hinh_thuc_bao_hanh },
              { label: "Ngày mua", value: preview.ngay_mua },
            ]}
          />
          <FieldGroup
            title="Tiến độ xử lý"
            fields={[
              { label: "Tiến độ hoàn thành", value: preview.tien_do_hoan_thanh },
              { label: "CSKH tiếp nhận", value: preview.thoi_gian_cskh_tiep_nhan },
              { label: "Hẹn xử lý", value: preview.thoi_gian_hen_xu_ly },
              { label: "Hoàn thành", value: preview.thoi_gian_hoan_thanh },
              { label: "Lý do quá hạn", value: preview.ly_do_qua_han },
              { label: "Đúng/trễ hạn", value: preview.dung_han },
              { label: "Nhóm xử lý 24h", value: preview.xu_ly_24h_bucket },
              { label: "Lý do hủy case", value: preview.ly_do_huy },
              { label: "Ngày import", value: preview.ngay_import },
              { label: "Cập nhật gần nhất", value: preview.ngay_cap_nhat_gan_nhat },
            ]}
          />
          <FieldGroup
            title="Nghiệp vụ / tổ chức"
            fields={[
              { label: "Đối tác", value: preview.doi_tac },
              { label: "Ngành hàng", value: preview.nganh },
              { label: "Loại ngành hàng", value: preview.loai_nganh },
              { label: "Nhóm khách hàng", value: preview.nhom_kh },
              { label: "Cách thức xử lý", value: preview.cach_thuc_xu_ly },
            ]}
          />
          <FieldGroup
            title="Định giá"
            fields={[
              { label: "Định giá sản phẩm", value: formatTien(preview.dt_san_pham) },
              { label: "Định giá linh kiện", value: formatTien(preview.dt_linh_kien) },
              { label: "Định giá dịch vụ", value: formatTien(preview.dt_dich_vu) },
            ]}
          />

          {preview.noi_dung_xu_ly && (
            <div style={{ marginTop: 10 }}>
              <div className="kv-label">Nội dung xử lý</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>{preview.noi_dung_xu_ly}</div>
            </div>
          )}
          {preview.luu_y_loi_linh_kien && (
            <div style={{ marginTop: 10 }}>
              <div className="kv-label">Lưu ý lỗi linh kiện</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>{preview.luu_y_loi_linh_kien}</div>
            </div>
          )}
          {(preview.link_hinh_anh?.length ?? 0) > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="kv-label" style={{ marginBottom: 6 }}>
                Ảnh báo cáo công việc (KTV đã upload)
              </div>
              <div className="photo-grid">
                {preview.link_hinh_anh.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="photo-thumb">
                    <img src={url} alt="Ảnh báo cáo" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {preview.link_crm && (
            <a href={preview.link_crm} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ marginTop: 10, display: "inline-flex", width: "auto" }}>
              <ExternalLink size={14} /> Xem case trên CRM
            </a>
          )}

          {(data.giaiTrinh?.length ?? 0) > 0 && (
            <div className="giai-trinh-box">
              <div className="section-title" style={{ marginTop: 0 }}>
                Lịch sử giải trình chậm (case này)
              </div>
              {data.giaiTrinh.map((gt, i) => (
                <div key={i} className="card" style={{ marginBottom: 8 }}>
                  <div className="card-meta">
                    <span>{gt.ly_do_cham}</span>
                    <span>{gt.ngay_giai_trinh}</span>
                  </div>
                  {gt.noi_dung && <div style={{ fontSize: 13, marginTop: 4 }}>{gt.noi_dung}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
