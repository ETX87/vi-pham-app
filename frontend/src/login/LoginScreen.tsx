import { useState } from "react";

// Man "Cho duyet" (gmail chua khop danh ba KTV, xem routes/auth.ts callback) cho go them ma KTV cua
// minh de Admin doi chieu nhanh hon thay vi chi thay 1 email tro (xem phan hoi nguoi dung). Goi
// truc tiep endpoint rieng /api/auth/ma-ktv-tu-khai (KHONG di qua middleware/loadUser.ts - middleware
// do chan 403 PENDING_APPROVAL truoc ca khi toi duoc handler, xem ghi chu trong route).
function MaKtvTuKhaiForm() {
  const [ma, setMa] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!ma.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/ma-ktv-tu-khai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ma_ktv_tu_khai: ma.trim() }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("Không gửi được - vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return <div className="alert alert-success" style={{ marginTop: 16, textAlign: "left" }}>Đã gửi mã KTV "{ma.trim()}" - Admin sẽ đối chiếu khi phê duyệt.</div>;
  }

  return (
    <div style={{ marginTop: 16, textAlign: "left" }}>
      <label className="field-label">Mã KTV trên hệ thống (nếu có)</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={ma}
          onChange={(e) => setMa(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Nhập mã KTV..."
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary btn-sm" disabled={submitting || !ma.trim()} onClick={submit}>
          {submitting ? "Đang gửi..." : "Gửi"}
        </button>
      </div>
      <div className="card-meta" style={{ marginTop: 6 }}>Giúp Admin tìm đúng hồ sơ của bạn để phê duyệt nhanh hơn.</div>
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export function LoginScreen({ variant = "login" }: { variant?: "login" | "pending" | "rejected" | "disabled" }) {
  const messages: Record<string, { title: string; sub: string }> = {
    login: { title: "Chỉ số & giải trình", sub: "Hệ thống giải trình vi phạm cho KTV - Dịch Vụ 3T" },
    pending: { title: "Đang chờ duyệt", sub: "Tài khoản của bạn đã được ghi nhận, vui lòng chờ Admin phê duyệt." },
    rejected: { title: "Tài khoản bị từ chối", sub: "Liên hệ Admin nếu bạn cho rằng đây là nhầm lẫn." },
    disabled: { title: "Tài khoản đã bị khóa", sub: "Liên hệ Admin để được mở khóa lại." },
  };
  const { title, sub } = messages[variant];

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/icon-192.png" alt="Chỉ số & giải trình" width={52} height={52} className="login-icon" />
        <div className="login-title">{title}</div>
        <div className="login-sub">{sub}</div>
        {variant === "login" && (
          <a href="/api/auth/login" className="btn btn-google">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.1 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.3-.1-2.7-.4-4z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.1 5.1 29.3 3 24 3 16.3 3 9.7 7.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.6 26.7 37.5 24 37.5c-5.3 0-9.7-3.6-11.3-8.4l-6.5 5C9.5 40.6 16.2 45 24 45z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.6-2.5 4.8-4.7 6.3l6.2 5.2C40.5 36.2 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z" />
            </svg>
            Đăng nhập bằng Google
          </a>
        )}
        {variant === "login" && <div className="login-note">Chỉ tài khoản KTV hợp lệ hoặc đã được Admin phê duyệt mới truy cập được.</div>}
        {variant === "login" && import.meta.env.DEV && (
          <a href="/api/auth/dev-login" className="btn btn-dev">
            🔧 Đăng nhập DEV (bỏ qua Google, chỉ local)
          </a>
        )}
        {variant === "pending" && <MaKtvTuKhaiForm />}
      </div>
    </div>
  );
}
