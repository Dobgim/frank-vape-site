import { STORE_FEED_URL } from "../../config";

export interface LaunchEvidence {
  lastDeliveredOn?: string | null;
  hasOpenOrder?: boolean;
  nextExpectedOn?: string | null;
}

export interface Store {
  id: string;
  name: string;
  address?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  license?: string;
  lastDeliveryDate?: string | null;
  nextDeliveryDate?: string | null;
  hasUpcomingDelivery?: boolean;
  availabilityStatus?: string;
  launches?: Record<string, LaunchEvidence>;
  isDeleted?: boolean;
  isRetailLocation?: boolean;
  status?: string;
  /** Client-side fields */
  _market: "WA" | "CA";
  _launchOnly?: boolean;
  _distance?: number;
}

export interface CoverageEntry {
  status: string;
  evidenceAsOf?: string;
  market?: string;
  deliveryWindowDays?: number;
}

export interface StoreFeed {
  generatedAt?: string;
  launchCoverage?: Record<string, CoverageEntry>;
  stores: Omit<Store, "_market">[];
  launchOnlyStores?: Omit<Store, "_market">[];
}

let feedPromise: Promise<StoreFeed> | null = null;

/** Fetches the local feed snapshot once and shares it between the locator and the request modal. */
export function loadStoreFeed(): Promise<StoreFeed> {
  if (!feedPromise) {
    feedPromise = fetch(STORE_FEED_URL, { headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error("Feed " + r.status);
        return r.json() as Promise<StoreFeed>;
      })
      .catch((err) => {
        feedPromise = null;
        throw err;
      });
  }
  return feedPromise;
}

function publicStoreKey(store: Partial<Store>, prefix: string, fallbackIndex: number): string {
  if (store.id) return String(store.id);
  const seed = [store.name, store.address, store.city, store.zip, store.lat, store.lng].join("|");
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
  return prefix + "-" + (seed === "|||||" ? fallbackIndex : (hash >>> 0).toString(36));
}

/** California display is switched off on the source site; only WA stores are shown. */
export function feedToStores(feed: StoreFeed | null): Store[] {
  const list = feed && Array.isArray(feed.stores) ? feed.stores : [];
  return list.map((s, i) => ({ ...s, id: publicStoreKey(s, "wa", i), _market: "WA" as const }));
}

export function matchesStoreSearch(store: Store, query: string): boolean {
  const q = String(query || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return true;
  const hay = [store.name, store.city, store.address, store.zip].join(" ").toLowerCase().replace(/\s+/g, " ");
  return hay.indexOf(q) !== -1;
}

export function resolveLocatorMarket(_current: string, requested: string): "all" | "WA" {
  const r = String(requested || "").trim().toUpperCase();
  return r === "WA" ? "WA" : "all";
}

export interface LocatorParams {
  q: string;
  geo: boolean;
  state: string;
  status: string;
  flavor: string;
}

function readParams(value: string): URLSearchParams {
  let raw = String(value || "");
  const qi = raw.indexOf("?");
  if (qi !== -1) raw = raw.substring(qi + 1);
  else if (raw.charAt(0) === "#") return new URLSearchParams();
  return new URLSearchParams(raw);
}

const STATUS_PARAMS = new Set(["stocked", "soon", "all", "delivered", "ordered"]);

/** Reads ?q= ?geo= ?state= ?status= ?flavor= from the search or (legacy) the hash. */
export function parseLocatorParams(search: string, hash: string): LocatorParams {
  const query = readParams(search);
  const hashQuery = readParams(hash);
  const get = (k: string) => (query.has(k) ? query.get(k) : hashQuery.get(k));
  const state = String(get("state") || "").trim().toUpperCase();
  const status = String(get("status") || "").trim().toLowerCase();
  const flavor = String(get("flavor") || "").trim().toLowerCase();
  return {
    q: String(get("q") || "").trim(),
    geo: get("geo") === "1",
    state: state === "WA" ? state : "",
    status: STATUS_PARAMS.has(status) ? status : "",
    flavor: /^[a-z0-9-]{1,48}$/.test(flavor) ? flavor : "",
  };
}
