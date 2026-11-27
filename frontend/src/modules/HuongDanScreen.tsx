import { ArrowLeft, ExternalLink } from "lucide-react";

// Tab "Huong dan" - nhung tai lieu HTML tinh frontend/public/huong-dan-ktv/index.html (kem anh chup app
// that trong thu muc img/). Tai lieu la file tinh de Giam doc / Admin mo truc tiep bang link
// /huong-dan-ktv/ (gui qua Zalo...) ma khong can dang nhap; trong app thi nhung bang iframe cung goc.
export const HUONG_DAN_URL = "/huong-dan-ktv/index.html";

export function HuongDanScreen({ onBack }: { onBack?: () => void }) {
  return (
    <div className="huong-dan-screen">
      <div className="detail-header" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onBack && (
            <button className="detail-back" onClick={onBack} aria-label="Quay lại">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="detail-title">Hướng dẫn sử dụng</div>
        </div>
        <a href={HUONG_DAN_URL} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--brand-700, #7f1d1d)", fontWeight: 600 }}>
          Mở trang riêng <ExternalLink size={14} />
        </a>
      </div>
      <iframe className="huong-dan-frame" src={HUONG_DAN_URL} title="Hướng dẫn sử dụng cho KTV" />
    </div>
  );
}
