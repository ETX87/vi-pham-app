import { useEffect, useState } from "react";
import { Bell, BellOff, LogOut } from "lucide-react";
import { useAuth } from "./auth/AuthContext";
import { Avatar } from "./components/Avatar";
import { LoginScreen } from "./login/LoginScreen";
import { ViPhamListScreen } from "./modules/ViPhamListScreen";
import { ViPhamDetailScreen } from "./modules/ViPhamDetailScreen";
import { NotificationsScreen } from "./modules/NotificationsScreen";
import { AdminScreen } from "./modules/AdminScreen";
import { AccountScreen } from "./modules/AccountScreen";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { BottomTabBar, type MobileTab } from "./layout/BottomTabBar";
import { api } from "./api/client";

type Tab = MobileTab;

function MainApp() {
  const state = useAuth();
  const [tab, setTab] = useState<Tab>("vi-pham");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const push = usePushNotifications();
  const [viPhamBadge, setViPhamBadge] = useState(0);
  const [thongBaoBadge, setThongBaoBadge] = useState(0);

  function refreshBadges() {
    api.get<{ chuaXuLy: number }>("/giai-trinh/vi-pham").then((r) => setViPhamBadge(r.chuaXuLy)).catch(() => {});
    api
      .get<{ chuaDoc: number }>("/giai-trinh/thong-bao")
      .then((r) => {
        setThongBaoBadge(r.chuaDoc);
        // Icon PWA tren man hinh chinh (Badging API) - chi Chrome/Edge (desktop + Android) ho tro
        // sau khi cai dat, KHONG co tren iOS Safari. Dung dung so "chua doc" giong chuong thong bao.
        if (r.chuaDoc > 0) navigator.setAppBadge?.(r.chuaDoc).catch(() => {});
        else navigator.clearAppBadge?.().catch(() => {});
      })
      .catch(() => {});
  }

  useEffect(refreshBadges, []);

  if (state.status !== "authenticated") return null;
  const { user } = state;
  const isAdmin = user.vai_tro === "Admin";

  function goToViPham(id: string) {
    setTab("vi-pham");
    setSelectedId(id);
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-title">
          <img src="/icon-192.png" width={24} height={24} style={{ borderRadius: 6 }} alt="" />
          Giải trình vi phạm
        </div>
        <div className="topbar-tabs">
          <button
            className={`topbar-tab ${tab === "vi-pham" ? "active" : ""}`}
            onClick={() => {
              setTab("vi-pham");
              setSelectedId(null);
            }}
          >
            Vi phạm của tôi {viPhamBadge > 0 && <span className="badge">{viPhamBadge}</span>}
          </button>
          <button className={`topbar-tab ${tab === "thong-bao" ? "active" : ""}`} onClick={() => setTab("thong-bao")}>
            Thông báo {thongBaoBadge > 0 && <span className="badge">{thongBaoBadge}</span>}
          </button>
          {isAdmin && (
            <button className={`topbar-tab ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>
              Quản trị
            </button>
          )}
        </div>
        <div className="topbar-user">
          {push.supported && push.checked && (
            <button className="topbar-tab" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => (push.subscribed ? push.unsubscribe() : push.subscribe())} disabled={push.busy}>
              {push.subscribed ? <Bell size={14} /> : <BellOff size={14} />}
              {push.subscribed ? "Đã bật thông báo" : "Bật thông báo đẩy"}
            </button>
          )}
          <Avatar ten={user.ten} email={user.email} size={28} />
          <span className="topbar-user-name" title={user.ten ?? user.email}>
            {user.ten ?? user.email}
          </span>
          <button
            className="topbar-tab"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={async () => {
              navigator.clearAppBadge?.().catch(() => {});
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              window.location.href = "/";
            }}
          >
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </div>
      <div className="main">
        {tab === "admin" && isAdmin ? (
          <AdminScreen />
        ) : tab === "thong-bao" ? (
          <NotificationsScreen onSelectViPham={goToViPham} onChanged={refreshBadges} />
        ) : tab === "tai-khoan" ? (
          <AccountScreen user={user} push={push} />
        ) : selectedId ? (
          <ViPhamDetailScreen id={selectedId} onBack={() => setSelectedId(null)} onChanged={refreshBadges} />
        ) : (
          <ViPhamListScreen onSelect={setSelectedId} />
        )}
      </div>
      <BottomTabBar
        tab={tab === "vi-pham" && selectedId ? "vi-pham" : tab}
        onChange={(t) => {
          setTab(t);
          if (t === "vi-pham") setSelectedId(null);
        }}
        isAdmin={isAdmin}
        viPhamBadge={viPhamBadge}
        thongBaoBadge={thongBaoBadge}
      />
    </div>
  );
}

export function App() {
  const state = useAuth();

  if (state.status === "loading") return <div className="loading-state">Đang tải...</div>;
  if (state.status === "anonymous") return <LoginScreen variant="login" />;
  if (state.status === "pending") return <LoginScreen variant="pending" />;
  if (state.status === "rejected") return <LoginScreen variant="rejected" />;
  if (state.status === "disabled") return <LoginScreen variant="disabled" />;
  return <MainApp />;
}
