import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ORDER_ENDPOINT } from "../config";
import { PRODUCTS, type Product } from "../data/products";
import { usePageMeta } from "../hooks/usePageMeta";
import { MAX_UNITS_PER_LINE, useOrder } from "../lib/order";

const STEP = 1;

function QtyStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const btn = "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-solid border-line bg-white text-[18px] leading-none text-ink hover:bg-pink-wash disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label="Decrease" disabled={value <= 0} onClick={() => onChange(value - STEP)}>−</button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_UNITS_PER_LINE}
        value={value}
        aria-label={`${label} units`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 w-16 rounded-xl border border-solid border-line bg-white text-center font-sans text-[15px] font-semibold text-ink [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" className={btn} aria-label="Increase" onClick={() => onChange(value + STEP)}>+</button>
    </div>
  );
}

function ProductRow({ p }: { p: Product }) {
  const { lines, add } = useOrder();
  const [qty, setQty] = useState(10);
  const inOrder = lines[p.slug] || 0;
  return (
    <li className="flex items-start gap-4 border-0 border-b border-solid border-line py-5">
      <Link to={`/products/${p.slug}`} className="block h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-paper-grey">
        <img src={p.thumb} alt="" width={800} height={1000} loading="lazy" className="h-full w-full object-cover mix-blend-multiply" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[11px] font-bold tracking-[0.2em] text-text-mid">{p.type}</p>
        <h3 className="m-0! mt-1! text-[18px]! leading-tight! font-bold! tracking-normal! text-ink">{p.name}</h3>
        <p className="m-0 mt-1 text-[13px] text-text-mid">{p.vibe} · 1g all-in-one</p>
        {inOrder > 0 && <p className="m-0 mt-1 text-[12px] font-semibold text-ink">{inOrder} in order</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
        <QtyStepper value={qty} onChange={(n) => setQty(Math.max(0, Math.min(MAX_UNITS_PER_LINE, Math.floor(n) || 0)))} label={p.name} />
        <button type="button" className="op-btn op-btn--primary whitespace-nowrap" disabled={qty <= 0} onClick={() => add(p.slug, qty)}>
          ADD TO ORDER
        </button>
        </div>
      </div>
    </li>
  );
}

type Status = { kind: "idle" | "sending" | "error"; msg: string };

const FIELD = "w-full rounded-xl border border-solid border-line bg-white px-4 py-3 font-sans text-[15px] text-ink outline-none focus:border-ink";
const LABEL = "flex flex-col gap-1.5 text-[11px] font-bold tracking-[0.16em] text-text-mid";

/** /wholesale — order sheet for licensed cannabis retailers; orders are emailed via /api/order. */
export default function WholesalePage() {
  usePageMeta("Wholesale Orders | MWAH", "Licensed cannabis retailers can order MWAH 1g all-in-one vape pens for their store.");
  const { lines, totalUnits, setUnits, clear } = useOrder();
  const [status, setStatus] = useState<Status>({ kind: "idle", msg: "" });
  const [placed, setPlaced] = useState<{ ref: string; units: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const orderLines = useMemo(
    () => PRODUCTS.filter((p) => lines[p.slug]).map((p) => ({ p, units: lines[p.slug] })),
    [lines],
  );

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!orderLines.length) {
      setStatus({ kind: "error", msg: "Add at least one flavor to your order." });
      return;
    }
    const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    setStatus({ kind: "sending", msg: "Sending your order…" });
    try {
      const resp = await fetch(ORDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          attest: data.attest === "on",
          lines: orderLines.map(({ p, units }) => ({ slug: p.slug, name: p.name, type: p.type, units })),
        }),
      });
      const json = (await resp.json().catch(() => ({}))) as { ref?: string; error?: string };
      if (!resp.ok || !json.ref) {
        const msg = json.error === "invalid"
          ? "Some details are missing. Check the form and try again."
          : json.error === "not_configured"
            ? "Ordering isn't set up yet. Please try again later."
            : "We couldn't send your order. Please try again in a moment.";
        setStatus({ kind: "error", msg });
        return;
      }
      setPlaced({ ref: json.ref, units: totalUnits });
      clear();
      formRef.current?.reset();
      setStatus({ kind: "idle", msg: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setStatus({ kind: "error", msg: "We couldn't send your order. Check your connection and try again." });
    }
  };

  if (placed) {
    return (
      <main className="page" id="main-content">
        <section className="mx-auto flex max-w-[640px] flex-col items-center gap-4 px-6 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-hot-pink text-ink" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
          </div>
          <p className="caption">ORDER RECEIVED</p>
          <h1 className="m-0! text-[40px]! font-extrabold! leading-tight! tracking-[-0.02em]!">Thank you. We&rsquo;ve got it.</h1>
          <p className="m-0 text-text-mid">
            Order <b className="text-ink">{placed.ref}</b> for {placed.units} units has been sent to our wholesale team. We&rsquo;ll confirm availability, pricing and delivery by email after verifying your license.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button type="button" className="op-btn op-btn--primary" onClick={() => setPlaced(null)}>START A NEW ORDER</button>
            <Link className="op-btn op-btn--secondary" to="/">BACK TO HOME</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page" id="main-content">
      <section className="mx-auto max-w-[1200px] px-[var(--content-pad)] pt-16 pb-8 max-md:px-4 max-md:pt-10">
        <p className="caption">WHOLESALE · LICENSED RETAILERS ONLY</p>
        <h1 className="m-0! mt-3! text-[56px]! font-extrabold! leading-[1.02]! tracking-[-0.03em]! max-md:text-[38px]!">Stock MWAH in your store.</h1>
        <p className="m-0 mt-4 max-w-[680px] text-[17px] leading-relaxed text-text-mid">
          Build your order below and send it to our wholesale team. Orders are accepted only from businesses holding an active state cannabis retail license; we verify every license before confirming pricing and delivery. We do not sell to consumers.
        </p>
      </section>

      <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)_420px] items-start gap-12 px-[var(--content-pad)] pb-24 max-lg:grid-cols-1 max-md:px-4">
        <section aria-labelledby="wsFlavors">
          <h2 id="wsFlavors" className="m-0! text-[22px]! leading-tight! font-bold! tracking-normal!">Flavors</h2>
          <ul className="m-0 mt-2 list-none p-0">
            {PRODUCTS.map((p) => <ProductRow key={p.slug} p={p} />)}
          </ul>
        </section>

        <aside id="order" className="sticky top-[88px] rounded-3xl bg-paper-grey p-7 max-lg:static max-md:p-5" aria-labelledby="wsOrderTitle">
          <div className="flex items-baseline justify-between">
            <h2 id="wsOrderTitle" className="m-0! text-[22px]! leading-tight! font-bold! tracking-normal!">Your order</h2>
            <span className="text-[13px] font-semibold text-text-mid">{totalUnits} units</span>
          </div>

          {orderLines.length === 0 ? (
            <p className="m-0 mt-4 rounded-2xl bg-white p-5 text-[14px] text-text-mid">Your order is empty. Add flavors from the list.</p>
          ) : (
            <ul className="m-0 mt-4 list-none space-y-3 p-0">
              {orderLines.map(({ p, units }) => (
                <li key={p.slug} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                  <img src={p.thumb} alt="" className="h-14 w-11 rounded-lg bg-paper-grey object-cover mix-blend-multiply" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[14px] font-bold">{p.name}</p>
                    <p className="m-0 text-[11px] font-bold tracking-[0.16em] text-text-mid">{p.type}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={MAX_UNITS_PER_LINE}
                    value={units}
                    aria-label={`${p.name} units`}
                    onChange={(e) => setUnits(p.slug, Number(e.target.value))}
                    className="h-9 w-16 rounded-lg border border-solid border-line text-center font-sans text-[14px] font-semibold"
                  />
                  <button type="button" className="cursor-pointer border-0 bg-transparent p-1 text-text-mid hover:text-ink" aria-label={`Remove ${p.name}`} onClick={() => setUnits(p.slug, 0)}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form ref={formRef} className="mt-6 flex flex-col gap-4" onSubmit={submit}>
            <input type="text" name="hp" tabIndex={-1} autoComplete="off" className="visually-hidden" aria-hidden="true" />
            <h3 className="m-0! text-[16px]! leading-tight! font-bold! tracking-normal!">Retailer details</h3>
            <label className={LABEL}>BUSINESS NAME<input className={FIELD} name="business" autoComplete="organization" maxLength={160} required /></label>
            <label className={LABEL}>CANNABIS RETAIL LICENSE #<input className={FIELD} name="license" maxLength={40} required /></label>
            <label className={LABEL}>CONTACT NAME<input className={FIELD} name="contact" autoComplete="name" maxLength={120} required /></label>
            <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
              <label className={LABEL}>EMAIL<input className={FIELD} name="email" type="email" autoComplete="email" maxLength={254} required /></label>
              <label className={LABEL}>PHONE<input className={FIELD} name="phone" type="tel" autoComplete="tel" maxLength={40} required /></label>
            </div>
            <label className={LABEL}>STORE ADDRESS<input className={FIELD} name="address" autoComplete="street-address" maxLength={200} required /></label>
            <div className="grid grid-cols-[1fr_80px_96px] gap-3 max-[420px]:grid-cols-2">
              <label className={LABEL}>CITY<input className={FIELD} name="city" autoComplete="address-level2" maxLength={100} required /></label>
              <label className={LABEL}>STATE<input className={FIELD} name="state" autoComplete="address-level1" maxLength={40} defaultValue="WA" required /></label>
              <label className={LABEL}>ZIP<input className={FIELD} name="zip" autoComplete="postal-code" inputMode="numeric" maxLength={10} /></label>
            </div>
            <label className={LABEL}>NOTES <span className="font-normal normal-case tracking-normal">(optional)</span>
              <textarea className={FIELD + " min-h-[88px] resize-y"} name="notes" maxLength={2000} placeholder="Delivery window, PO number, questions…" />
            </label>
            <label className="flex items-start gap-3 text-[13px] leading-snug text-ink">
              <input type="checkbox" name="attest" required className="mt-0.5 h-4 w-4 accent-[#ff6ec1]" />
              <span>I confirm this business holds an active state cannabis retail license and I am authorized to order on its behalf.</span>
            </label>
            {status.msg && (
              <p role="status" aria-live="polite" className={"m-0 text-[13px] " + (status.kind === "error" ? "font-semibold text-ink" : "text-text-mid")}>{status.msg}</p>
            )}
            <button type="submit" className="op-btn op-btn--primary w-full" disabled={status.kind === "sending" || !orderLines.length}>
              {status.kind === "sending" ? "SENDING…" : "PLACE ORDER"}
            </button>
            <p className="m-0 text-center text-[12px] text-text-soft">
              No payment is taken online. Our team confirms pricing and delivery by email. See our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
            </p>
          </form>
        </aside>
      </div>
    </main>
  );
}
