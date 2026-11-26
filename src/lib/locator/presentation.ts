/* Marker artwork + brand status. Ported from locator-presentation.js. */
import type { Store } from "./feed";
import type { LaunchLayer } from "./launch";
import { restockLabel, shortDate } from "./format";

export interface BrandStatus {
  kind: "delivered" | "sold" | "upcoming";
  text: string;
}

/** One MWAH status per store: a recorded delivery always wins. */
export function brandStatus(store: Store | null | undefined): BrandStatus | null {
  if (!store) return null;
  const restock = restockLabel(store.lastDeliveryDate);
  if (restock) return { kind: "delivered", text: restock };
  if (store.availabilityStatus === "sold-here") return { kind: "sold", text: "Sold here" };
  const next = shortDate(store.nextDeliveryDate);
  if (next) return { kind: "upcoming", text: "Expected " + next };
  if (store.hasUpcomingDelivery || store.availabilityStatus === "coming-soon") return { kind: "upcoming", text: "Coming soon" };
  return null;
}

export function variantFor(store: Store, flavor: string, launch: LaunchLayer): string {
  if (flavor && flavor !== "all") return launch.pinVariant(store, flavor) || "default";
  const status = brandStatus(store);
  if (!status || status.kind === "sold") return "default";
  return status.kind === "delivered" ? "stocked" : "soon";
}

const VARIANTS = ["default", "stocked", "soon", "launch-delivered", "launch-ordered"];

export function iconOptions(variant: string, selected: boolean) {
  if (VARIANTS.indexOf(variant) < 0) variant = "default";
  const upcoming = variant === "soon" || variant === "launch-ordered";
  const delivered = variant === "stocked" || variant === "launch-delivered";
  const symbol = upcoming
    ? '<svg class="loc-pin__clock" viewBox="0 0 28 28" aria-hidden="true"><path d="M14 6v8l6 4"/></svg>'
    : delivered
      ? '<svg class="loc-pin__check" viewBox="0 0 28 28" aria-hidden="true"><path d="m7 14 5 5 9-12"/></svg>'
      : "";
  return {
    className: "loc-pin loc-pin--" + variant + (selected ? " loc-pin--selected" : ""),
    html: '<span class="loc-pin__mark" aria-hidden="true">' + symbol + "</span>",
    iconSize: [44, 44] as [number, number],
    iconAnchor: [22, 22] as [number, number],
    popupAnchor: [0, -22] as [number, number],
  };
}

export function clusterIconOptions(count: number) {
  count = Math.max(0, Math.floor(Number(count) || 0));
  const group = count < 10 ? "small" : count < 30 ? "medium" : "large";
  const size = count < 10 ? 44 : count < 30 ? 52 : 62;
  return {
    className: "marker-cluster marker-cluster-" + group,
    html: "<div><span>" + count + "</span></div>",
    iconSize: [size, size] as [number, number],
    iconAnchor: [size / 2, size / 2] as [number, number],
  };
}

export function isStocked(s: Store): boolean {
  if (s.availabilityStatus === "sold-here") return true;
  return restockLabel(s.lastDeliveryDate) !== "";
}

export function isSoon(s: Store): boolean {
  const status = brandStatus(s);
  return !!status && status.kind === "upcoming";
}
