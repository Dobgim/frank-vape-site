import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOrder } from "../lib/order";
import { readStorage, writeStorage } from "../lib/dom";

const AUTO_DELAY = 6000;
const LOAD_RETRY_DELAY = 250;
const SCROLL_SETTLE_DELAY = 140;
const PAUSE_KEY = "mwah_hero_paused";

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const inertProps = (active: boolean) => (active ? {} : { inert: "", "aria-hidden": true as const });

/** Homepage hero carousel (hero-rotator.js). */
export default function HeroRotator() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(() => reduced || readStorage("session", PAUSE_KEY) === "true");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [docHidden, setDocHidden] = useState(document.hidden);
  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const slideCount = 2;
  const { add } = useOrder();
  const navigate = useNavigate();

  useEffect(() => {
    if (reduced) setPaused(true);
  }, [reduced]);

  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const select = useCallback((index: number, scroll: boolean) => {
    setActive(index);
    const viewport = viewportRef.current;
    const slide = slideRefs.current[index];
    if (scroll && viewport && slide) {
      viewport.scrollTo({ left: slide.offsetLeft, behavior: reduced ? "auto" : "smooth" });
    }
  }, [reduced]);

  const canAdvance = !paused && !reduced && !hovered && !focused && !docHidden;

  // Auto-advance, waiting for the next slide's image to finish loading.
  useEffect(() => {
    if (!canAdvance) return;
    let timer: ReturnType<typeof setTimeout>;
    const next = (active + 1) % slideCount;
    const attempt = () => {
      const img = slideRefs.current[next]?.querySelector("img");
      if (img && !(img.complete && img.naturalWidth > 0)) {
        timer = setTimeout(attempt, LOAD_RETRY_DELAY);
        return;
      }
      select(next, true);
    };
    timer = setTimeout(attempt, AUTO_DELAY);
    return () => clearTimeout(timer);
  }, [canAdvance, active, select]);

  // A swipe on the scroll-snap viewport updates the active dot once it settles.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        let best = 0;
        let bestDistance = Infinity;
        slideRefs.current.forEach((slide, i) => {
          if (!slide) return;
          const d = Math.abs(slide.offsetLeft - viewport.scrollLeft);
          if (d < bestDistance) { bestDistance = d; best = i; }
        });
        setActive(best);
      }, SCROLL_SETTLE_DELAY);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(settle);
      viewport.removeEventListener("scroll", onScroll);
    };
  }, []);

  const togglePaused = () => {
    setPaused((p) => {
      writeStorage("session", PAUSE_KEY, String(!p));
      return !p;
    });
  };

  const playbackLabel = paused ? "Play slideshow" : "Pause slideshow";

  return (
    <section
      ref={rootRef}
      className="sm-hero"
      data-hero-rotator
      aria-roledescription="carousel"
      aria-label="Featured drops"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => requestAnimationFrame(() => setFocused(!!rootRef.current?.contains(document.activeElement)))}
    >
      <div className="sm-hero__viewport" ref={viewportRef}>
        <article ref={(el) => { slideRefs.current[0] = el; }} className={"sm-hero__slide" + (active === 0 ? " is-active" : "")} data-hero-slide="latte-lover" {...inertProps(active === 0)}>
          <div className="sm-hero__art" data-nosnippet>
            <picture className="sm-hero__pic sm-hero__pic--latte-lover">
              <source media="(max-width: 768px)" type="image/webp" srcSet="/assets/img/hero/latte-lover-banner-mobile.webp" />
              <source media="(max-width: 768px)" type="image/jpeg" srcSet="/assets/img/hero/latte-lover-banner-mobile.jpg" />
              <source type="image/webp" srcSet="/assets/img/hero/latte-lover-banner.webp" />
              <img src="/assets/img/hero/latte-lover-banner.jpg" alt="Woman in sunglasses holding a Latte Lover MWAH cannabis vape pen" width={1920} height={1080} loading="eager" {...{ fetchpriority: "high" }} decoding="async" />
            </picture>
          </div>
          <div className="sm-hero__copy" data-nosnippet>
            <p className="sm-eyebrow">MEET LATTE LOVER&nbsp;&nbsp;&middot;&nbsp;&nbsp;SATIVA</p>
            <h2 className="sm-hero__title">Latte Lover.</h2>
            <p className="sm-hero__sub">Rich coffee. Creamy vanilla, smooth, comforting.<br />A 1g all-in-one sativa cannabis vape pen.</p>
            <div className="op-hero__cta-row">
              <Link to="/products/" className="op-btn op-btn--primary">PRODUCTS</Link>
              <button type="button" className="op-btn op-btn--secondary" onClick={() => { add("latte-lover", 1); navigate("/wholesale#order"); }}>ADD TO CART</button>
            </div>
          </div>
        </article>
        <article ref={(el) => { slideRefs.current[1] = el; }} className={"sm-hero__slide" + (active === 1 ? " is-active" : "")} data-hero-slide="brand-campaign" {...inertProps(active === 1)}>
          <picture className="sm-hero__pic">
            <source media="(max-width: 768px)" type="image/webp" srcSet="/assets/img/hero/hero-trio-mobile.webp" />
            <source media="(max-width: 768px)" type="image/jpeg" srcSet="/assets/img/hero/hero-trio-mobile.jpg" />
            <source type="image/webp" srcSet="/assets/img/hero/hero-trio.webp" />
            <img src="/assets/img/hero/hero-trio.jpg" alt="Four women holding colorful MWAH cannabis vape pens" width={5760} height={3468} loading="lazy" decoding="async" />
          </picture>
          <div className="sm-hero__copy">
            <h2 className="sm-hero__title">Cannabis designed for her.</h2>
            <p className="sm-hero__sub">The prettiest thing in your bag: A 1g all-in-one cannabis vape pen.<br />For all the baddies.</p>
            <div className="op-hero__cta-row">
              <Link to="/products/" className="op-btn op-btn--primary">PRODUCTS</Link>
              <Link to="/wholesale" className="op-btn op-btn--secondary">ADD TO CART</Link>
            </div>
          </div>
        </article>
      </div>
      <div className="sm-hero__toolbar">
        <div className="sm-hero__controls" role="group" aria-label="Choose a featured drop">
          {["Show Latte Lover", "Show MWAH brand campaign"].map((label, i) => (
            <button key={label} type="button" className={"sm-hero__dot" + (active === i ? " is-active" : "")} aria-label={label} aria-current={active === i ? "true" : "false"} onClick={() => select(i, true)} />
          ))}
        </div>
        <button type="button" className="sm-hero__playback" data-hero-playback data-paused={String(paused)} aria-label={playbackLabel} title={playbackLabel} hidden={reduced} onClick={togglePaused}>
          <svg className="sm-hero__playback-icon sm-hero__playback-icon--pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5v14M15 5v14" /></svg>
          <svg className="sm-hero__playback-icon sm-hero__playback-icon--play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m8 5 11 7-11 7Z" /></svg>
        </button>
      </div>
    </section>
  );
}
