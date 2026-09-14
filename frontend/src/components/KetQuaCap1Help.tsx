import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Modal } from "./Modal";
import { useKetQuaCap1DinhNghia } from "../contexts/KetQuaCap1Context";

// Tuong tu LoaiLoiHelp.tsx nhung cho ket_qua_cap_1 ("CSKH ket luan loai loi") - xem ghi chu trong
// LoaiLoiHelp.tsx, cau truc giong het.
export function KetQuaCap1Help({ ma, tenHienThi }: { ma: string; tenHienThi: string }) {
  const [open, setOpen] = useState(false);
  const info = useKetQuaCap1DinhNghia(ma);

  return (
    <>
      <button
        type="button"
        className="loai-loi-help-btn"
        aria-label="Xem mô tả kết luận"
        title="Xem mô tả kết luận"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>
              {tenHienThi}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-600)" }}>
              {info?.mo_ta || "Chưa có mô tả cho kết luận này - liên hệ Admin để bổ sung."}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
