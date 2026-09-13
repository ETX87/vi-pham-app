import { useEffect, useRef, useState } from "react";
import type { KtvOption } from "../types";

function labelOf(o: KtvOption): string {
  return `${o.ten_hien_thi ?? o.ma_ktv} (${o.ma_ktv})`;
}

// Combobox go-tim thay cho <select> thuan - danh sach KTV co the dai (tram/CTV nhieu khu vuc), go-tim
// theo ten hien thi hoac ma KTV de chon nhanh hon la cuon 1 danh sach dai. Dung chung cho 2 noi:
// gan KTV cho vi pham "chua xac dinh" (AdminScreen) va loc theo KTV trong "Tat ca vi pham".
export function KtvCombobox({
  value,
  onChange,
  options,
  allLabel,
  placeholder = "Tìm theo tên hoặc mã KTV...",
  containerStyle,
}: {
  value: string;
  onChange: (maKtv: string) => void;
  options: KtvOption[];
  allLabel?: string;
  placeholder?: string;
  containerStyle?: React.CSSProperties;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  const selected = options.find((o) => o.ma_ktv === value) ?? null;
  const displayValue = open ? query : selected ? labelOf(selected) : "";
  const inputPlaceholder = open ? placeholder : (allLabel ?? placeholder);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => labelOf(o).toLowerCase().includes(q)) : options;

  return (
    <div className="ktv-combobox" ref={boxRef} style={containerStyle}>
      <input
        type="text"
        value={displayValue}
        placeholder={inputPlaceholder}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "Enter" && filtered.length > 0) {
            onChange(filtered[0].ma_ktv);
            setQuery("");
            setOpen(false);
          }
        }}
      />
      {open && (
        <div className="ktv-combobox-list">
          {allLabel && (
            <button
              type="button"
              className="ktv-combobox-option"
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
            >
              {allLabel}
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="ktv-combobox-empty">Không tìm thấy KTV nào.</div>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.ma_ktv}
                className="ktv-combobox-option"
                onClick={() => {
                  onChange(o.ma_ktv);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {o.ten_hien_thi ?? o.ma_ktv} <span className="ktv-combobox-code">({o.ma_ktv})</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
