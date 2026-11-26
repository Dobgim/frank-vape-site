import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SOCIAL } from "../config";
import { makeSiblingsInert, trapTab } from "../lib/dom";
import { CloseIcon, InstagramIcon, TikTokIcon, TrademarkMark, Wordmark, XIcon } from "./Icons";

function Socials() {
  return (
    <>
      <a className="op-nav__ig" href={SOCIAL.instagram} aria-label="Instagram (opens in new tab)" target="_blank" rel="noopener noreferrer">
        <InstagramIcon />
      </a>
      <a className="op-nav__ig" href={SOCIAL.x} aria-label="X (opens in new tab)" target="_blank" rel="noopener noreferrer">
        <XIcon />
      </a>
      <a className="op-nav__ig" href={SOCIAL.tiktok} aria-label="TikTok (opens in new tab)" target="_blank" rel="noopener noreferrer">
        <TikTokIcon />
      </a>
    </>
  );
}

/** Shared navigation (nav.js): PRODUCTS / FIND US anchors keep the one-page model. */
export default function SiteNav() {
  const { pathname } = useLocation();
  const isHome = pathname === "/" || pathname === "/index.html";
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);

  const links = (
    <>
      <Link to={isHome ? "#products" : "/#products"} className="op-nav__link">PRODUCTS</Link>
      <Link to={isHome ? "#find-us" : "/#find-us"} className="op-nav__link">FIND US</Link>
    </>
  );

  const close = useCallback((focusBack: boolean) => {
    returnFocus.current = focusBack;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open || !headerRef.current) return;
    document.body.style.overflow = "hidden";
    const restore = makeSiblingsInert(headerRef.current);
    drawerRef.current?.querySelector<HTMLElement>("a")?.focus();
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => { if (!e.matches) close(false); };
    mq.addEventListener("change", onChange);
    return () => {
      document.body.style.overflow = "";
      restore();
      mq.removeEventListener("change", onChange);
      if (returnFocus.current) hamburgerRef.current?.focus();
    };
  }, [open, close]);

  useEffect(() => close(false), [pathname, close]);

  return (
    <header data-nav ref={headerRef}>
      <nav className="op-nav" aria-label="Site">
        <button
          ref={hamburgerRef}
          type="button"
          className="op-nav__hamburger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="navDrawer"
          onClick={() => (open ? close(false) : setOpen(true))}
          onKeyDown={(e) => { if (e.key === "Escape" && open) { e.preventDefault(); close(true); } }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
        <Link to="/" className="op-nav__logo" aria-label="MWAH home">
          <Wordmark className="op-nav__wordmark-svg" />
          <TrademarkMark className="op-nav__tm-svg" />
        </Link>
        <div className="op-nav__center">{links}</div>
        <div className="op-nav__social"><Socials /></div>
      </nav>
      <div
        id="navDrawer"
        ref={drawerRef}
        className="op-nav__drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); close(true); return; }
          if (drawerRef.current) trapTab(e.nativeEvent, drawerRef.current, 'button, [href], [tabindex]:not([tabindex="-1"])');
        }}
        onClick={(e) => { if ((e.target as Element).closest("a")) close(false); }}
      >
        <div className="op-nav__drawer-head">
          <span className="op-nav__drawer-brand" aria-hidden="true">MWAH</span>
          <button type="button" className="op-nav__drawer-close" aria-label="Close menu" onClick={() => close(true)}>
            <CloseIcon />
          </button>
        </div>
        <div className="op-nav__drawer-links">{links}</div>
        <div className="op-nav__drawer-social"><Socials /></div>
      </div>
    </header>
  );
}
