import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { KtvOption } from "../types";

// Danh sach KTV cho o chon KTV o man Vi pham / Bao cao nhanh - backend tu gioi han theo vai tro (GET
// /giai-trinh/ktv-options): Admin/View toan bo, Giam sat chi KTV khu vuc minh (khuVuc = cac khu vuc duoc gan,
// null voi Admin/View). allLabel: "Toan doi" hoac "Toan nhom (MB1, MB2)".
export function useKtvOptions(enabled: boolean) {
  const [options, setOptions] = useState<KtvOption[]>([]);
  const [khuVuc, setKhuVuc] = useState<string[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    api
      .get<{ rows: KtvOption[]; khuVuc: string[] | null }>("/giai-trinh/ktv-options")
      .then((r) => {
        setOptions(r.rows);
        setKhuVuc(r.khuVuc);
      })
      .catch(() => {});
  }, [enabled]);

  const allLabel = khuVuc ? `Toàn nhóm (${khuVuc.length ? khuVuc.join(", ") : "chưa gán khu vực"})` : "Toàn đội";
  // GS chua duoc Admin gan khu vuc nao -> khong xem duoc ai, hien nhac thay vi 1 danh sach rong kho hieu.
  const chuaGanKhuVuc = !!khuVuc && khuVuc.length === 0;
  return { options, khuVuc, allLabel, chuaGanKhuVuc };
}
