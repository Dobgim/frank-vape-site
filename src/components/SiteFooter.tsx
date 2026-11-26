import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SOCIAL } from "../config";
import { TrademarkMark, Wordmark } from "./Icons";

/** Required cannabis advertising warning (WAC 314-55-155): must stay verbatim. */
export const LCB_WARNING =
  "This product has intoxicating effects and may be habit forming. Marijuana can impair concentration, coordination, and judgment. Do not operate a vehicle or machinery under the influence of this drug. There may be health risks associated with consumption of this product. For use only by adults 21 and older. Keep out of reach of children. Marijuana products may be purchased or possessed only by persons 21 and older. MWAH is licensed in Washington and California.";

/**
 * Shared footer (footer.js). On the homepage the newsletter signup replaces
 * the brand block (footer-signup.js), which is what `signup` does here.
 */
export default function SiteFooter({ signup }: { signup?: ReactNode }) {
  return (
    <footer data-footer>
      <footer className={"op-footer" + (signup ? " op-footer--signup" : "")}>
        <div className="op-footer__top">
          <div className="op-footer__brand">
            {signup ?? (
              <>
                <div className="op-footer__wordmark" aria-label="MWAH">
                  <Wordmark className="op-footer__wordmark-svg" />
                  <TrademarkMark className="op-footer__tm-svg" />
                </div>
                <p className="op-footer__tagline">
                  Cannabis designed for her.
                  <br />
                  Find us at licensed retailers.
                </p>
              </>
            )}
          </div>
          <div className="op-footer__col">
            <p className="op-footer__col-title">SITE</p>
            <Link to="/#products" className="op-footer__link">PRODUCTS</Link>
            <Link to="/#find-us" className="op-footer__link">FIND US</Link>
            <Link to="/about" className="op-footer__link">ABOUT</Link>
            <Link to="/kiss-labs/" className="op-footer__link">KISS LABS</Link>
          </div>
          <div className="op-footer__col">
            <p className="op-footer__col-title">LEGAL</p>
            <Link to="/terms" className="op-footer__link">TERMS</Link>
            <Link to="/privacy" className="op-footer__link">PRIVACY</Link>
          </div>
          <div className="op-footer__col">
            <p className="op-footer__col-title">FOLLOW</p>
            <a href={SOCIAL.instagram} className="op-footer__link" aria-label="Instagram (opens in new tab)" target="_blank" rel="noopener noreferrer">INSTAGRAM</a>
            <a href={SOCIAL.x} className="op-footer__link" aria-label="X (opens in new tab)" target="_blank" rel="noopener noreferrer">X</a>
            <a href={SOCIAL.tiktok} className="op-footer__link" aria-label="TikTok (opens in new tab)" target="_blank" rel="noopener noreferrer">TIKTOK</a>
          </div>
        </div>
        <div className="op-footer__lcb">
          <p>{LCB_WARNING}</p>
        </div>
        <div className="op-footer__legal">
          <p>&copy; {new Date().getFullYear()} MWAH. All rights reserved.&nbsp;&nbsp;&middot;&nbsp;&nbsp;Patent Pending.</p>
        </div>
      </footer>
    </footer>
  );
}
