import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, LogOut } from "lucide-react";
import { useAuth } from "./auth/AuthContext";
import { Avatar } from "./components/Avatar";
import { LoginScreen } from "./login/LoginScreen";
import { ViPhamListScreen } from "./modules/ViPhamListScreen";
import { BaoCaoScreen } from "./modules/BaoCaoScreen";
import { ViPhamDetailScreen } from "./modules/ViPhamDetailScreen";
import { NotificationsScreen } from "./modules/NotificationsScreen";
import { AdminScreen } from "./modules/AdminScreen";
import { AccountScreen } from "./modules/AccountScreen";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { BottomTabBar, type MobileTab } from "./layout/BottomTabBar";
import { api } from "./api/client";
import { LoaiLoiProvider } from "./contexts/LoaiLoiContext";
import { KetQuaCap1Provider } from "./contexts/KetQuaCap1Context";

type Tab = MobileTab;

function MainApp() {
  const state = useAuth();
  const [tab, setTab] = useState<Tab>("vi-pham");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const push = usePushNotifications();
  const [viPhamBadge, setViPhamBadge] = useState(0);
  const [thongBaoBadge, setThongBaoBadge] = useState(0);

  // Badge "Thong bao" gop CHUNG 2 nguon (su kien vi pham tu dong + thong bao cong ty Admin soan,
  // xem migration 0009) vi UI gop ca 2 vao 1 tab duy nhat (xem NotificationsScreen.tsx) - nguoi
  // dung chi can biet "co gi moi can doc" o 1 cho, khong can phan biet nguon luc nhin bottom-bar.
  function refreshBadges() {
    api.get<{ chuaXuLy: number }>("/giai-trinh/vi-pham").then((r) => setViPhamBadge(r.chuaXuLy)).catch(() => {});
    Promise.all([
      api.get<{ chuaDoc: number }>("/giai-trinh/thong-bao").catch(() => ({ chuaDoc: 0 })),
      api.get<{ chuaDoc: number }>("/giai-trinh/thong-bao-cong-ty").catch(() => ({ chuaDoc: 0 })),
    ]).then(([a, b]) => {
      const tong = a.chuaDoc + b.chuaDoc;
      setThongBaoBadge(tong);
      // Icon PWA tren man hinh chinh (Badging API) - chi Chrome/Edge (desktop + Android) ho tro
      // sau khi cai dat, KHONG co tren iOS Safari. Dung dung so "chua doc" giong chuong thong bao.
      if (tong > 0) navigator.setAppBadge?.(tong).catch(() => {});
      else navigator.clearAppBadge?.().catch(() => {});
    });
  }

  useEffect(refreshBadges, []);

  // Nut/cu chi Back cua Android tren PWA da cai dat = history.back() cua trinh duyet - khong co
  // routing (chi dung useState cho tab/selectedId) nen mac dinh KHONG co history entry nao de lui,
  // Back se thoat luon app tu bat ky man hinh nao. Fix: coi "Vi pham cua toi" (tab mac dinh, chua
  // chon vi pham nao) la man chinh - roi khoi day thi push 1 entry gia; Back se duoc bat (popstate)
  // va dua ve man chinh thay vi thoat app. Chi khi dang o man chinh, Back moi thoat app (hanh vi
  // trinh duyet mac dinh, khong can can thiep).
  const pushedHistoryRef = useRef(false);
  const isHome = tab === "vi-pham" && !selectedId;

  useEffect(() => {
    if (!isHome && !pushedHistoryRef.current) {
      window.history.pushState({ vipham: true }, "");
      pushedHistoryRef.current = true;
    } else if (isHome && pushedHistoryRef.current) {
      // Quay ve man chinh qua thao tac trong app (bam nut back UI, doi tab...), khong phai qua
      // Back cua Android - tu tieu thu entry gia da push de Back lan sau tu man chinh thoat app
      // dung, khong bi ket 1 entry "ao" con sot lai.
      pushedHistoryRef.current = false;
      window.history.back();
    }
  }, [isHome]);

  useEffect(() => {
    function onPopState() {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        setTab("vi-pham");
        setSelectedId(null);
      }
      // Khong con entry gia (dang o man chinh) - de trinh duyet/PWA tu xu ly Back (thoat app).
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (state.status !== "authenticated") return null;
  const { user } = state;
  const isAdmin = user.vai_tro === "Admin";

  function goToViPham(id: string) {
    setTab("vi-pham");
    setSelectedId(id);
  }

  return (
    <LoaiLoiProvider>
    <KetQuaCap1Provider>
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
          <button className={`topbar-tab ${tab === "bao-cao" ? "active" : ""}`} onClick={() => setTab("bao-cao")}>
            Báo cáo nhanh
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
        ) : tab === "bao-cao" ? (
          <BaoCaoScreen />
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
    </KetQuaCap1Provider>
    </LoaiLoiProvider>
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
