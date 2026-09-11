import type { Context, Next } from "hono";
import type { AppUser, Env } from "../types";

// Rut gon tu linh-kien-app backend/src/middleware/loadUser.ts - khong co "xem thu vai tro" (view-
// as, chi Admin/QC/Giam sat cua linh-kien-app moi can), khong co cac co vai tro nghiep vu rieng -
// he nay chi phan biet Admin (vai_tro = 'Admin') vs KTV thuong (vai_tro NULL).
interface UserRow {
  email: string;
  ten: string | null;
  vai_tro: "Admin" | null;
  trang_thai_duyet: "Cho duyet" | "Da duyet" | "Tu choi";
  bi_khoa: number;
}

export async function loadUser(c: Context<{ Bindings: Env }>, next: Next) {
  const email = c.get("email");

  let row = await c.env.DB.prepare("SELECT email, ten, vai_tro, trang_thai_duyet, bi_khoa FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();

  if (!row) {
    const isBootstrapAdmin = email === c.env.BOOTSTRAP_ADMIN_EMAIL;
    row = await c.env.DB.prepare(
      `INSERT INTO users (email, vai_tro, trang_thai_duyet)
       VALUES (?, ?, ?)
       RETURNING email, ten, vai_tro, trang_thai_duyet, bi_khoa`,
    )
      .bind(email, isBootstrapAdmin ? "Admin" : null, isBootstrapAdmin ? "Da duyet" : "Cho duyet")
      .first<UserRow>();
  }

  if (!row) return c.json({ error: "USER_LOAD_FAILED" }, 500);

  if (row.bi_khoa) return c.json({ error: "DISABLED" }, 403);
  if (row.trang_thai_duyet === "Cho duyet") return c.json({ error: "PENDING_APPROVAL" }, 403);
  if (row.trang_thai_duyet === "Tu choi") return c.json({ error: "REJECTED" }, 403);

  const user: AppUser = {
    email: row.email,
    ten: row.ten,
    vai_tro: row.vai_tro,
    trang_thai_duyet: row.trang_thai_duyet,
    bi_khoa: !!row.bi_khoa,
  };

  c.set("user", user);
  await next();
}
