import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAgeGate } from "../lib/ageGate";
import { makeSiblingsInert, readStorage, trapTab, writeStorage } from "../lib/dom";
import { hasNewsletterSignup, surveyBucket } from "../lib/signup";
import { CloseIcon } from "./Icons";
import { FollowRow, SignupConfirmation, StatusLine, useSignupSubmit } from "./Signup";

const DISMISSED_UNTIL_KEY = "mwah_newsletter_popup_dismissed_until";
const SEEN_SESSION_KEY = "mwah_newsletter_popup_seen";
const DISMISS_DAYS = 14;
const OPEN_DELAY_MS = 10000;
const SCROLL_THRESHOLD = 0.5;

function isSuppressed(): boolean {
  const until = Number(readStorage("local", DISMISSED_UNTIL_KEY) || 0);
  return hasNewsletterSignup() || readStorage("session", SEEN_SESSION_KEY) === "1" || (Number.isFinite(until) && until > Date.now());
}

function hasBlockingSurface(): boolean {
  const req = document.getElementById("reqScrim");
  const drawer = document.getElementById("navDrawer");
  return Boolean((req && req.classList.contains("is-open")) || (drawer && !drawer.hasAttribute("hidden")));
}

type View = "ask" | "follow" | "confirmed";

/** Delayed homepage newsletter popup (signup-popup.js): eligible only after the 21+ gate. */
export default function SignupPopup() {
  const { accepted } = useAgeGate();
  const [visible, setVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("ask");
  const [bucket] = useState(surveyBucket);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const lastFocus = useRef<Element | null>(null);
  const dismissalRecorded = useRef(false);
  const state = useSignupSubmit("popup", () => setView("confirmed"));

  const open = useCallback(() => {
    if (isSuppressed()) return false;
    if (hasBlockingSurface()) return "retry" as const;
    writeStorage("session", SEEN_SESSION_KEY, "1");
    dismissalRecorded.current = false;
    lastFocus.current = document.activeElement;
    setView("ask");
    setVisible(true);
    return true;
  }, []);

  // Triggers: 10s after the gate, or once the visitor reaches half the page.
  useEffect(() => {
    if (!accepted || isSuppressed()) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const attempt = () => {
      if (done) return;
      const r = open();
      if (r === "retry") {
        clearTimeout(retry);
        retry = setTimeout(attempt, 1000);
        return;
      }
      done = true;
      cleanup();
    };
    const onScroll = () => {
      const root = document.documentElement;
      const pageHeight = Math.max(root.scrollHeight, document.body.scrollHeight);
      const vh = window.innerHeight || 0;
      if (pageHeight <= vh || window.scrollY >= (pageHeight - vh) * SCROLL_THRESHOLD) attempt();
    };
    const timer = setTimeout(attempt, OPEN_DELAY_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onSubscribed = () => { done = true; cleanup(); };
    document.addEventListener("mwah:newsletter-subscribed", onSubscribed);
    function cleanup() {
      clearTimeout(timer);
      clearTimeout(retry);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mwah:newsletter-subscribed", onSubscribed);
    }
    return cleanup;
  }, [accepted, open]);

  useEffect(() => {
    if (!visible || !rootRef.current) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restore = makeSiblingsInert(rootRef.current);
    const raf = requestAnimationFrame(() => setIsOpen(true));
    const t = setTimeout(() => rootRef.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus(), 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      restore();
      document.body.style.overflow = prevOverflow;
      setIsOpen(false);
      const el = lastFocus.current as HTMLElement | null;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [visible]);

  const recordDismissal = () => {
    if (dismissalRecorded.current) return;
    dismissalRecorded.current = true;
    writeStorage("local", DISMISSED_UNTIL_KEY, String(Date.now() + DISMISS_DAYS * 86400000));
  };

  /** First dismissal swaps in the follow offer; the next one closes. Escape always closes. */
  const close = (rememberDismissal: boolean, skipFollowOffer = false) => {
    if (rememberDismissal) recordDismissal();
    if (rememberDismissal && !skipFollowOffer && view === "ask" && !hasNewsletterSignup()) {
      setView("follow");
      return;
    }
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (dismissalRecorded.current === false) writeStorage("local", DISMISSED_UNTIL_KEY, String(Date.now() + DISMISS_DAYS * 86400000));
        setVisible(false);
        return;
      }
      if (dialogRef.current) {
        trapTab(e, dialogRef.current, 'button:not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])');
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  const labelledBy = view === "follow" ? "signupPopupFollowTitle" : "signupPopupTitle";

  return (
    <div ref={rootRef} className={"signup-popup" + (isOpen ? " is-open" : "")} id="signupPopup" hidden={!visible}>
      <button className="signup-popup__backdrop" type="button" tabIndex={-1} data-signup-popup-backdrop aria-label="Close signup popup" onClick={() => close(true)} />
      <section
        ref={dialogRef}
        className="signup-popup__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={view === "ask" ? "signupPopupDescription" : undefined}
      >
        <button className="signup-popup__close" type="button" data-signup-popup-close aria-label="Close signup popup" onClick={() => close(true)}>
          <CloseIcon />
        </button>
        <div className="signup-popup__visual" aria-hidden="true" />
        <div className={"signup-popup__content" + (view !== "ask" ? " signup-popup__content--confirmed" : "")}>
          {view === "confirmed" ? (
            <div className="op-signup__confirm op-signup__confirm--inline" role="status" aria-live="polite">
              <SignupConfirmation follow survey={bucket === "b"} titleId="signupPopupTitle" />
            </div>
          ) : (
            <>
              <div className="signup-popup__ask" hidden={view !== "ask"}>
                <p className="signup-popup__eyebrow">DON&rsquo;T MISS A DROP</p>
                <h2 className="signup-popup__title" id="signupPopupTitle">Know where MWAH lands next.</h2>
                <p className="signup-popup__description" id="signupPopupDescription">
                  Launch updates, store news, and what drops next &mdash; straight to your inbox.
                </p>
                <form data-signup data-source="popup" className="signup-popup__form" aria-describedby="signupPopupConsent" onSubmit={state.onSubmit}>
                  <input type="text" name="hp" tabIndex={-1} autoComplete="off" className="visually-hidden" aria-hidden="true" />
                  <label className="signup-popup__label" htmlFor="signupPopupEmail">EMAIL</label>
                  <input id="signupPopupEmail" className="signup-popup__input" type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
                  <button type="submit" className="signup-popup__submit" disabled={state.busy}>KEEP ME POSTED</button>
                  <p id="signupPopupConsent" className="signup-popup__consent">
                    By subscribing you agree to our <Link to="/terms" onClick={() => setVisible(false)}>Terms</Link> and{" "}
                    <Link to="/privacy" onClick={() => setVisible(false)}>Privacy Policy</Link>.
                  </p>
                  <StatusLine className="signup-popup__status" state={state} />
                </form>
              </div>
              {view === "follow" && (
                <div className="op-signup__confirm op-signup__confirm--inline" role="status" aria-live="polite">
                  <FollowRow titleId="signupPopupFollowTitle" autoFocusTitle />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
