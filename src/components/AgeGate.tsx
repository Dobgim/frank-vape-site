import { useEffect, useRef } from "react";
import { UNDER_21_REDIRECT } from "../config";
import { useAgeGate } from "../lib/ageGate";
import { makeSiblingsInert } from "../lib/dom";
import { TrademarkMark, Wordmark } from "./Icons";

/** 21+ overlay (age-gate.js). No Escape, no backdrop dismiss: a choice is required. */
export default function AgeGate() {
  const { accepted, accept } = useAgeGate();
  const ref = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (accepted || !ref.current) return;
    const restore = makeSiblingsInert(ref.current);
    const t = setTimeout(() => yesRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      restore();
    };
  }, [accepted]);

  if (accepted) return null;

  const decline = () => {
    try { sessionStorage.clear(); } catch { /* ignore */ }
    location.replace(UNDER_21_REDIRECT);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const order = [yesRef.current, noRef.current];
    const idx = order.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.shiftKey ? (idx - 1 + order.length) % order.length : (idx + 1) % order.length;
    order[next]?.focus();
  };

  const button = "cursor-pointer rounded-full px-6 py-4 text-[12px] uppercase tracking-[0.2em] font-sans leading-normal";

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-desc"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-white p-6 font-sans text-ink"
    >
      <div className="flex w-full max-w-[480px] flex-col gap-6 bg-white px-8 py-10 text-center">
        <span role="img" aria-label="MWAH" className="mx-auto flex items-center text-ink">
          <Wordmark className="block h-7 w-auto" />
          <TrademarkMark className="ml-[3px] mt-px block h-[7.6px] w-auto self-start" />
        </span>
        <h1 id="age-gate-title" className="m-0 text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
          Are you 21 or older?
        </h1>
        <p id="age-gate-desc" className="m-0 text-[14px] font-normal leading-normal text-text-mid">
          You must be 21 or older to enter this site.
        </p>
        <div className="mt-2 flex flex-col gap-3">
          <button ref={yesRef} type="button" id="age-gate-yes" onClick={accept} className={`${button} border-0 bg-hot-pink font-bold text-ink`}>
            I am 21 or older
          </button>
          <button ref={noRef} type="button" id="age-gate-no" onClick={decline} className={`${button} border border-solid border-text-mid bg-transparent font-semibold text-ink`}>
            I am under 21
          </button>
        </div>
        <p className="mt-2 text-[11px] font-normal leading-[1.4] text-text-soft">
          This product has intoxicating effects and may be habit forming. For use only by adults 21+.
        </p>
      </div>
    </div>
  );
}
