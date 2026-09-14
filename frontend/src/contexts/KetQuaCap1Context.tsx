import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { KetQuaCap1DinhNghia } from "../types";

// Tuong tu LoaiLoiContext.tsx nhung cho ket_qua_cap_1 ("CSKH ket luan loai loi", migration 0007) -
// xem ghi chu trong LoaiLoiContext.tsx, cau truc giong het.
interface KetQuaCap1ContextValue {
  map: Record<string, KetQuaCap1DinhNghia>;
  reload: () => void;
}

const KetQuaCap1Context = createContext<KetQuaCap1ContextValue>({ map: {}, reload: () => {} });

export function KetQuaCap1Provider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Record<string, KetQuaCap1DinhNghia>>({});

  function load() {
    api
      .get<{ rows: KetQuaCap1DinhNghia[] }>("/ket-qua-cap-1")
      .then((r) => setMap(Object.fromEntries(r.rows.map((row) => [row.ma, row]))))
      .catch(() => {});
  }

  useEffect(load, []);

  return <KetQuaCap1Context.Provider value={{ map, reload: load }}>{children}</KetQuaCap1Context.Provider>;
}

export function useKetQuaCap1DinhNghia(ma: string): KetQuaCap1DinhNghia | undefined {
  const { map } = useContext(KetQuaCap1Context);
  return map[ma];
}

export function useKetQuaCap1Map() {
  return useContext(KetQuaCap1Context);
}
