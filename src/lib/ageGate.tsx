import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const COOKIE_NAME = "mwah_ageok";
const BOT_RE = /Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|Twitterbot|LinkedInBot|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|Applebot|Amazonbot|meta-externalagent/i;

export function hasAgeCookie(): boolean {
  return document.cookie.split(";").some((c) => c.trim().indexOf(COOKIE_NAME + "=1") === 0);
}

function initialAccepted(): boolean {
  return hasAgeCookie() || BOT_RE.test(navigator.userAgent || "");
}

type AgeGateValue = { accepted: boolean; accept: () => void };
const AgeGateContext = createContext<AgeGateValue>({ accepted: false, accept: () => {} });

export function AgeGateProvider({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState(initialAccepted);

  const accept = useCallback(() => {
    // Session cookie: no max-age / expires, so it dies when the browser closes.
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = COOKIE_NAME + "=1; Path=/; SameSite=Lax" + secure;
    setAccepted(true);
    document.dispatchEvent(new CustomEvent("mwah:age-accepted"));
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = accepted ? "" : "hidden";
  }, [accepted]);

  return <AgeGateContext.Provider value={{ accepted, accept }}>{children}</AgeGateContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAgeGate = () => useContext(AgeGateContext);
