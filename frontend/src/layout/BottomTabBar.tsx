import { ClipboardList, Bell, Settings, User, BarChart3 } from "lucide-react";

export type MobileTab = "vi-pham" | "bao-cao" | "thong-bao" | "admin" | "tai-khoan";

interface TabDef {
  key: MobileTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

// Thanh menu day duoi - CHI hien tren mobile (CSS media query trong styles.css, xem .bottom-tab-bar),
// desktop van dung .topbar-tabs + .topbar-user nhu cu. Toi da 5 nut theo yeu cau - hien tai dung 3-4
// (tuy isAdmin) de con cho mo rong sau nay.
export function BottomTabBar({
  tab,
  onChange,
  isAdmin,
  viPhamBadge,
  thongBaoBadge,
}: {
  tab: MobileTab;
  onChange: (t: MobileTab) => void;
  isAdmin: boolean;
  viPhamBadge: number;
  thongBaoBadge: number;
}) {
  const tabs: TabDef[] = [
    { key: "vi-pham", label: "Vi phạm", icon: <ClipboardList size={22} />, badge: viPhamBadge },
    { key: "bao-cao", label: "Báo cáo", icon: <BarChart3 size={22} /> },
    { key: "thong-bao", label: "Thông báo", icon: <Bell size={22} />, badge: thongBaoBadge },
    ...(isAdmin ? [{ key: "admin" as const, label: "Quản trị", icon: <Settings size={22} /> }] : []),
    { key: "tai-khoan", label: "Tài khoản", icon: <User size={22} /> },
  ];

  return (
    <nav className="bottom-tab-bar" aria-label="Điều hướng chính">
      {tabs.map((t) => (
        <button key={t.key} className={`bottom-tab ${tab === t.key ? "active" : ""}`} onClick={() => onChange(t.key)}>
          <span className="bottom-tab-icon">
            {t.icon}
            {!!t.badge && <span className="bottom-tab-badge">{t.badge > 9 ? "9+" : t.badge}</span>}
          </span>
          <span className="bottom-tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
