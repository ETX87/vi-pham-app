import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { LoaiLoiDinhNghia } from "../types";

// Nap 1 lan toan bo dinh nghia mo ta loai loi (bang nho, khong phan trang - xem migration 0005) va
// chia se qua Context cho moi man hinh co hien card vi pham (ViPhamListScreen, ViPhamDetailScreen,
// AdminScreen) - tranh moi noi phai tu goi API rieng. "reload" xuat ra de man Quan tri goi lai ngay
// sau khi Admin sua/them 1 dinh nghia, khong can cho nguoi dung F5 lai trang.
interface LoaiLoiContextValue {
  map: Record<string, LoaiLoiDinhNghia>;
  reload: () => void;
}

const LoaiLoiContext = createContext<LoaiLoiContextValue>({ map: {}, reload: () => {} });

export function LoaiLoiProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Record<string, LoaiLoiDinhNghia>>({});

  function load() {
    api
      .get<{ rows: LoaiLoiDinhNghia[] }>("/loai-loi")
      .then((r) => setMap(Object.fromEntries(r.rows.map((row) => [row.ma, row]))))
      .catch(() => {});
  }

  useEffect(load, []);

  return <LoaiLoiContext.Provider value={{ map, reload: load }}>{children}</LoaiLoiContext.Provider>;
}

export function useLoaiLoiDinhNghia(ma: string): LoaiLoiDinhNghia | undefined {
  const { map } = useContext(LoaiLoiContext);
  return map[ma];
}

export function useLoaiLoiMap() {
  return useContext(LoaiLoiContext);
}
