import { useEffect } from "react";
import { BrowserRouter, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AgeGate from "./components/AgeGate";
import RequestModal from "./components/RequestModal";
import { FooterSignup } from "./components/Signup";
import SignupPopup from "./components/SignupPopup";
import SiteFooter from "./components/SiteFooter";
import SiteNav from "./components/SiteNav";
import { AgeGateProvider } from "./lib/ageGate";
import HomePage from "./pages/HomePage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ProductsPage from "./pages/ProductsPage";
import AboutPage from "./pages/content/AboutPage";
import KissLabsPage from "./pages/content/KissLabsPage";
import NotFoundPage from "./pages/content/NotFoundPage";
import PenniferPage from "./pages/content/PenniferPage";
import PrivacyPage from "./pages/content/PrivacyPage";
import TermsPage from "./pages/content/TermsPage";
import WashingtonPage from "./pages/content/WashingtonPage";

/**
 * Hash targets (#products, #find-us) land after the page renders, and again
 * once the age gate is accepted, because the gate locks scrolling. Plain
 * navigations start at the top, like the original's scrollRestoration=manual.
 */
function ScrollManager() {
  const { pathname, hash, search } = useLocation();
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);
  useEffect(() => {
    const id = decodeURIComponent(hash.split(/[?&]/)[0].slice(1));
    if (!id) {
      window.scrollTo(0, 0);
      return;
    }
    let tries = 0;
    let raf = 0;
    const jump = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
      else if (tries++ < 30) raf = requestAnimationFrame(jump);
    };
    raf = requestAnimationFrame(jump);
    const afterGate = () => requestAnimationFrame(() => requestAnimationFrame(jump));
    document.addEventListener("mwah:age-accepted", afterGate, { once: true });
    const onLoad = () => jump();
    window.addEventListener("load", onLoad, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mwah:age-accepted", afterGate);
      window.removeEventListener("load", onLoad);
    };
  }, [pathname, hash, search]);
  return null;
}

/** Routes same-origin <a href="/..."> clicks inside copied HTML (e.g. FAQ answers) through the router. */
function InternalLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate]);
  return null;
}

function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <SiteNav />
      <Outlet />
      <SiteFooter signup={isHome ? <FooterSignup /> : undefined} />
      {isHome && <SignupPopup />}
      {isHome && <RequestModal />}
      <AgeGate />
      <ScrollManager />
      <InternalLinks />
    </>
  );
}

export default function App() {
  return (
    <AgeGateProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="index.html" element={<HomePage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/:slug" element={<ProductDetailPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="washington" element={<WashingtonPage />} />
            <Route path="kiss-labs" element={<KissLabsPage />} />
            <Route path="kiss-labs/what-is-a-pennifer" element={<PenniferPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AgeGateProvider>
  );
}
