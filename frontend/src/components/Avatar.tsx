import { initials } from "../lib/format";

export function Avatar({ ten, email, size = 40 }: { ten: string | null; email: string; size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(ten, email)}
    </div>
  );
}
