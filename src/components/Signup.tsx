import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { SOCIAL } from "../config";
import { rememberNewsletterSignup, submitNewsletter } from "../lib/signup";
import { CheckIcon, InstagramIcon, TikTokIcon, XIcon } from "./Icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface SignupState {
  status: string;
  statusColor: string;
  busy: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

/** Shared submit flow from email-signup.js: validate, honeypot, submit, confirm. */
export function useSignupSubmit(source: string, onSuccess: () => void): SignupState {
  const [status, setStatus] = useState("");
  const [statusColor, setStatusColor] = useState("var(--ink)");
  const [busy, setBusy] = useState(false);

  const say = (msg: string, color: string) => {
    setStatus(msg);
    setStatusColor(color);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const emailEl = form.querySelector<HTMLInputElement>('input[type="email"]');
    const hpEl = form.querySelector<HTMLInputElement>('input[name="hp"]');
    if (!emailEl) return;
    const email = String(emailEl.value || "").trim();
    if (!EMAIL_RE.test(email)) {
      say("Please enter a valid email address.", "var(--hot-pink)");
      emailEl.focus();
      return;
    }
    setBusy(true);
    say("Submitting…", "var(--text-mid)");
    const result = await submitNewsletter(email, hpEl?.value ?? "", source);
    setBusy(false);
    if (result === "rate_limited") return say("Too many submits in a row — try again in a minute.", "var(--hot-pink)");
    if (result !== "ok") return say("Something went wrong. Try again?", "var(--hot-pink)");
    form.reset();
    say("", "var(--ink)");
    onSuccess();
    rememberNewsletterSignup(source);
  };

  return { status, statusColor, busy, onSubmit };
}

export function StatusLine({ className, state }: { className: string; state: SignupState }) {
  return (
    <p
      data-signup-status
      className={className + (state.status ? "" : " visually-hidden")}
      role="status"
      aria-live="polite"
      style={{ color: state.statusColor }}
    >
      {state.status}
    </p>
  );
}

const FOLLOW_ACCOUNTS = [
  { platform: "instagram", name: "Instagram", label: "INSTAGRAM", href: SOCIAL.instagram, icon: <InstagramIcon /> },
  { platform: "tiktok", name: "TikTok", label: "TIKTOK", href: SOCIAL.tiktok, icon: <TikTokIcon /> },
  { platform: "x", name: "X", label: "X", href: SOCIAL.x, icon: <XIcon /> },
];

/** "Follow us on our socials" row (signup-followup.js). A follow counts once the visitor returns to the tab. */
export function FollowRow({ ariaLive, titleId, autoFocusTitle }: { ariaLive?: "off" | "polite"; titleId?: string; autoFocusTitle?: boolean }) {
  const [opened, setOpened] = useState<string[]>([]);
  const pending = useRef<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const confirm = () => {
      if (document.visibilityState !== "visible" || !pending.current) return;
      const platform = pending.current;
      pending.current = null;
      setOpened((list) => (list.includes(platform) ? list : [...list, platform]));
    };
    document.addEventListener("visibilitychange", confirm);
    window.addEventListener("focus", confirm);
    return () => {
      document.removeEventListener("visibilitychange", confirm);
      window.removeEventListener("focus", confirm);
    };
  }, []);

  useEffect(() => {
    if (autoFocusTitle) titleRef.current?.focus();
  }, [autoFocusTitle]);

  const remaining = FOLLOW_ACCOUNTS.length - opened.length;
  const tail = remaining === 0 ? "That's all three." : remaining === 1 ? "One to go." : `${remaining} to go.`;

  return (
    <div className="op-signup__follow" data-signup-follow aria-live={ariaLive}>
      {opened.length > 0 && (
        <p className="op-signup__follow-note" role="status">
          <CheckIcon size={12} strokeWidth={3} d="m5 13 4 4L19 7" />
          {tail}
        </p>
      )}
      <p className="op-signup__follow-eyebrow">FOR ALL THE BADDIES</p>
      <h2 className="op-signup__follow-title" id={titleId} ref={titleRef} tabIndex={autoFocusTitle ? -1 : undefined}>
        Follow us on our socials.
      </h2>
      <div className="op-signup__follow-list">
        {FOLLOW_ACCOUNTS.map((a) => (
          <a
            key={a.platform}
            className={"op-signup__follow-link" + (opened.includes(a.platform) ? " is-opened" : "")}
            href={a.href}
            target="_blank"
            rel="noopener noreferrer"
            data-follow-platform={a.platform}
            aria-label={`Follow MWAH on ${a.name} (opens in new tab)`}
            onClick={() => { pending.current = a.platform; }}
          >
            {a.icon}
            <span>{a.label}</span>
            <span className="op-signup__follow-check" aria-hidden="true">
              <CheckIcon size={10} strokeWidth={4} d="m5 13 4 4L19 7" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

const DISCOVERY = [
  ["instagram", "Instagram"], ["tiktok", "TikTok"], ["x", "X"], ["search", "Google or Bing"],
  ["ai_assistant", "ChatGPT or another AI"], ["retailer", "A dispensary"], ["friend", "A friend"], ["other", "Somewhere else"],
] as const;

function DiscoverySurvey() {
  const [answered, setAnswered] = useState(false);
  return (
    <fieldset className="op-signup__discovery" data-signup-discovery>
      {answered ? (
        <p className="op-signup__discovery-thanks" role="status" aria-live="polite">Thanks.</p>
      ) : (
        <>
          <legend className="op-signup__discovery-question">How did you hear about MWAH? <span>Optional.</span></legend>
          <div className="op-signup__discovery-options">
            {DISCOVERY.map(([value, label]) => (
              <button key={value} type="button" className="op-signup__discovery-option" data-discovery-source={value} onClick={() => setAnswered(true)}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}

/** "You're on the list." card. Footer: survey only. Popup: follow row, plus survey for bucket "b". */
export function SignupConfirmation({ follow, survey, titleId }: { follow: boolean; survey: boolean; titleId?: string }) {
  return (
    <>
      <div className="op-signup__confirm-icon" aria-hidden="true">
        <CheckIcon />
      </div>
      <div className="op-signup__confirm-body">
        <h3 className="op-signup__confirm-title" id={titleId}>You’re on the list.</h3>
        <p className="op-signup__confirm-msg">
          We’ll send MWAH updates here. Email <a href="mailto:info@gimmemwah.com">info@gimmemwah.com</a> to unsubscribe.
        </p>
      </div>
      {follow && <FollowRow ariaLive="off" />}
      {survey && <DiscoverySurvey />}
    </>
  );
}

/** Homepage newsletter block that footer-signup.js moves into the footer's brand slot. */
export function FooterSignup() {
  const [confirmed, setConfirmed] = useState(false);
  const state = useSignupSubmit("footer", () => setConfirmed(true));

  if (confirmed) {
    return (
      <section className="op-signup op-signup--confirmed" data-footer-signup>
        <div className="op-signup__confirm" role="status" aria-live="polite">
          <SignupConfirmation follow={false} survey />
        </div>
      </section>
    );
  }

  return (
    <section className="op-signup" data-footer-signup>
      <div className="op-signup__copy">
        <p className="op-signup__title">New drops. New cities. No spam.</p>
      </div>
      <form data-signup data-source="footer" className="op-signup__form" aria-describedby="homeSignupConsent" onSubmit={state.onSubmit}>
        <input type="text" name="hp" tabIndex={-1} autoComplete="off" className="visually-hidden" aria-hidden="true" />
        <div className="op-signup__field">
          <label className="visually-hidden" htmlFor="homeEmail">Email address</label>
          <input id="homeEmail" className="op-signup__input" type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
          <button type="submit" className="op-signup__submit" disabled={state.busy}>SUBSCRIBE</button>
        </div>
        <p id="homeSignupConsent" className="op-signup__consent">
          By subscribing you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
        </p>
        <StatusLine className="op-signup__status" state={state} />
      </form>
    </section>
  );
}
