/**
 * Site configuration.
 *
 * The original site posts newsletter signups and store requests to the
 * brand's own Firebase functions. This rebuild never sends visitor data
 * there. Leave an endpoint empty to keep submissions in this browser only
 * (localStorage, visible in DevTools), or point it at your own backend,
 * which receives the same JSON body the original sent.
 */
export const SIGNUP_ENDPOINT = "";
export const STORE_REQUEST_ENDPOINT = "";

/** Local snapshot of the public retailer feed (public/data/stores.json). */
export const STORE_FEED_URL = "/data/stores.json";

export const SOCIAL = {
  instagram: "https://instagram.com/gimmemwah",
  x: "https://x.com/gimmemwah",
  tiktok: "https://www.tiktok.com/@gimmemwah",
} as const;

export const UNDER_21_REDIRECT = "https://www.samhsa.gov/";
