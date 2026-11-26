import { useRef } from "react";
import { Link } from "react-router-dom";
import FindUs from "../components/FindUs";
import HeroRotator from "../components/HeroRotator";
import ProductCoverflow from "../components/ProductCoverflow";
import { PRODUCTS } from "../data/products";
import { usePageMeta } from "../hooks/usePageMeta";

const pad2 = (n: number) => (n < 10 ? "0" : "") + n;

/** One-page homepage (Figma 251:7): hero, product coverflow, Find Us locator. */
export default function HomePage() {
  usePageMeta(
    "MWAH | Cannabis Vape Pens Designed for Her",
    "Meet MWAH's nine lip-gloss-shaped 1g all-in-one cannabis vape pens, available at licensed retailers.",
    { bodyClass: "onepage-body" },
  );
  const fillRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const total = pad2(PRODUCTS.length);

  return (
    <main className="onepage" id="main-content">
      <h1 className="visually-hidden">MWAH cannabis vape pens</h1>
      <HeroRotator />

      <section className="op-products-header" id="products">
        <div className="op-products-header__row">
          <div className="op-products-header__left">
            <div className="op-eyebrow">
              <span className="op-dot" aria-hidden="true"></span>
              <span className="op-eyebrow__text">PRODUCTS&nbsp;&nbsp;&middot;&nbsp;&nbsp;{total}</span>
            </div>
            <h2 className="op-products-header__title">Meet the collection.</h2>
            <p className="op-products-header__sub">Nine flavors. 1g all-in-one cannabis vape pens.</p>
            <Link className="op-products-header__catalog-link" to="/products/">VIEW ALL PRODUCTS</Link>
          </div>
        </div>
        <div className="op-progress">
          <div className="op-progress__left">
            <span className="op-progress__label">PRODUCTS</span>
            <span className="op-progress__count" ref={countRef}>01&nbsp;/&nbsp;{total}</span>
          </div>
          <div className="op-progress__bar" aria-hidden="true">
            <div className="op-progress__fill" ref={fillRef}></div>
          </div>
          <span className="op-progress__hint">
            <span className="op-progress__hint-desktop">SCROLL&nbsp;→</span>
            <span className="op-progress__hint-mobile">SWIPE&nbsp;←&nbsp;→</span>
          </span>
        </div>
      </section>

      <ProductCoverflow progressFillRef={fillRef} progressCountRef={countRef} />
      <FindUs />
    </main>
  );
}
