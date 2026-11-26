import { Link } from "react-router-dom";
import { PRODUCTS } from "../data/products";
import { usePageMeta } from "../hooks/usePageMeta";

const FAQ: { q: string; a: React.ReactNode; open?: boolean }[] = [
  {
    q: "Where can I buy MWAH vape pens?",
    open: true,
    a: <>MWAH vape pens are sold at licensed cannabis retailers. Use the <Link to="/#find-us">store locator</Link> to find a nearby retailer, or view the <Link to="/washington/">Washington availability guide</Link>. Call ahead to confirm current availability.</>,
  },
  { q: "Are MWAH products sold online?", a: "No. MWAH does not sell or ship cannabis products online. Products are available only through licensed cannabis retailers for adults 21 and older." },
  { q: "What is a MWAH vape pen?", a: "A MWAH vape pen is a 1g all-in-one cannabis vape device with ceramic heating, auto-draw activation, USB-C charging, and a lip-gloss-inspired shape." },
  { q: "Are MWAH vape pens rechargeable?", a: "Yes. Current MWAH all-in-one pens recharge through USB-C, which recharges the built-in battery." },
  { q: "Is a MWAH pen an all-in-one or a cartridge?", a: "The current MWAH lineup is all-in-one. The battery, heating element, and oil reservoir are in one device, so it does not require a separate cartridge battery." },
  {
    q: "What MWAH flavors are available?",
    a: <>The nine current flavors are Latte Lover, It&rsquo;s Giving Guava, and Berry Baddie in sativa; Mango Mamacita, Peach Perfection, and Strawberry Matcha in hybrid; and She Ate Strawberry, Glow Up Grape, and Watermelon Wifey in indica.</>,
  },
  {
    q: "What is a pennifer?",
    a: <>A pennifer is a playful, feminine nickname for a vape pen. Read the full <Link to="/kiss-labs/what-is-a-pennifer">pennifer slang explainer in KISS LABS</Link> for how it compares with Penjamin, Penny, and Penelope.</>,
  },
];

/** /products/ catalog. */
export default function ProductsPage() {
  usePageMeta(
    "MWAH Cannabis Vape Pens | All Flavors",
    "Explore all nine MWAH 1g all-in-one cannabis vape pen flavors, then find licensed retailers carrying MWAH.",
  );
  return (
    <main className="page" id="main-content">
      <section className="products-hero">
        <p className="caption">THE COLLECTION</p>
        <h1>MWAH cannabis vape pens</h1>
        <p className="products-hero__intro">
          Explore all nine MWAH 1g all-in-one cannabis vape pen flavors. Each lip-gloss-shaped device uses ceramic heating, auto-draw activation, and USB-C charging. MWAH is sold only through licensed cannabis retailers.
        </p>
        <div className="products-hero__actions">
          <Link className="op-btn op-btn--primary" to="/#find-us">FIND A STORE</Link>
          <Link className="op-btn op-btn--secondary" to="/#products">VIEW THE HOMEPAGE COLLECTION</Link>
        </div>
      </section>

      <section className="products-grid" aria-label="Nine MWAH products with detail pages">
        {PRODUCTS.map((p) => {
          const img = <img className={p.catalogPaper ? "product-card__image--paper-blend" : undefined} src={p.thumb} width={800} height={1000} alt={p.catalogAlt} loading="lazy" />;
          return (
            <article className="product-card" key={p.slug}>
              {p.catalogPaper ? <div className="product-card__media--paper">{img}</div> : img}
              <div className="product-card__body">
                <p className="product-card__type">{p.type}</p>
                <h2><Link className="product-card__link" to={`/products/${p.slug}`}>{p.name}</Link></h2>
                <p className="product-card__desc">{p.vibe}</p>
                <p className="product-card__moods">{p.homeMoods}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="products-format" id="format-guide" aria-labelledby="productsFormatTitle">
        <p className="caption">THE BASICS</p>
        <h2 id="productsFormatTitle">All-in-one pen vs cartridge</h2>
        <div className="products-format__grid">
          <div className="products-format__item">
            <h3>All-in-one pen</h3>
            <p>An all-in-one combines the battery, heating element, and oil reservoir in one device. Current MWAH pens are rechargeable 1g all-in-ones with auto-draw activation, ceramic heating, and USB-C charging, so no separate battery is required.</p>
          </div>
          <div className="products-format__item">
            <h3>Cartridge</h3>
            <p>A cartridge contains oil and connects to a separate compatible battery. The battery can be reused with compatible cartridges. The current MWAH lineup is not a separate cartridge format.</p>
          </div>
        </div>
      </section>

      <section className="products-faq" aria-labelledby="productsFaqTitle">
        <h2 id="productsFaqTitle">MWAH product FAQ</h2>
        <div className="products-faq__list">
          {FAQ.map((item) => (
            <details className="products-faq__item" key={item.q} open={item.open}>
              <summary className="products-faq__q">{item.q}</summary>
              <div className="products-faq__a">{item.a}</div>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
