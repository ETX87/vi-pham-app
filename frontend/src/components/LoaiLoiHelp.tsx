import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Modal } from "./Modal";
import { useLoaiLoiDinhNghia } from "../contexts/LoaiLoiContext";

// Dau (?) canh ten loai loi tren card vi pham - bam vao hien mo ta chi tiet Admin da cau hinh (xem
// migration 0005 + man Quan tri "Loại lỗi"). Truoc gio KTV chi thay ten loi ngan gon, khong hieu ro
// vi pham cu the la gi (xem phan hoi nguoi dung). stopPropagation vi cac card cha thuong co
// onClick rieng (vd mo chi tiet vi pham) - bam (?) khong duoc kich hoat click cua card.
export function LoaiLoiHelp({ maLoi, tenHienThi }: { maLoi: string; tenHienThi: string }) {
  const [open, setOpen] = useState(false);
  const info = useLoaiLoiDinhNghia(maLoi);

  return (
    <>
      <button
        type="button"
        className="loai-loi-help-btn"
        aria-label="Xem mô tả lỗi"
        title="Xem mô tả lỗi"
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
              {info?.mo_ta || "Chưa có mô tả cho lỗi này - liên hệ Admin để bổ sung."}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
