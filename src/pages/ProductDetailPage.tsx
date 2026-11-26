import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PRODUCTS, productBySlug, type Product } from "../data/products";
import { usePageMeta } from "../hooks/usePageMeta";
import { LAUNCHES } from "../lib/locator/launch";
import { prefersReducedMotion } from "../lib/dom";
import NotFoundPage from "./content/NotFoundPage";

/** Image carousel inside the PDP hero (product-gallery.js): cross-fade, thumbs, dots, swipe. */
function Gallery({ p }: { p: Product }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const n = p.images.length;
  const go = (i: number) => setIndex(((i % n) + n) % n);
  useEffect(() => setIndex(0), [p.slug]);

  return (
    <div className="pd-gallery">
      <div
        className="pd-hero__media is-gallery"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) >= 40) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        {p.images.map((img, i) => (
          <img
            key={img.src}
            className={[img.className, i === index ? "is-active" : ""].filter(Boolean).join(" ")}
            src={img.src}
            width={img.width}
            height={img.height}
            alt={img.alt}
            loading={i === 0 ? undefined : "lazy"}
          />
        ))}
        <p className="pd-gallery__count">{index + 1} / {n}</p>
        <button type="button" className="pd-gallery__arrow pd-gallery__arrow--prev" aria-label="Previous image" onClick={() => go(index - 1)}>‹</button>
        <button type="button" className="pd-gallery__arrow pd-gallery__arrow--next" aria-label="Next image" onClick={() => go(index + 1)}>›</button>
      </div>
      <div className="pd-gallery__thumbs">
        {p.images.map((img, i) => (
          <button key={img.src} type="button" className="pd-gallery__thumb" aria-label={`View image ${i + 1} of ${n}`} aria-current={i === index ? "true" : "false"} onClick={() => go(i)}>
            <img src={img.src} className={img.className} alt="" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="pd-gallery__dots">
        {p.images.map((img, i) => (
          <button key={img.src} type="button" className="pd-gallery__dot" aria-label={`Image ${i + 1} of ${n}`} aria-current={i === index ? "true" : "false"} onClick={() => go(i)} />
        ))}
      </div>
    </div>
  );
}

const SETTLE_MS = 1000;
const counterLabel = (index: number, perView: number, total: number) => {
  const first = index + 1;
  const last = Math.min(total, index + perView);
  return (first === last ? `${first}` : `${first}–${last}`) + " / " + total;
};

/** "Meet the rest of the line" row (product-flavor-carousel.js): pages by what fits, wraps at the ends. */
function RelatedFlavors({ current }: { current: Product }) {
  const others = PRODUCTS.filter((p) => p.slug !== current.slug);
  const trackRef = useRef<HTMLUListElement>(null);
  const [label, setLabel] = useState(`1–4 / ${others.length}`);
  const state = useRef({ index: 0, perView: 1, pendingLeft: null as number | null, settle: 0 as number | ReturnType<typeof setTimeout> });

  const items = () => Array.from(trackRef.current?.querySelectorAll<HTMLElement>(".pd-related__item") ?? []);
  const gap = () => (trackRef.current ? parseFloat(getComputedStyle(trackRef.current).columnGap) || 0 : 0);
  const lastIndex = () => Math.max(0, others.length - state.current.perView);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const first = items()[0];
    if (!track || !first) return;
    const g = gap();
    state.current.perView = Math.max(1, Math.floor((track.clientWidth + g) / (first.offsetWidth + g)));
  }, []);

  const render = useCallback(() => setLabel(counterLabel(state.current.index, state.current.perView, others.length)), [others.length]);

  const syncFromScroll = useCallback(() => {
    const track = trackRef.current;
    const first = items()[0];
    const s = state.current;
    if (!track || !first) return;
    if (s.pendingLeft !== null) {
      if (Math.abs(track.scrollLeft - s.pendingLeft) > 2) return;
      s.pendingLeft = null;
    }
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    const nearest = Math.round(track.scrollLeft / (first.offsetWidth + gap()));
    s.index = atEnd ? lastIndex() : Math.min(nearest, lastIndex());
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    state.current.index = 0;
    track.scrollLeft = 0;
    measure();
    render();
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; syncFromScroll(); });
    };
    const clearPending = () => { state.current.pendingLeft = null; };
    const onResize = () => { measure(); syncFromScroll(); };
    track.addEventListener("scroll", onScroll, { passive: true });
    ["pointerdown", "touchstart", "wheel"].forEach((t) => track.addEventListener(t, clearPending, { passive: true }));
    window.addEventListener("resize", onResize);
    return () => {
      track.removeEventListener("scroll", onScroll);
      ["pointerdown", "touchstart", "wheel"].forEach((t) => track.removeEventListener(t, clearPending));
      window.removeEventListener("resize", onResize);
    };
  }, [current.slug, measure, render, syncFromScroll]);

  const go = (step: number) => {
    const track = trackRef.current;
    const list = items();
    const s = state.current;
    if (!track || !list.length) return;
    const end = lastIndex();
    s.index = step > 0 ? (s.index >= end ? 0 : Math.min(s.index + s.perView, end)) : (s.index <= 0 ? end : Math.max(0, s.index - s.perView));
    const maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    s.pendingLeft = Math.min(list[s.index].offsetLeft - track.offsetLeft, maxLeft);
    clearTimeout(s.settle as ReturnType<typeof setTimeout>);
    s.settle = setTimeout(() => { s.pendingLeft = null; syncFromScroll(); }, SETTLE_MS);
    track.scrollTo({ left: s.pendingLeft, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    render();
  };

  return (
    <section className="pd-related" aria-labelledby="pdRelatedTitle">
      <div className="pd-related__head">
        <h2 id="pdRelatedTitle">Meet the rest of the line</h2>
        <p className="pd-related__count" aria-live="polite">{label}</p>
      </div>
      <div className="pd-related__viewport">
        <button type="button" className="pd-related__arrow" data-related-prev aria-label="Previous flavors" onClick={() => go(-1)}><span aria-hidden="true">←</span></button>
        <ul className="pd-related__track" data-related-track ref={trackRef}>
          {others.map((p) => (
            <li className="pd-related__item" key={p.slug}>
              <Link className="pd-related__card" to={`/products/${p.slug}`}>
                <span className="pd-related__tile"><img className="pd-related__img" src={p.thumb} width={800} height={1000} alt="" loading="lazy" /></span>
                <span className="pd-related__name">{p.name}</span>
                <span className="pd-related__type">{p.type}</span>
              </Link>
            </li>
          ))}
        </ul>
        <button type="button" className="pd-related__arrow" data-related-next aria-label="Next flavors" onClick={() => go(1)}><span aria-hidden="true">→</span></button>
      </div>
    </section>
  );
}

/** /products/:slug detail page. */
export default function ProductDetailPage() {
  const { slug } = useParams();
  const p = productBySlug(slug);
  usePageMeta(p?.title ?? "Not found — MWAH", p?.metaDescription ?? "");
  if (!p) return <NotFoundPage />;

  const findHref = LAUNCHES[p.slug] ? `/?flavor=${p.slug}#find-us` : "/#find-us";

  return (
    <main className="page">
      <section className="pd-hero">
        <Gallery p={p} key={p.slug} />
        <div className="pd-hero__copy">
          <p className="caption">{p.caption}</p>
          <h1>{p.name}</h1>
          <p className="pd-hero__vibe">{p.vibe}</p>
          <ul className="pd-moods" aria-label="Moods">
            {p.moods.map((m) => <li className="pd-moods__pill" key={m}>{m}</li>)}
          </ul>
          <Link to={findHref} className="op-btn op-btn--primary pd-hero__cta">FIND A STORE</Link>
          <p className="pd-hero__fine">Sold only at licensed cannabis retailers.</p>
          <div className="pd-acc" key={p.slug}>
            <details className="pd-acc__item" open>
              <summary className="pd-acc__summary">Description</summary>
              <div className="pd-acc__body"><p className="pd-hero__body">{p.description}</p></div>
            </details>
            <details className="pd-acc__item">
              <summary className="pd-acc__summary">Specs</summary>
              <div className="pd-acc__body">
                <dl className="pd-specs__grid">
                  {p.specs.map((s) => (
                    <div className="pd-specs__cell" key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>
                  ))}
                </dl>
              </div>
            </details>
            <details className="pd-acc__item">
              <summary className="pd-acc__summary">FAQ</summary>
              <div className="pd-acc__body">
                <dl className="pd-faq__list">
                  {p.faq.map((f) => (
                    <div className="pd-faq__item" key={f.q}>
                      <dt>{f.q}</dt>
                      {/* Answers are copied verbatim from the source page; links are routed by <InternalLinks>. */}
                      <dd dangerouslySetInnerHTML={{ __html: f.a }} />
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          </div>
        </div>
      </section>
      <RelatedFlavors current={p} />
    </main>
  );
}
