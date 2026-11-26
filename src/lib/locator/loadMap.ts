import type * as Leaflet from "leaflet";

declare global {
  interface Window {
    L?: typeof Leaflet;
  }
}

let libs: Promise<typeof Leaflet> | null = null;

/**
 * Lazy-loads Leaflet + MarkerCluster + MapLibre GL + the MapLibre/Leaflet bridge,
 * like the original locator-loader.js, so the map never weighs on first paint.
 * MarkerCluster's UMD build attaches to a global `L`, so that is set first.
 */
export function loadMapLibs(): Promise<typeof Leaflet> {
  if (!libs) {
    libs = (async () => {
      await Promise.all([
        import("leaflet/dist/leaflet.css"),
        import("leaflet.markercluster/dist/MarkerCluster.css"),
        import("leaflet.markercluster/dist/MarkerCluster.Default.css"),
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      const L = (await import("leaflet")).default;
      window.L = L;
      await import("leaflet.markercluster");
      await import("maplibre-gl");
      await import("@maplibre/maplibre-gl-leaflet");
      return L;
    })().catch((err) => {
      libs = null;
      throw err;
    });
  }
  return libs;
}

export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
export const BASEMAP_ATTR =
  '<a href="https://openfreemap.org/">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
