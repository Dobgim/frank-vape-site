/* Flavor-launch layer (e.g. Latte Lover): one status calculation drives pins,
   popups, list badges, filters and counts. Ported from locator-launch.js. */
import type { Store, StoreFeed } from "./feed";
import { restockLabel, shortDate } from "./format";

export const LAUNCHES: Record<string, { label: string; short: string; pillInAll: boolean }> = {
  "latte-lover": { label: "Latte Lover", short: "Latte Lover", pillInAll: true },
};

export interface Evidence {
  slug: string;
  delivered: boolean;
  ordered: boolean;
  lastDeliveredOn: string | null;
  nextExpectedOn: string | null;
}

export class LaunchLayer {
  private coverage: Record<string, "ready" | "unavailable"> = {};
  private markets: Record<string, string> = {};
  private launchOnly: Store[] = [];

  constructor(feed: StoreFeed | null) {
    for (const slug of Object.keys(LAUNCHES)) {
      this.coverage[slug] = "unavailable";
      this.markets[slug] = "WA";
    }
    const published = feed?.launchCoverage;
    if (published && typeof published === "object") {
      for (const slug of Object.keys(LAUNCHES)) {
        const entry = published[slug];
        if (!entry) continue;
        // The live site also expires evidence older than 24h. This rebuild
        // serves a static snapshot, so the published status is used as-is.
        this.coverage[slug] = entry.status === "ready" ? "ready" : "unavailable";
        this.markets[slug] = String(entry.market || "WA").toUpperCase();
      }
    }
    for (const s of feed?.launchOnlyStores ?? []) {
      if (!s || !s.id || typeof s.lat !== "number" || typeof s.lng !== "number") continue;
      this.launchOnly.push({ ...s, id: String(s.id), _market: "WA", _launchOnly: true });
    }
  }

  flavors(): string[] {
    return Object.keys(this.coverage);
  }
  isKnown(slug: string): boolean {
    return !!this.coverage[slug];
  }
  isReady(slug: string): boolean {
    return this.coverage[slug] === "ready";
  }
  shortLabel(slug: string): string {
    return LAUNCHES[slug]?.short ?? "";
  }

  launchOnlyStores(flavor: string): Store[] {
    return flavor && flavor !== "all" && this.isReady(flavor) ? this.launchOnly : [];
  }

  evidence(store: Store, slug: string): Evidence | null {
    if (!this.isReady(slug)) return null;
    if (store._market && store._market !== this.markets[slug]) return null;
    const e = store.launches?.[slug];
    if (!e || typeof e !== "object") return null;
    const delivered = typeof e.lastDeliveredOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.lastDeliveredOn);
    const ordered = e.hasOpenOrder === true;
    if (!delivered && !ordered) return null;
    return {
      slug,
      delivered,
      ordered,
      lastDeliveredOn: delivered ? (e.lastDeliveredOn as string) : null,
      nextExpectedOn: ordered && typeof e.nextExpectedOn === "string" ? e.nextExpectedOn : null,
    };
  }

  labeled(store: Store, flavor: string): Evidence[] {
    if (flavor && flavor !== "all") {
      const one = this.evidence(store, flavor);
      return one ? [one] : [];
    }
    const out: Evidence[] = [];
    for (const slug of Object.keys(this.coverage)) {
      if (!LAUNCHES[slug]?.pillInAll) continue;
      const e = this.evidence(store, slug);
      if (e) out.push(e);
    }
    return out;
  }

  matches(store: Store, flavor: string, status: string): boolean {
    const e = this.evidence(store, flavor);
    if (!e) return false;
    if (status === "delivered") return e.delivered;
    if (status === "ordered") return e.ordered;
    return true;
  }

  pinVariant(store: Store, flavor: string): string {
    const e = flavor && flavor !== "all" ? this.evidence(store, flavor) : null;
    return e ? (e.delivered ? "launch-delivered" : "launch-ordered") : "";
  }

  tagText(e: Evidence): string {
    const expected = shortDate(e.nextExpectedOn);
    const status = e.delivered ? restockLabel(e.lastDeliveredOn) : expected ? "Expected " + expected : "Coming soon";
    return this.shortLabel(e.slug) + " · " + status;
  }

  chips(store: Store, flavor: string): { cls: string; text: string }[] {
    return this.labeled(store, flavor).map((e) => ({
      cls: e.delivered ? "loc-pill--launch" : "loc-pill--launch-ordered",
      text: this.tagText(e),
    }));
  }

  pinLabel(store: Store, flavor: string): string {
    return this.labeled(store, flavor).map((e) => this.tagText(e)).join(", ");
  }

  emptyMessage(flavor: string, status: string): string {
    const name = this.shortLabel(flavor);
    if (!this.isReady(flavor)) return name + " updates are temporarily unavailable. Choose All MWAH to browse every store.";
    if (status === "delivered") return "No " + name + " deliveries here yet. Try + Coming soon.";
    return "No " + name + " stores match. Try a wider area or choose All MWAH.";
  }

  resultMessage(flavor: string, count: number, status: string): string {
    if (!flavor || flavor === "all") return "Showing all MWAH stores.";
    if (!this.isReady(flavor)) return this.shortLabel(flavor) + " updates are temporarily unavailable.";
    return (
      "Showing " + count + " store" + (count === 1 ? "" : "s") + " with " + this.shortLabel(flavor) +
      (status === "delivered" ? " deliveries." : " delivered or coming soon.")
    );
  }
}

export function statusOptions(flavor: string): [string, string][] {
  return flavor && flavor !== "all"
    ? [["delivered", "DELIVERED"], ["all", "+ COMING SOON"]]
    : [["all", "ALL"], ["stocked", "STOCKED"], ["soon", "SOON"]];
}

/** A flavor opens on Delivered; old "ordered" links open the wider view. */
export function resolveStatus(flavor: string, status: string): string {
  if (flavor && flavor !== "all" && status === "ordered") status = "all";
  if (statusOptions(flavor).some((o) => o[0] === status)) return status;
  return flavor && flavor !== "all" ? "delivered" : "all";
}
