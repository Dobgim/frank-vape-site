import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type * as Leaflet from "leaflet";
import type {} from "leaflet.markercluster";
import type {} from "@maplibre/maplibre-gl-leaflet";
import { emit, on } from "../lib/bus";
import { useAgeGate } from "../lib/ageGate";
import { isMobileViewport, prefersReducedMotion } from "../lib/dom";
import { feedToStores, loadStoreFeed, matchesStoreSearch, parseLocatorParams, resolveLocatorMarket, type Store, type StoreFeed } from "../lib/locator/feed";
import { directionsUrl, distanceMiles, ensureHttp, escapeHTML, hasCoords, safeHost, telHref } from "../lib/locator/format";
import { LaunchLayer, resolveStatus, statusOptions } from "../lib/locator/launch";
import { BASEMAP_ATTR, BASEMAP_STYLE, loadMapLibs } from "../lib/locator/loadMap";
import { brandStatus, clusterIconOptions, iconOptions, isSoon, isStocked, variantFor } from "../lib/locator/presentation";

const DEFAULT_CENTER: [number, number] = [47.4, -121.3];
const DEFAULT_ZOOM = 7;
const USER_ZOOM = 11;
const MOBILE_USER_ZOOM = 10;
const LICENSED_MARKET_VIEWBOX = "-124.8,49.0,-114.1,32.4";
const ZIP_RE = /^\d{5}(-\d{4})?$/;

type Origin = { lat: number; lng: number; label: string };
type MarkerWithState = Leaflet.Marker & { _mwahVariant: string; _mwahSelected: boolean };
type MapState = "idle" | "loading" | "ready" | "unavailable";

const Chevron = () => (
  <svg className="loc-filter-select__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LocationIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="9" cy="9" r="2.5" fill="currentColor" />
  </svg>
);

const SearchIcon = ({ line }: { line?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="2" />
    {line ? <line x1="14" y1="14" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
  </svg>
);

/** "Find us" section: header, search pill, live map + store list, FAQ (locator.js and friends). */
export default function FindUs() {
  const { accepted } = useAgeGate();
  const location = useLocation();
  const sectionRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLElement>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [activated, setActivated] = useState(false);
  const [feed, setFeed] = useState<StoreFeed | null>(null);
  const [feedState, setFeedState] = useState<"loading" | "ready" | "error">("loading");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [stateFilter, setStateFilter] = useState<"all" | "WA">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [flavor, setFlavor] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<Leaflet.LatLngBounds | null>(null);
  const [fitTick, setFitTick] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [mapState, setMapState] = useState<MapState>("idle");
  const [geoBusy, setGeoBusy] = useState(false);
  const [mobile, setMobile] = useState(isMobileViewport);

  const mapRef = useRef<Leaflet.Map | null>(null);
  const clusterRef = useRef<Leaflet.MarkerClusterGroup | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const markersRef = useRef<Record<string, MarkerWithState>>({});
  const statusTimer = useRef<ReturnType<typeof setTimeout>>();
  const pendingLink = useRef<{ flavor: string; status: string } | null>(null);
  const pendingFocus = useRef<{ id: string; focus: boolean } | null>(null);
  const appliedParams = useRef<string | null>(null);
  const lastAutoZip = useRef<string | null>(null);

  const stores = useMemo(() => feedToStores(feed), [feed]);
  const launch = useMemo(() => new LaunchLayer(feed), [feed]);
  const flavors = launch.flavors();

  const setStatus = useCallback((msg: string) => {
    setStatusMsg(msg);
    clearTimeout(statusTimer.current);
    if (msg) statusTimer.current = setTimeout(() => setStatusMsg(""), 6000);
  }, []);
  const refit = () => setFitTick((t) => t + 1);

  // ----- Filtering / sorting (computeSorted + filterStores) -----
  const filtered = useMemo(() => {
    let list: Store[] = stores.concat(launch.launchOnlyStores(flavor)).map((s) => ({ ...s }));
    if (origin) {
      list.forEach((s) => { s._distance = hasCoords(s) ? distanceMiles(origin.lat, origin.lng, s.lat, s.lng) : Infinity; });
      list.sort((a, b) => (a._distance || 0) - (b._distance || 0));
    }
    if (stateFilter !== "all") list = list.filter((s) => s._market === stateFilter);
    if (flavor !== "all") list = list.filter((s) => launch.matches(s, flavor, statusFilter));
    else if (statusFilter === "stocked") list = list.filter(isStocked);
    else if (statusFilter === "soon") list = list.filter(isSoon);
    if (nameFilter && !/^\d+$/.test(nameFilter)) list = list.filter((s) => matchesStoreSearch(s, nameFilter));
    return list;
  }, [stores, launch, flavor, origin, stateFilter, statusFilter, nameFilter]);
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  const viewList = useMemo(
    () => (bounds ? filtered.filter((s) => hasCoords(s) && bounds.contains([s.lat, s.lng])) : filtered),
    [filtered, bounds],
  );
  const listFilteredToMap = viewList.length !== filtered.length;
  const selectedId = activeId || (origin && viewList.length ? viewList[0].id : null);

  useEffect(() => {
    if (activeId && !filtered.some((s) => s.id === activeId)) setActiveId(null);
  }, [filtered, activeId]);

  // ----- Pills -----
  /** A flavor view shows that flavor's pill; All MWAH shows the MWAH pill, then one per launch. */
  const chips = useCallback((s: Store): { className: string; text: string }[] => {
    const launchPills = (f: string) => launch.chips(s, f).map((c) => ({ className: "loc-pill " + c.cls, text: c.text }));
    if (flavor !== "all") return launchPills(flavor);
    const status = brandStatus(s);
    const brand = status
      ? [{ className: "loc-pill" + (status.kind === "delivered" ? " loc-pill--restocked" : status.kind === "upcoming" ? " loc-pill--upcoming" : ""), text: "MWAH · " + status.text }]
      : [];
    return brand.concat(launchPills("all"));
  }, [flavor, launch]);

  const pinTitle = useCallback((s: Store) => {
    if (flavor !== "all") return launch.pinLabel(s, flavor);
    const status = brandStatus(s);
    return [status ? "MWAH · " + status.text : "", launch.pinLabel(s, "all")].filter(Boolean).join(", ");
  }, [flavor, launch]);

  // ----- Lazy activation (locator-loader.js triggers) -----
  useEffect(() => {
    if (!accepted || activated) return;
    const section = sectionRef.current;
    const hash = location.hash;
    if (/[?&](q|geo|state|status|flavor)=/.test(location.search + hash) || /^#(find-us|store-locator)([?&]|$)/.test(hash)) {
      setActivated(true);
      return;
    }
    if (!section) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setActivated(true);
    }, { rootMargin: isMobileViewport() ? "120px 0px" : "400px 0px" });
    io.observe(section);
    return () => io.disconnect();
  }, [accepted, activated, location.search, location.hash]);

  useEffect(() => {
    if (!activated) return;
    loadStoreFeed()
      .then((f) => { setFeed(f); setFeedState("ready"); refit(); })
      .catch(() => setFeedState("error"));
  }, [activated]);

  // ----- Map -----
  const createMap = useCallback(async () => {
    setMapState("loading");
    try {
      const L = await loadMapLibs();
      const el = mapElRef.current;
      if (!el || mapRef.current) return;
      LRef.current = L;
      const map = L.map(el, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, maxZoom: 19, scrollWheelZoom: true, zoomControl: false });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.maplibreGL({ style: BASEMAP_STYLE, attributionControl: { customAttribution: BASEMAP_ATTR } }).addTo(map);
      const cluster = L.markerClusterGroup({
        maxClusterRadius: 48,
        iconCreateFunction: (c) => L.divIcon(clusterIconOptions(c.getChildCount())),
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
      });
      map.addLayer(cluster);
      let t: ReturnType<typeof setTimeout> | undefined;
      map.on("moveend zoomend", () => {
        clearTimeout(t);
        t = setTimeout(() => setBounds(map.getBounds()), 80);
      });
      mapRef.current = map;
      clusterRef.current = cluster;
      setMapState("ready");
      setBounds(map.getBounds());
    } catch (err) {
      console.error("[locator] map renderer unavailable", err);
      setMapState("unavailable");
    }
  }, []);

  useEffect(() => {
    if (activated && mapState === "idle") createMap();
  }, [activated, mapState, createMap]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  useEffect(() => {
    const onResize = () => {
      setMobile(isMobileViewport());
      mapRef.current?.invalidateSize();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const popupHTML = useCallback((s: Store) => {
    const addr = [s.address, s.city].filter(Boolean).join(", ");
    const pieces = ['<span class="loc-popup__name">' + escapeHTML(s.name) + "</span>"];
    if (addr) pieces.push('<span class="loc-popup__addr">' + escapeHTML(addr) + "</span>");
    const tags = chips(s).map((c) => '<span class="' + c.className + '">' + escapeHTML(c.text) + "</span>").join("");
    if (tags) pieces.push('<span class="loc-popup__tags">' + tags + "</span>");
    const tel = telHref(s.phone);
    if (tel) pieces.push('<a class="loc-popup__link" href="' + escapeHTML(tel) + '">' + escapeHTML(s.phone) + "</a>");
    const host = safeHost(s.website);
    if (host) pieces.push('<a class="loc-popup__link" href="' + escapeHTML(ensureHttp(s.website)) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(host) + " ↗</a>");
    if (hasCoords(s)) pieces.push('<a class="loc-popup__link loc-popup__link--cta" href="' + escapeHTML(directionsUrl(s.lat, s.lng)) + '" target="_blank" rel="noopener noreferrer">Get directions →</a>');
    return pieces.join("<br>");
  }, [chips]);

  // Rebuild markers whenever the filtered set or the flavor view changes.
  useEffect(() => {
    const L = LRef.current;
    const cluster = clusterRef.current;
    if (mapState !== "ready" || !L || !cluster) return;
    cluster.clearLayers();
    const byId: Record<string, MarkerWithState> = {};
    const markers: Leaflet.Marker[] = [];
    for (const s of filtered) {
      if (!hasCoords(s)) continue;
      const variant = variantFor(s, flavor, launch);
      const label = pinTitle(s);
      const m = L.marker([s.lat, s.lng], { icon: L.divIcon(iconOptions(variant, false)), title: s.name + (label ? ", " + label : "") }) as MarkerWithState;
      m._mwahVariant = variant;
      m._mwahSelected = false;
      m.bindPopup(popupHTML(s), { minWidth: 210, maxWidth: 240 });
      m.on("click", () => {
        pendingFocus.current = { id: s.id, focus: false };
        setActiveId(s.id);
      });
      markers.push(m);
      byId[s.id] = m;
    }
    cluster.addLayers(markers);
    markersRef.current = byId;
  }, [filtered, flavor, launch, mapState, pinTitle, popupHTML]);

  // Fit after actions that call refresh() without keepView.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (mapState !== "ready" || !map || !L || !fitTick) return;
    if (origin) {
      map.setView([origin.lat, origin.lng], isMobileViewport() ? MOBILE_USER_ZOOM : USER_ZOOM, { animate: false });
      return;
    }
    const b = L.latLngBounds([]);
    filteredRef.current.forEach((s) => { if (hasCoords(s)) b.extend([s.lat, s.lng]); });
    if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 10, animate: false });
    else map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTick, mapState]);

  // Selected marker artwork.
  useEffect(() => {
    const L = LRef.current;
    if (!L) return;
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const selected = id === selectedId;
      if (marker._mwahSelected === selected) return;
      marker._mwahSelected = selected;
      marker.setIcon(L.divIcon(iconOptions(marker._mwahVariant, selected)));
      marker.setZIndexOffset(selected ? 1000 : 0);
    });
  }, [selectedId, filtered, mapState]);

  // Scroll the list back to the top when its membership changes.
  const signature = viewList.map((s) => s.id).join("|");
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [signature]);

  // After a card or pin is chosen, bring its row into view (highlightCard).
  useEffect(() => {
    const p = pendingFocus.current;
    if (!p || p.id !== activeId) return;
    pendingFocus.current = null;
    const row = listRef.current?.querySelector<HTMLElement>(`.loc-row[data-id="${CSS.escape(p.id)}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
    if (p.focus) row.querySelector<HTMLElement>(".loc-row__select")?.focus({ preventScroll: true });
  }, [activeId, viewList]);

  // ----- Actions -----
  const scrollToFindUs = () => {
    bodyRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  };

  const searchQuery = useCallback((raw: string) => {
    const q = String(raw || "").trim();
    if (!q) return;
    setStatus("");
    const url = "https://nominatim.openstreetmap.org/search?countrycodes=us&viewbox=" + LICENSED_MARKET_VIEWBOX +
      "&bounded=1&format=json&limit=1&q=" + encodeURIComponent(q);
    fetch(url, { headers: { Accept: "application/json" }, referrerPolicy: "no-referrer" })
      .then((r) => r.json())
      .then((arr: { lat: string; lon: string; display_name?: string }[]) => {
        if (!Array.isArray(arr) || !arr.length) {
          setStatus(`Couldn't find "${q}". Try another ZIP or city.`);
          return;
        }
        const lat = parseFloat(arr[0].lat);
        const lng = parseFloat(arr[0].lon);
        if (isNaN(lat) || isNaN(lng)) return;
        setOrigin({ lat, lng, label: arr[0].display_name || q });
        refit();
        scrollToFindUs();
      })
      .catch(() => setStatus("Search failed. Try again."));
  }, [setStatus]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("Your browser doesn't support location. Try entering a ZIP.");
      return;
    }
    setGeoBusy(true);
    setStatus("");
    navigator.geolocation.getCurrentPosition((pos) => {
      setNameFilter("");
      setQuery("");
      setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your location" });
      setGeoBusy(false);
      refit();
      scrollToFindUs();
    }, () => {
      setGeoBusy(false);
      setStatus("Couldn't get your location. Try a ZIP code.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 });
  }, [setStatus]);

  const applyState = useCallback((value: string) => {
    const next = resolveLocatorMarket("all", value);
    setStateFilter(next);
    setOrigin(null);
    setActiveId(null);
    setNameFilter("");
    setQuery("");
    setStatus(next === "all" ? "Showing all stores." : "Showing " + next + " stores.");
    refit();
  }, [setStatus]);

  const applyFilter = (value: string) => {
    const next = resolveStatus(flavor, value);
    setStatusFilter(next);
    refit();
  };

  const pendingResultMessage = useRef<{ flavor: string; status: string } | null>(null);
  const applyFlavor = useCallback((value: string, fromLink: string | false) => {
    const next = launch.isKnown(value) ? value : "all";
    const nextStatus = resolveStatus(next, fromLink || "");
    setFlavor(next);
    setStatusFilter(nextStatus);
    setActiveId(null);
    if (fromLink) refit();
    // The count is only known after the next render; resultMessage reads it there.
    pendingResultMessage.current = { flavor: next, status: nextStatus };
  }, [launch]);
  useEffect(() => {
    const p = pendingResultMessage.current;
    if (!p || p.flavor !== flavor) return;
    pendingResultMessage.current = null;
    setStatus(launch.resultMessage(flavor, filtered.length, statusFilter));
  }, [flavor, statusFilter, filtered, launch, setStatus]);

  // Status message after a STATUS change in a flavor view.
  const onStatusChange = (value: string) => {
    applyFilter(value);
    if (flavor !== "all") pendingResultMessage.current = { flavor, status: value };
  };

  // In-page requests from the hero CTA and the request modal.
  useEffect(() => on("locator:flavor", ({ flavor: f }) => {
    if (feedState !== "ready") pendingLink.current = { flavor: f, status: "" };
    else applyFlavor(f, "link");
  }), [feedState, applyFlavor]);

  useEffect(() => on("locator:find", ({ market, zip }) => {
    applyState(market);
    searchQuery(zip);
  }), [applyState, searchQuery]);

  // Deep-link parameters (?q ?geo ?state ?status ?flavor), applied once the feed is in.
  useEffect(() => {
    if (feedState !== "ready") return;
    const key = location.search + location.hash;
    if (appliedParams.current === key) return;
    appliedParams.current = key;
    const p = parseLocatorParams(location.search, location.hash);
    if (p.state) setStateFilter(resolveLocatorMarket("all", p.state));
    if (p.status && !p.flavor) setStatusFilter(p.status === "stocked" || p.status === "soon" ? p.status : "all");
    const link = pendingLink.current ?? (p.flavor ? { flavor: p.flavor, status: p.status } : null);
    pendingLink.current = null;
    if (link) {
      if (launch.isKnown(link.flavor)) applyFlavor(link.flavor, link.status || "link");
      else setStatus("That flavor filter isn't available right now. Showing all MWAH stores.");
    }
    if (p.q) {
      setQuery(p.q);
      searchQuery(p.q);
    } else if (p.geo) {
      locateMe();
    }
    if (p.state || p.status || p.flavor) refit();
  }, [feedState, location.search, location.hash, launch, applyFlavor, searchQuery, locateMe, setStatus]);

  // ----- Search pill -----
  const onInput = (value: string) => {
    setQuery(value);
    setStatus("");
    setNameFilter(value.trim().toLowerCase());
    setActivated(true);
    refit();
  };

  useEffect(() => {
    const v = query.trim();
    if (!ZIP_RE.test(v) || v === lastAutoZip.current) return;
    const t = setTimeout(() => {
      lastAutoZip.current = v;
      searchQuery(v);
    }, 350);
    return () => clearTimeout(t);
  }, [query, searchQuery]);

  const hasQuery = query.trim() !== "";

  // ----- List -----
  const onCardClick = (s: Store) => {
    const marker = markersRef.current[s.id];
    const map = mapRef.current;
    if (marker && map && !isMobileViewport()) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13), { animate: !prefersReducedMotion() });
      marker.openPopup();
    }
    pendingFocus.current = { id: s.id, focus: true };
    setActiveId(s.id);
  };

  const onViewMap = (s: Store) => {
    const marker = markersRef.current[s.id];
    const map = mapRef.current;
    if (!marker || !map) return;
    setActiveId(s.id);
    map.invalidateSize();
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), { animate: false });
    mapElRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    mapElRef.current?.focus({ preventScroll: true });
    marker.openPopup();
  };

  const countText = feedState !== "ready"
    ? feedState === "error" ? "" : "Loading stores…"
    : !stores.length ? "0 stores"
      : listFilteredToMap
        ? mobile ? `${viewList.length} in view` : `${viewList.length} stores in view`
        : mobile ? (origin ? `${viewList.length} nearest` : `${viewList.length} stores`) : `${viewList.length} stores near you`;

  const emptyMessage = filtered.length && listFilteredToMap
    ? "No stores in this map view. Pan or zoom out."
    : flavor !== "all" ? launch.emptyMessage(flavor, statusFilter) : "No stores match. Try a different ZIP or city.";

  const subText = feedState === "ready" && stores.length
    ? mobile
      ? `${stores.length} dispensaries. Search your city or explore the map.`
      : `The nearest store is almost always closer than you think. Find MWAH at ${stores.length} dispensaries near you — restocked weekly.`
    : "Find licensed retailers carrying MWAH. Search by ZIP, city, or store name, or use your current location.";

  const flavorFieldShown = feedState === "ready" && flavors.length > 0;

  return (
    <>
      <section className="op-find-header" id="find-us" ref={sectionRef}>
        <div className="op-find-header__copy">
          <div className="op-eyebrow">
            <span className="op-dot" aria-hidden="true"></span>
            <span className="op-eyebrow__text">FIND US</span>
          </div>
          <h2 className="op-find-header__title">She&rsquo;s in stock.</h2>
          <p className="op-find-header__sub">{subText}</p>
        </div>
        <form
          id="locSearchForm"
          className="op-search-pill"
          role="search"
          aria-label="Find stores"
          autoComplete="off"
          onSubmit={(e) => { e.preventDefault(); setActivated(true); searchQuery(query); }}
        >
          <button id="locSearchBtn" type="submit" className="op-search-pill__submit" aria-label="Search stores">
            <SearchIcon line />
          </button>
          <input
            ref={inputRef}
            id="locSearchInput"
            className="op-search-pill__input"
            name="q"
            type="search"
            inputMode="search"
            placeholder="ZIP, city, or store name"
            aria-label="Find stores near you — ZIP, city, or store name"
            value={query}
            onFocus={() => setActivated(true)}
            onChange={(e) => onInput(e.target.value)}
          />
          <button
            id="locGeoBtn"
            type="button"
            className="op-search-pill__gps"
            aria-label={hasQuery ? "Search stores" : "Use my location"}
            disabled={geoBusy}
            onClick={() => { setActivated(true); if (hasQuery) searchQuery(query); else locateMe(); }}
          >
            {hasQuery ? <SearchIcon /> : <LocationIcon />}
          </button>
        </form>
        <p id="locSearchStatus" className={"loc-search__status" + (statusMsg ? " loc-search__status--visible" : "")} role="status" aria-live="polite">{statusMsg}</p>
      </section>

      <section className="op-find-body" id="store-locator" ref={bodyRef}>
        <div className="loc-main">
          <div className="loc-main__left">
            <p id="locMapInstructions" className="visually-hidden">Use arrow keys to pan, plus and minus to zoom, or use the store list next to or below the map.</p>
            <div className="loc-map__filters">
              <div className="loc-filter-field loc-filter-field--state" hidden={flavorFieldShown}>
                <label className="loc-filter-field__label" htmlFor="locStateFilter">STATE</label>
                <div className="loc-filter-select-wrap">
                  <select className="loc-filter-select" id="locStateFilter" value={stateFilter} onFocus={() => setActivated(true)} onChange={(e) => applyState(e.target.value)}>
                    <option value="all">ALL</option>
                    <option value="WA">WA</option>
                  </select>
                  <Chevron />
                </div>
              </div>
              <div className="loc-filter-field loc-filter-field--flavor" hidden={!flavorFieldShown}>
                <label className="loc-filter-field__label" htmlFor="locFlavorFilter">FLAVOR</label>
                <div className="loc-filter-select-wrap">
                  <select className="loc-filter-select" id="locFlavorFilter" value={flavor} onChange={(e) => applyFlavor(e.target.value, false)}>
                    <option value="all">ALL MWAH</option>
                    {flavors.map((slug) => <option key={slug} value={slug}>{launch.shortLabel(slug).toUpperCase()}</option>)}
                  </select>
                  <Chevron />
                </div>
              </div>
              <div className="loc-filter-field loc-filter-field--status">
                <label className="loc-filter-field__label" htmlFor="locStatusFilter">STATUS</label>
                <div className="loc-filter-select-wrap">
                  <select className="loc-filter-select" id="locStatusFilter" value={statusFilter} onFocus={() => setActivated(true)} onChange={(e) => onStatusChange(e.target.value)}>
                    {statusOptions(flavor).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <Chevron />
                </div>
              </div>
            </div>
            <div
              id="locMap"
              ref={mapElRef}
              className={"loc-map" + (flavor !== "all" ? " loc-map--flavor" : "")}
              role={mapState === "unavailable" ? "group" : "application"}
              tabIndex={0}
              aria-label={mapState === "unavailable" ? "Store map unavailable" : "Map of stores"}
              aria-describedby="locMapInstructions"
            >
              <div className="loc-map__loading" role="status">
                {mapState === "unavailable" ? (
                  <>
                    <span>Map unavailable. Browse stores in the list.</span>
                    <button type="button" className="loc-link loc-link--primary" onClick={() => setMapState("idle")}>Retry map</button>
                  </>
                ) : "Loading store map"}
              </div>
            </div>
            <ul className="loc-legend" aria-label="Map symbols">
              <li><span className="loc-legend__mark loc-legend__mark--restocked" aria-hidden="true"><svg className="loc-pin__check" viewBox="0 0 28 28"><path d="m7 14 5 5 9-12" /></svg></span>Restocked</li>
              <li><span className="loc-legend__mark" aria-hidden="true"><svg className="loc-pin__clock" viewBox="0 0 28 28"><path d="M14 6v8l6 4" /></svg></span>Coming soon</li>
              <li><span className="loc-legend__mark" aria-hidden="true">12</span>Stores</li>
            </ul>
            <p className="loc-availability-hint">Call to confirm stock.</p>
          </div>
          <div className="loc-list">
            <div className="loc-list__header">
              <h3 className="loc-list__count" id="locListCount">{countText}</h3>
              <span className="loc-list__sort">By Distance</span>
            </div>
            <div id="locList" ref={listRef} className="loc-list__items" aria-live="polite">
              {feedState === "loading" && <div className="loc-empty loc-loading">Finding stores</div>}
              {feedState === "error" && <div className="loc-empty">Couldn&apos;t load the store list. Please try again in a moment.</div>}
              {feedState === "ready" && !stores.length && <div className="loc-empty">No stores available right now. Check back soon.</div>}
              {feedState === "ready" && stores.length > 0 && !viewList.length && <div className="loc-empty">{emptyMessage}</div>}
              {feedState === "ready" && viewList.map((s) => {
                const isActive = s.id === selectedId;
                const distance = typeof s._distance === "number" && isFinite(s._distance)
                  ? s._distance < 0.1 ? "< 0.1 MI" : s._distance.toFixed(1) + " MI" : "";
                const meta = [[s.address, s.city].filter(Boolean).join(", "), s.phone || "", safeHost(s.website)].filter(Boolean).join(" · ");
                const pills = chips(s);
                const select = (
                  <button type="button" className="loc-row__select" data-id={s.id} aria-expanded={isActive} aria-label={"Show details for " + s.name} onClick={() => onCardClick(s)}>
                    <div className="loc-row__top">
                      <div className="loc-row__left">
                        <span className={"loc-row__pin loc-row__pin--" + variantFor(s, flavor, launch)} aria-hidden="true"></span>
                        <h3 className="loc-row__name">{s.name}</h3>
                      </div>
                      {isActive && <span className="loc-row__selected">Selected</span>}
                      {distance && <span className="loc-row__dist">{distance}</span>}
                    </div>
                    {meta && <p className="loc-row__addr">{meta}</p>}
                    {pills.length > 0 && (
                      <div className="loc-row__badges">
                        {pills.map((c) => <span key={c.text} className={c.className}>{c.text}</span>)}
                      </div>
                    )}
                  </button>
                );
                if (!isActive) return <article key={s.id} className="loc-row" data-id={s.id}>{select}</article>;
                const tel = telHref(s.phone);
                return (
                  <article key={s.id} className="loc-row loc-row--active" data-id={s.id}>
                    <div className="loc-row__card">
                      {select}
                      <div className="loc-row__actions">
                        {hasCoords(s) && (
                          <>
                            <button type="button" className="loc-link loc-link--map" data-id={s.id} onClick={() => onViewMap(s)}>VIEW ON MAP</button>
                            <a className="loc-link loc-link--primary" href={directionsUrl(s.lat, s.lng)} target="_blank" rel="noopener noreferrer">DIRECTIONS →</a>
                          </>
                        )}
                        {tel && <a className="loc-link" href={tel}>CALL</a>}
                        {s.website && <a className="loc-link" href={ensureHttp(s.website)} target="_blank" rel="noopener noreferrer">WEBSITE</a>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
        <section className="op-find-faq" aria-labelledby="findFaqTitle">
          <h3 id="findFaqTitle">Finding MWAH near you</h3>
          <div className="op-find-faq__list">
            <details className="op-find-faq__item" open>
              <summary className="op-find-faq__q">Where can I buy MWAH?</summary>
              <div className="op-find-faq__a">
                MWAH is sold through licensed cannabis retailers. Search above by ZIP, city, store name, or current location.{" "}
                <span className="op-find-faq__request">
                  Don&rsquo;t see your shop?{" "}
                  <button type="button" id="reqCtaBtn" className="op-find-faq__request-link" aria-haspopup="dialog" onClick={() => emit("request:open", undefined)}>Request MWAH</button>
                </span>
              </div>
            </details>
            <details className="op-find-faq__item">
              <summary className="op-find-faq__q">Can I buy MWAH online?</summary>
              <div className="op-find-faq__a">No. MWAH does not sell or ship cannabis products online. The locator directs adults 21 and older to licensed retailers.</div>
            </details>
            <details className="op-find-faq__item">
              <summary className="op-find-faq__q">How current is store availability?</summary>
              <div className="op-find-faq__a">Availability can change. Use the latest published status in the locator and call the retailer before visiting to confirm that MWAH is in stock.</div>
            </details>
          </div>
        </section>
      </section>
    </>
  );
}
