import type { TigerCustomer } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "https://tigerbeer2025.azurewebsites.net/api";

export async function getCustomers(): Promise<TigerCustomer[]> {
  const res = await fetch(`${API_BASE}/TigerCustomers`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

// Utils: format theo giờ VN
export const VN_TZ = "Asia/Ho_Chi_Minh";

export function formatVN(dt: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

export function isSameDayInVN(a: Date, b: Date) {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: VN_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d); // yyyy-mm-dd
  return fmt(a) === fmt(b);
}
