export function escapeHTML(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function localDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const p = String(iso).split("-");
  if (p.length !== 3) return null;
  const d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  return isNaN(d.getTime()) ? null : d;
}

/** Whole days since a YYYY-MM-DD date, anchored to local midnight. */
export function daysAgo(iso: string | null | undefined): number | null {
  const d = localDate(iso);
  if (!d) return null;
  const n = new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.max(0, Math.round((today - d.getTime()) / 86400000));
}

export function restockLabel(iso: string | null | undefined): string {
  const days = daysAgo(iso);
  if (days == null) return "";
  return "Restocked " + (days === 0 ? "today" : days === 1 ? "yesterday" : days + "d ago");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDate(iso: string | null | undefined): string {
  const d = localDate(iso);
  return d ? MONTHS[d.getMonth()] + " " + d.getDate() : "";
}

export function ensureHttp(url: string | undefined): string {
  return url && !/^https?:\/\//i.test(url) ? "https://" + url : url || "";
}

export function safeHost(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(ensureHttp(url)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function telHref(phone: string | undefined): string {
  if (!phone) return "";
  const d = String(phone).replace(/[^\d+]/g, "");
  return d ? "tel:" + d : "";
}

export function directionsUrl(lat: number, lng: number): string {
  const dest = lat + "," + lng;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? "https://maps.apple.com/?daddr=" + encodeURIComponent(dest) + "&dirflg=d"
    : "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(dest);
}

export const hasCoords = (s: { lat?: number; lng?: number }): s is { lat: number; lng: number } =>
  typeof s.lat === "number" && typeof s.lng === "number";
