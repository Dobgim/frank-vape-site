import { Fragment, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { PRODUCTS, type Product } from "../data/products";
import { useAgeGate } from "../lib/ageGate";

const TOTAL = PRODUCTS.length;
const pad2 = (n: number) => (n < 10 ? "0" : "") + n;

function Card({ p, copy }: { p: Product; copy: boolean }) {
  const ChipTag = p.homeNoSnippet ? "span" : "div";
  const extra = copy ? { tabIndex: -1 } : {};
  return (
    <article className="op-card" data-product={p.key} aria-hidden={copy || undefined}>
      <div className="op-card__shell" {...(p.homeNoSnippet ? { "data-nosnippet": "" } : {})}>
        <ChipTag className="op-card__chip">{p.type}</ChipTag>
        <video className="op-card__video" data-src={p.video} data-poster={p.poster} muted loop playsInline preload="none"></video>
      </div>
      <div className="op-card__info" {...(p.homeNoSnippet ? { "data-nosnippet": "" } : {})}>
        <p className="op-card__eyebrow">{p.type}</p>
        <h3 className="op-card__title">{p.name}</h3>
        <p className="op-card__vibe">{p.vibe}</p>
        <p className="op-card__moods">{p.homeMoods.split(" · ").map((m, i) => (
          <Fragment key={m}>{i > 0 && <>&nbsp;&nbsp;&middot;&nbsp;&nbsp;</>}{m}</Fragment>
        ))}</p>
        <Link className="op-card__detail" to={`/products/${p.slug}`} {...extra}>VIEW DETAILS</Link>
      </div>
    </article>
  );
}

/**
 * Homepage product row (home.js). One repeated lap on each side keeps native
 * touch/trackpad scrolling continuous; when scrolling settles on a copy the
 * row jumps invisibly back to the matching original. Only the focal card's
 * video loads and plays.
 */
export default function ProductCoverflow({ progressFillRef, progressCountRef }: {
  progressFillRef: React.RefObject<HTMLDivElement>;
  progressCountRef: React.RefObject<HTMLSpanElement>;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const { accepted } = useAgeGate();
  const acceptedRef = useRef(accepted);
  acceptedRef.current = accepted;

  useEffect(() => {
    const row = rowRef.current;
    const section = sectionRef.current;
    if (!row || !section) return;
    const cards = Array.from(row.querySelectorAll<HTMLElement>(".op-card"));
    const originals = cards.slice(TOTAL, TOTAL * 2);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motion.matches;
    let mediaVisible = false;
    let focalIdx = -1;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let pointerDown = false;
    let resetting = false;
    let scrollTarget: HTMLElement | null = null;
    let ticking = false;
    let initialized = false;
    const cleanups: (() => void)[] = [];
    const listen = <T extends EventTarget>(t: T, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, opts);
      cleanups.push(() => t.removeEventListener(type, fn, opts));
    };
    const videoOf = (card: Element) => card.querySelector<HTMLVideoElement>(".op-card__video");

    const ensurePoster = (v: HTMLVideoElement | null) => {
      if (v && !v.getAttribute("poster") && v.dataset.poster) v.setAttribute("poster", v.dataset.poster);
    };
    const pauseVideo = (v: HTMLVideoElement | null) => {
      if (!v) return;
      try { v.pause(); v.currentTime = 0; } catch { /* ignore */ }
    };
    const playVideo = (v: HTMLVideoElement | null) => {
      if (!v) return;
      ensurePoster(v);
      if (reduceMotion) return pauseVideo(v);
      if (!v.getAttribute("src") && v.dataset.src) v.setAttribute("src", v.dataset.src);
      try {
        if (v.preload !== "auto") v.preload = "auto";
        if (v.readyState < 2) v.load();
      } catch { /* ignore */ }
      v.play()?.catch(() => { /* autoplay refused: poster stays visible */ });
    };

    // Short clips do not always honour `loop` on Safari: restart the focal one.
    cards.forEach((c) => {
      const v = videoOf(c);
      if (!v) return;
      listen(v, "ended", () => {
        if (!reduceMotion && mediaVisible && v.closest(".op-card.is-focal")) {
          v.currentTime = 0;
          v.play()?.catch(() => {});
        }
      });
    });

    const updateFocal = () => {
      const rowRect = row.getBoundingClientRect();
      const centerX = rowRect.left + rowRect.width / 2;
      let best = 0;
      let bestDist = Infinity;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - centerX);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      if (best === focalIdx) return;
      if (focalIdx >= 0) {
        cards[focalIdx].classList.remove("is-focal");
        pauseVideo(videoOf(cards[focalIdx]));
      }
      focalIdx = best;
      cards[focalIdx].classList.add("is-focal");
      if (mediaVisible) playVideo(videoOf(cards[focalIdx]));
      const n = (focalIdx % TOTAL) + 1;
      if (progressFillRef.current) progressFillRef.current.style.width = (n / TOTAL) * 100 + "%";
      if (progressCountRef.current) progressCountRef.current.textContent = pad2(n) + " / " + pad2(TOTAL);
    };

    const settleLoop = () => {
      clearTimeout(settleTimer);
      if (pointerDown || resetting || focalIdx < 0) return;
      updateFocal();
      scrollTarget = null;
      const current = cards[focalIdx];
      const original = originals[focalIdx % TOTAL];
      const restoreFocus = current.contains(document.activeElement);
      if (current !== original) {
        resetting = true;
        row.classList.add("is-loop-resetting");
        row.scrollTo({ left: row.scrollLeft + original.offsetLeft - current.offsetLeft, behavior: "instant" as ScrollBehavior });
        updateFocal();
        row.getBoundingClientRect();
        requestAnimationFrame(() => {
          row.classList.remove("is-loop-resetting");
          resetting = false;
        });
      }
      if (restoreFocus) original.querySelector<HTMLElement>(".op-card__detail")?.focus({ preventScroll: true });
    };
    const scheduleSettle = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settleLoop, 180);
    };

    const scrollCardToCenter = (card: HTMLElement) => {
      scrollTarget = card;
      const rowRect = row.getBoundingClientRect();
      row.scrollTo({ left: card.offsetLeft - rowRect.width / 2 + card.offsetWidth / 2, behavior: reduceMotion ? ("instant" as ScrollBehavior) : "smooth" });
      scheduleSettle();
    };

    cards.forEach((c) => c.classList.remove("is-focal"));
    cards.forEach((c) => pauseVideo(videoOf(c)));

    listen(row, "scrollend", settleLoop);
    listen(row, "pointerdown", () => { pointerDown = true; scrollTarget = null; });
    listen(row, "wheel", () => { scrollTarget = null; }, { passive: true });
    listen(window, "pointerup", () => { pointerDown = false; scheduleSettle(); });
    listen(window, "pointercancel", () => { pointerDown = false; scheduleSettle(); });
    listen(row, "scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => { updateFocal(); ticking = false; });
        ticking = true;
      }
      if (!resetting) scheduleSettle();
    }, { passive: true });

    cards.forEach((card) => {
      listen(card, "click", (e) => {
        if ((e.target as Element).closest("a")) return;
        if (!card.classList.contains("is-focal")) scrollCardToCenter(card);
      });
      const link = card.querySelector(".op-card__detail");
      if (link) listen(link, "focus", () => { if (!card.classList.contains("is-focal")) scrollCardToCenter(card); });
    });

    listen(row, "keydown", (ev) => {
      const e = ev as KeyboardEvent;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || focalIdx < 0) return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const currentIdx = scrollTarget ? cards.indexOf(scrollTarget) : focalIdx;
      const next = cards[currentIdx + dir];
      if (next) scrollCardToCenter(next);
    });

    const onMotion = () => {
      reduceMotion = motion.matches;
      cards.forEach((c) => pauseVideo(videoOf(c)));
      if (!reduceMotion && mediaVisible && focalIdx >= 0) playVideo(videoOf(cards[focalIdx]));
    };
    listen(motion, "change", onMotion);

    // Seasonal launch motion (product-launch.js) pauses offscreen.
    let sectionVisible = false;
    const renderLaunchMotion = () => {
      section.setAttribute("data-launch-motion", sectionVisible && !document.hidden && !reduceMotion ? "running" : "paused");
    };
    listen(document, "visibilitychange", renderLaunchMotion);
    const launchObserver = new IntersectionObserver((entries) => {
      if (!entries.length) return;
      sectionVisible = entries[0].isIntersecting;
      renderLaunchMotion();
    }, { threshold: 0.05 });
    launchObserver.observe(section);
    renderLaunchMotion();

    let posterObserver: IntersectionObserver | null = null;
    let playbackObserver: IntersectionObserver | null = null;
    const armMedia = () => {
      if (posterObserver) return;
      posterObserver = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          ensurePoster(videoOf(en.target));
          posterObserver?.unobserve(en.target);
        });
      }, { rootMargin: "200px" });
      cards.forEach((c) => posterObserver!.observe(c));
      playbackObserver = new IntersectionObserver((entries) => {
        if (!entries.length) return;
        mediaVisible = entries[0].isIntersecting;
        if (mediaVisible && focalIdx >= 0) playVideo(videoOf(cards[focalIdx]));
        else if (!mediaVisible) cards.forEach((c) => pauseVideo(videoOf(c)));
      }, { threshold: 0.05 });
      playbackObserver.observe(row);
    };
    if (acceptedRef.current) armMedia();
    else listen(document, "mwah:age-accepted", armMedia, { once: true });

    const initialPaint = () => {
      requestAnimationFrame(() => {
        if (initialized) return;
        initialized = true;
        const rowRect = row.getBoundingClientRect();
        const start = cards[TOTAL];
        row.scrollTo({ left: start.offsetLeft - rowRect.width / 2 + start.offsetWidth / 2, behavior: "instant" as ScrollBehavior });
        updateFocal();
      });
    };
    if (document.readyState === "complete") initialPaint();
    else listen(window, "load", initialPaint, { once: true });
    const initTimer = setTimeout(initialPaint, 250);

    let resizePending = false;
    listen(window, "resize", () => {
      if (resizePending) return;
      resizePending = true;
      requestAnimationFrame(() => {
        if (focalIdx >= 0) scrollCardToCenter(cards[focalIdx]);
        updateFocal();
        resizePending = false;
      });
    });

    return () => {
      clearTimeout(settleTimer);
      clearTimeout(initTimer);
      cleanups.forEach((fn) => fn());
      launchObserver.disconnect();
      posterObserver?.disconnect();
      playbackObserver?.disconnect();
      cards.forEach((c) => pauseVideo(videoOf(c)));
    };
  }, [progressFillRef, progressCountRef]);

  return (
    <section className="op-cards" ref={sectionRef}>
      <div className="op-cards__row" ref={rowRef}>
        <div className="op-cards__spacer" aria-hidden="true"></div>
        {PRODUCTS.map((p) => <Card key={"pre-" + p.slug} p={p} copy />)}
        {PRODUCTS.map((p) => <Card key={p.slug} p={p} copy={false} />)}
        {PRODUCTS.map((p) => <Card key={"post-" + p.slug} p={p} copy />)}
        <div className="op-cards__spacer" aria-hidden="true"></div>
      </div>
    </section>
  );
}
