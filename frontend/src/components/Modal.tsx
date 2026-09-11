// Popup dung chung, toi gian - overlay mo, khong tu chua header rieng (component con ben trong tu
// quyet dinh tieu de/nut hanh dong cua no, vd CaseLookupPanel da co san header "Thong tin case +
// nut Dong bo"). Bam ra ngoai overlay hoac nut X de dong.
export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
