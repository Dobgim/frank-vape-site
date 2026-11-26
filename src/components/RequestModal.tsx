import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { emit, on } from "../lib/bus";
import { makeSiblingsInert, trapTab } from "../lib/dom";
import { loadStoreFeed, type StoreFeed } from "../lib/locator/feed";
import { rememberNewsletterSignup, submitStoreRequest } from "../lib/signup";

const US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const STATE_NAMES: [string, string][] = "AL:Alabama,AK:Alaska,AZ:Arizona,AR:Arkansas,CA:California,CO:Colorado,CT:Connecticut,DE:Delaware,DC:District of Columbia,FL:Florida,GA:Georgia,HI:Hawaii,ID:Idaho,IL:Illinois,IN:Indiana,IA:Iowa,KS:Kansas,KY:Kentucky,LA:Louisiana,ME:Maine,MD:Maryland,MA:Massachusetts,MI:Michigan,MN:Minnesota,MS:Mississippi,MO:Missouri,MT:Montana,NE:Nebraska,NV:Nevada,NH:New Hampshire,NJ:New Jersey,NM:New Mexico,NY:New York,NC:North Carolina,ND:North Dakota,OH:Ohio,OK:Oklahoma,OR:Oregon,PA:Pennsylvania,RI:Rhode Island,SC:South Carolina,SD:South Dakota,TN:Tennessee,TX:Texas,UT:Utah,VT:Vermont,VA:Virginia,WA:Washington,WV:West Virginia,WI:Wisconsin,WY:Wyoming"
  .split(",").map((p) => p.split(":") as [string, string]);
const HOME_MARKETS = ["WA"];
const MICRO_DEFAULT = "We'll pass this to our team and nudge the store.";
const MIN_QUERY_CHARS = 2;
const RESULT_CAP = 6;

interface PickerStore {
  key: string;
  license: string;
  name: string;
  address: string;
  city: string;
  market: string;
  zip: string;
  stocked: boolean;
  manual: boolean;
  homeMarket?: boolean;
}

const clean = (v: unknown) => String(v == null ? "" : v).trim().replace(/\s+/g, " ");
const keyPart = (v: string) => clean(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function normalizeState(value: string): string {
  const raw = clean(value);
  const code = raw.toUpperCase();
  if (US_STATES.includes(code)) return code;
  const hit = STATE_NAMES.find(([, name]) => name.toLowerCase() === raw.toLowerCase());
  return hit ? hit[0] : "";
}

function buildIndex(feed: StoreFeed): PickerStore[] {
  const seen = new Set<string>();
  const out: PickerStore[] = [];
  for (const s of feed.stores ?? []) {
    if (!s || s.isDeleted === true || s.isRetailLocation === false || clean(s.status).toLowerCase() === "closed") continue;
    const id = clean(s.id);
    const key = "wa:" + id;
    if (!id || !clean(s.name) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key, license: clean(s.license) || id, name: clean(s.name), address: clean(s.address), city: clean(s.city),
      market: "WA", zip: clean(s.zip).slice(0, 10), stocked: true, manual: false,
    });
  }
  return out;
}

function manualStore(f: { name: string; address: string; city: string; market: string; zip: string }): PickerStore | null {
  const name = clean(f.name), city = clean(f.city), market = normalizeState(f.market), zip = clean(f.zip);
  if (name.length < 2 || !keyPart(name) || city.length < 2 || !keyPart(city)) return null;
  if (!market) return null;
  if (zip && !/^\d{5}$/.test(zip)) return null;
  return {
    key: `manual:${market}:${keyPart(name)}:${keyPart(city)}`, license: "", name, address: clean(f.address), city, market, zip,
    stocked: false, manual: true, homeMarket: HOME_MARKETS.includes(market),
  };
}

function metaLine(s: PickerStore): string {
  const locality = [clean(s.city), clean(s.market), clean(s.zip)].filter(Boolean).join(" ");
  return [clean(s.address), locality].filter(Boolean).join(" · ");
}

function hay(s: PickerStore) {
  return (s.name + " " + s.address + " " + s.city + " " + s.market + " " + s.zip).toLowerCase();
}

function pickerView(index: PickerStore[], q: string) {
  const query = q.trim().toLowerCase();
  if (query.length < MIN_QUERY_CHARS) return { mode: "prompt" as const, matches: [], total: 0 };
  const stocked: PickerStore[] = [], requestable: PickerStore[] = [];
  let total = 0;
  for (const s of index) {
    if (hay(s).indexOf(query) === -1) continue;
    total++;
    if (s.stocked ? stocked.length < RESULT_CAP : requestable.length < RESULT_CAP) (s.stocked ? stocked : requestable).push(s);
  }
  const reserved = Math.min(requestable.length, Math.floor(RESULT_CAP / 2));
  const matches = stocked.slice(0, Math.min(stocked.length, RESULT_CAP - reserved));
  const all = matches.concat(requestable.slice(0, RESULT_CAP - matches.length));
  if (!all.length) return { mode: "empty" as const, matches: [], total: 0 };
  return { mode: "list" as const, matches: all, total };
}

const EMPTY_MANUAL = { name: "", address: "", city: "", market: "", zip: "" };

/** "Want MWAH at your shop?" (request-modal.js). */
export default function RequestModal() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<PickerStore[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PickerStore | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [status, setStatus] = useState<{ msg: string; err: boolean }>({ msg: "", err: false });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<PickerStore | null>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<Element | null>(null);

  const resetPick = () => {
    setPicked(null);
    setManualOpen(false);
    setManual(EMPTY_MANUAL);
    setQuery("");
    setStatus({ msg: "", err: false });
    if (modalRef.current) modalRef.current.scrollTop = 0;
  };

  useEffect(() => on("request:open", () => {
    if (submitting) return;
    lastFocus.current = document.activeElement;
    resetPick();
    setEmail("");
    setEmailError("");
    setNewsletter(false);
    setSuccess(null);
    setOpen(true);
  }), [submitting]);

  useEffect(() => {
    if (!open || index) return;
    loadStoreFeed().then((feed) => setIndex(buildIndex(feed))).catch(() => setLoadError(true));
  }, [open, index]);

  useEffect(() => {
    if (!open || !scrimRef.current) return;
    document.body.style.overflow = "hidden";
    const restore = makeSiblingsInert(scrimRef.current);
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      restore();
      const el = lastFocus.current as HTMLElement | null;
      if (el && el.focus) el.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (scrimRef.current) trapTab(e, scrimRef.current, 'button, [href], input, select, [tabindex]:not([tabindex="-1"])');
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const view = useMemo(() => (index ? pickerView(index, query) : null), [index, query]);
  const manualPick = manualOpen ? manualStore(manual) : null;
  const current = manualOpen ? manualPick : picked;
  const showSearch = !picked && !manualOpen;
  const showContact = manualOpen || (picked != null && !picked.stocked);

  const openManual = () => {
    setManual({ ...EMPTY_MANUAL, name: query.trim() });
    setManualOpen(true);
    if (modalRef.current) modalRef.current.scrollTop = 0;
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const closeManual = () => {
    setManualOpen(false);
    setManual(EMPTY_MANUAL);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const findOnMap = () => {
    if (!picked) return;
    close();
    emit("locator:find", { market: picked.market, zip: picked.zip });
  };

  const submit = async () => {
    if (submitting || !current || current.stocked) return;
    const value = email.trim().toLowerCase();
    if (!value || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError("Enter a valid email address to send your request.");
      emailRef.current?.focus();
      return;
    }
    setEmailError("");
    setSubmitting(true);
    setStatus({ msg: "Sending…", err: false });
    const hp = (document.getElementById("reqHp") as HTMLInputElement | null)?.value ?? "";
    const result = await submitStoreRequest({
      store_license: current.license, store_name: current.name, store_address: current.address,
      store_city: current.city, store_market: current.market, store_zip: current.zip,
      email: value, newsletter_opt_in: newsletter, hp,
    });
    setSubmitting(false);
    if (result === "rate_limited") return setStatus({ msg: "Too many requests. Try again in a minute.", err: true });
    if (result === "invalid") return setStatus({ msg: "Check your email and store details, then try again.", err: true });
    if (result !== "ok") return setStatus({ msg: "Something went wrong. Try again?", err: true });
    if (newsletter) rememberNewsletterSignup("store_request");
    setStatus({ msg: "", err: false });
    setSuccess(current);
  };

  const field = (key: keyof typeof EMPTY_MANUAL) => ({
    value: manual[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setManual((m) => ({ ...m, [key]: e.target.value })),
    disabled: submitting,
  });

  const micro = manualOpen && manualPick && manualPick.homeMarket === false ? "We'll record your interest and pass it to our team." : MICRO_DEFAULT;

  return (
    <div
      ref={scrimRef}
      className={"req-scrim" + (open ? " is-open" : "")}
      id="reqScrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reqTitle"
      onClick={(e) => { if (e.target === scrimRef.current) close(); }}
    >
      <div className="req-modal" ref={modalRef}>
        <div id="reqForm" className="req-form" style={{ display: success ? "none" : undefined }}>
          <div className="req-head">
            <button type="button" className="req-close" id="reqClose" aria-label="Close" onClick={close}>&times;</button>
            <div className="req-eyebrow">REQUEST MWAH</div>
            <h2 className="req-title" id="reqTitle">Want MWAH at your shop?</h2>
            <p className="req-sub">Pick the dispensary you wish carried us. We&rsquo;ll let our team know there&rsquo;s demand &mdash; and reach out to the store.</p>
          </div>
          <div className="req-body">
            <div className="req-search" id="reqSearchWrap" style={{ display: showSearch ? undefined : "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input ref={searchRef} id="reqSearch" type="search" placeholder="Search your dispensary…" autoComplete="off" aria-label="Search your dispensary by name, address, city, or ZIP" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="req-list" id="reqResults" role="group" aria-label="Dispensary results" style={{ display: showSearch ? undefined : "none" }}>
              {loadError && !index && <div className="req-empty">Couldn&apos;t load dispensaries. Try again in a moment.</div>}
              {!loadError && !index && <div className="req-empty">Loading dispensaries…</div>}
              {view?.mode === "prompt" && <div className="req-empty">Start typing a dispensary name, city, or ZIP.</div>}
              {view?.mode === "empty" && <div className="req-empty">No known match. Add this shop below and we&apos;ll pass it to our team.</div>}
              {view?.mode === "list" && (
                <>
                  {view.matches.map((s) => (
                    <button key={s.key} type="button" className="req-opt" data-key={s.key} onClick={() => setPicked(s)}>
                      <span className={"req-opt__pin" + (s.stocked ? " is-stocked" : "")}></span>
                      <span className="req-opt__text">
                        <span className="req-opt__name">{s.name}</span>
                        <span className="req-opt__meta">{metaLine(s)}</span>
                        {s.stocked && <span className="req-opt__badge">&#10003; ALREADY STOCKS MWAH</span>}
                      </span>
                    </button>
                  ))}
                  {view.total > view.matches.length && (
                    <p className="req-more">Showing {view.matches.length} of {view.total} &mdash; keep typing to narrow it down.</p>
                  )}
                </>
              )}
            </div>
            <button type="button" className="req-manual-open" id="reqManualOpen" hidden={!showSearch} onClick={openManual}>Don&rsquo;t see your shop? Add it</button>
            <div className="req-manual" id="reqManualFields" hidden={!manualOpen}>
              <button type="button" className="req-manual__back" id="reqManualBack" onClick={closeManual}>&larr; Back to search</button>
              <p className="req-manual__intro">Tell us which shop you want MWAH at.</p>
              <label className="req-field" htmlFor="reqManualName">
                <span className="req-field__label">Store name</span>
                <input ref={nameRef} id="reqManualName" type="text" autoComplete="organization" maxLength={200} required {...field("name")} />
              </label>
              <label className="req-field" htmlFor="reqManualAddress">
                <span className="req-field__label">Street address <span className="req-field__optional">optional</span></span>
                <input id="reqManualAddress" type="text" autoComplete="street-address" maxLength={200} {...field("address")} />
              </label>
              <label className="req-field" htmlFor="reqManualCity">
                <span className="req-field__label">City</span>
                <input id="reqManualCity" type="text" autoComplete="address-level2" maxLength={100} required {...field("city")} />
              </label>
              <div className="req-manual__row">
                <label className="req-field" htmlFor="reqManualMarket">
                  <span className="req-field__label">State</span>
                  <input id="reqManualMarket" type="text" list="reqStateList" placeholder="Start typing…" autoComplete="address-level1" autoCapitalize="words" maxLength={40} required {...field("market")} />
                  <datalist id="reqStateList">
                    {STATE_NAMES.map(([, name]) => <option key={name} value={name}></option>)}
                  </datalist>
                </label>
                <label className="req-field" htmlFor="reqManualZip">
                  <span className="req-field__label">ZIP <span className="req-field__optional">optional</span></span>
                  <input id="reqManualZip" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5} pattern="[0-9]{5}" {...field("zip")} />
                </label>
              </div>
            </div>
            <div className={"req-picked" + (picked ? " is-shown" : "")} id="reqPicked">
              <span className={"req-picked__pin" + (picked?.stocked ? " is-stocked" : "")} id="reqPickedPin"></span>
              <div className="req-picked__text">
                <div className="req-picked__namerow">
                  <span className="req-picked__name" id="reqPickedName">{picked?.name}</span>
                  <span className="req-picked__badge" id="reqPickedBadge" hidden={!picked?.stocked}>&#10003; STOCKS MWAH</span>
                </div>
                <div className="req-picked__meta" id="reqPickedMeta">{picked ? metaLine(picked) : ""}</div>
              </div>
              <button type="button" className="req-picked__change" id="reqChange" onClick={resetPick}>Change</button>
            </div>
            <p className="req-affirm" id="reqAffirm" hidden={!picked?.stocked}>
              Good news — <b>{picked?.name}</b> already stocks MWAH. She&apos;s on the shelf there now.
            </p>
            <div className="req-contact" id="reqContact" hidden={!showContact}>
              <label className="req-field" htmlFor="reqEmail">
                <span className="req-field__label">Your email</span>
                <input
                  ref={emailRef}
                  id="reqEmail"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  required
                  aria-describedby="reqEmailHelp reqEmailError"
                  aria-invalid={emailError ? true : undefined}
                  value={email}
                  disabled={submitting}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
                />
              </label>
              <p className="req-contact__help" id="reqEmailHelp">Required so we can contact you about your request. See our <Link to="/privacy" onClick={close}>Privacy Policy</Link>.</p>
              <p className="req-contact__error" id="reqEmailError" role="alert">{emailError}</p>
              <label className="req-newsletter" htmlFor="reqNewsletter">
                <input id="reqNewsletter" type="checkbox" aria-describedby="reqNewsletterDisclosure" checked={newsletter} disabled={submitting} onChange={(e) => setNewsletter(e.target.checked)} />
                <span>Send me MWAH drops and news. <span className="req-field__optional">Optional</span></span>
              </label>
              <p className="req-contact__disclosure" id="reqNewsletterDisclosure">By subscribing you agree to our <Link to="/terms" onClick={close}>Terms</Link> and <Link to="/privacy" onClick={close}>Privacy Policy</Link>.</p>
            </div>
            <input type="text" id="reqHp" className="req-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          </div>
          <div className="req-foot">
            <p className="req-status" id="reqStatus" role="status" aria-live="polite" style={{ color: status.err ? "var(--ink)" : "var(--text-mid)" }}>{status.msg}</p>
            <button
              type="button"
              className="req-submit"
              id="reqSubmit"
              disabled={submitting || !current}
              onClick={picked?.stocked ? findOnMap : submit}
            >
              {picked?.stocked ? "Find it on the map →" : "Request MWAH"}
            </button>
            <p className="req-micro" id="reqMicro" hidden={!!picked?.stocked}>{micro}</p>
          </div>
        </div>
        <div className={"req-success" + (success ? " is-shown" : "")} id="reqSuccess" role="status" aria-live="polite">
          <div className="req-success__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
          </div>
          <h2 className="req-success__title">Got it.</h2>
          <p className="req-success__sub" id="reqSuccessSub">
            {success && (success.homeMarket === false
              ? <>We&apos;ve recorded your interest in MWAH at <b>{success.name}</b>.</>
              : <>We&apos;ll let our team know shoppers want MWAH at <b>{success.name}</b>.</>)}
          </p>
          <button type="button" className="req-done" id="reqDone" onClick={close}>Done</button>
        </div>
      </div>
    </div>
  );
}
