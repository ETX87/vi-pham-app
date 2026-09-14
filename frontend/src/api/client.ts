// Port rut gon tu linh-kien-app frontend/src/api/client.ts.
const BASE = "/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: string;
  // Body JSON day du (vd { error, reason, retryAfterMs } cua rate-limit case-lookup) - dung khi 1
  // endpoint tra ve them field rieng ngoai error/message chuan, tranh phai parse lai response.
  body?: Record<string, unknown>;
  constructor(status: number, code?: string, detail?: string, body?: Record<string, unknown>) {
    super(code ?? `HTTP_${status}`);
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormBody = init?.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: isFormBody ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    let code: string | undefined;
    let detail: string | undefined;
    let body: Record<string, unknown> | undefined;
    try {
      body = await res.json();
      code = body?.error as string | undefined;
      if (typeof body?.message === "string") detail = body.message as string;
    } catch {
      /* body khong phai JSON */
    }
    throw new ApiError(res.status, code, detail, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  // Upload binary tho (anh bang chung) voi Content-Type la mime that - xem
  // backend routes/giaiTrinh.ts POST /vi-pham/:id/anh (doc qua c.req.arrayBuffer()).
  postBinary: <T>(path: string, bytes: ArrayBuffer, contentType: string) =>
    request<T>(path, { method: "POST", body: bytes, headers: { "Content-Type": contentType } }),
};
