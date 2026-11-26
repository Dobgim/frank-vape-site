import { SIGNUP_ENDPOINT, STORE_REQUEST_ENDPOINT } from "../config";
import { readStorage, writeStorage } from "./dom";

const SIGNED_UP_KEY = "mwah_newsletter_signed_up";
const LOCAL_SIGNUPS_KEY = "mwah_local_signups";
const LOCAL_REQUESTS_KEY = "mwah_local_store_requests";
const SURVEY_BUCKET_KEY = "mwah_signup_survey_bucket";

export function hasNewsletterSignup(): boolean {
  return readStorage("local", SIGNED_UP_KEY) === "1";
}

export function rememberNewsletterSignup(source: string): void {
  writeStorage("local", SIGNED_UP_KEY, "1");
  document.dispatchEvent(new CustomEvent("mwah:newsletter-subscribed", { detail: { source } }));
}

function appendLocal(key: string, record: Record<string, unknown>) {
  let list: unknown[] = [];
  try {
    list = JSON.parse(readStorage("local", key) || "[]");
  } catch {
    list = [];
  }
  list.push({ ...record, at: new Date().toISOString() });
  writeStorage("local", key, JSON.stringify(list));
}

function readUTM() {
  const p = new URLSearchParams(location.search);
  return { source: p.get("utm_source"), medium: p.get("utm_medium"), campaign: p.get("utm_campaign") };
}

export type SubmitResult = "ok" | "rate_limited" | "invalid" | "error";

async function post(endpoint: string, body: Record<string, unknown>): Promise<SubmitResult> {
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (resp.status === 429) return "rate_limited";
    if (resp.status === 400) return "invalid";
    return resp.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

const pause = () => new Promise((r) => setTimeout(r, 450));

export async function submitNewsletter(email: string, hp: string, source: string): Promise<SubmitResult> {
  if (hp) return "ok"; // honeypot filled: pretend success, store nothing
  const body = { email, hp, source, agreed: true, utm: readUTM() };
  if (SIGNUP_ENDPOINT) return post(SIGNUP_ENDPOINT, body);
  appendLocal(LOCAL_SIGNUPS_KEY, body);
  await pause();
  return "ok";
}

export async function submitStoreRequest(body: Record<string, unknown>): Promise<SubmitResult> {
  if (body.hp) return "ok";
  if (STORE_REQUEST_ENDPOINT) return post(STORE_REQUEST_ENDPOINT, body);
  appendLocal(LOCAL_REQUESTS_KEY, body);
  await pause();
  return "ok";
}

export function surveyBucket(): "a" | "b" {
  const stored = readStorage("local", SURVEY_BUCKET_KEY);
  if (stored === "a" || stored === "b") return stored;
  const assigned = Math.random() < 0.5 ? "a" : "b";
  writeStorage("local", SURVEY_BUCKET_KEY, assigned);
  return assigned;
}
