import { useState } from "react";
import { Bell, HelpCircle, Phone, LogOut, ChevronRight } from "lucide-react";
import type { AppUser } from "../types";
import type { usePushNotifications } from "../hooks/usePushNotifications";
import { Avatar } from "../components/Avatar";
import { Modal } from "../components/Modal";

// Man "Tai khoan" - chi hien tren mobile (bottom nav, xem layout/BottomTabBar.tsx). Tren desktop cac
// dieu khien nay da nam san trong .topbar-user (luon hien, khong can 1 man rieng).
export function AccountScreen({ user, push }: { user: AppUser; push: ReturnType<typeof usePushNotifications> }) {
  const [showGuide, setShowGuide] = useState(false);
  const [showContact, setShowContact] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  return (
    <div className="narrow">
      <div className="section-title" style={{ marginTop: 0 }}>
        Tài khoản
      </div>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar ten={user.ten} email={user.email} size={48} />
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>
            {user.ten ?? user.email}
          </div>
          <div className="card-meta">{user.email}</div>
        </div>
      </div>

      <div className="list-card">
        <button className="list-row" onClick={() => (push.subscribed ? push.unsubscribe() : push.subscribe())} disabled={push.busy || !push.supported}>
          <span className="list-row-icon">
            <Bell size={18} />
          </span>
          <span className="list-row-label">Cài đặt thông báo đẩy</span>
          {push.supported && <span className={`tag ${push.subscribed ? "tag-done" : "tag-pending"}`}>{push.subscribed ? "Đã bật" : "Chưa bật"}</span>}
        </button>
        <button className="list-row" onClick={() => setShowGuide(true)}>
          <span className="list-row-icon">
            <HelpCircle size={18} />
          </span>
          <span className="list-row-label">Hướng dẫn sử dụng</span>
          <span className="list-row-chevron">
            <ChevronRight size={18} />
          </span>
        </button>
        <button className="list-row" onClick={() => setShowContact(true)}>
          <span className="list-row-icon">
            <Phone size={18} />
          </span>
          <span className="list-row-label">Liên hệ Admin</span>
          <span className="list-row-chevron">
            <ChevronRight size={18} />
          </span>
        </button>
      </div>

      <div className="list-card">
        <button className="list-row list-row-danger" onClick={handleLogout}>
          <span className="list-row-icon">
            <LogOut size={18} />
          </span>
          <span className="list-row-label">Đăng xuất</span>
        </button>
      </div>

      {showGuide && (
        <Modal onClose={() => setShowGuide(false)}>
          <div className="card">
            <div className="card-title">Hướng dẫn sử dụng</div>
            <ul style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 18, margin: "10px 0 0" }}>
              <li>Tab "Vi phạm" hiển thị các vi phạm bạn cần giải trình, mới nhất trước.</li>
              <li>Bấm vào 1 vi phạm để xem chi tiết case và bấm "Tạo giải trình".</li>
              <li>Điền lý do, đính kèm tối đa 5 ảnh bằng chứng rồi bấm "Gửi giải trình".</li>
              <li>Bật "Thông báo đẩy" để nhận cảnh báo ngay khi có vi phạm mới.</li>
            </ul>
          </div>
        </Modal>
      )}
      {showContact && (
        <Modal onClose={() => setShowContact(false)}>
          <div className="card">
            <div className="card-title">Liên hệ Admin</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>Liên hệ quản trị viên hoặc Giám sát trực tiếp của bạn qua kênh liên lạc nội bộ công ty nếu cần hỗ trợ.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
