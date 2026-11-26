// Based on gimmemwah.com/404. The source page styled this block with an inline
// <style>; the same values are expressed here as Tailwind utilities.
import { Link } from "react-router-dom";
import { usePageMeta } from "../../hooks/usePageMeta";

export default function NotFoundPage() {
  usePageMeta("Not found — MWAH", "", { pageType: "not_found" });
  return (
    <main className="notfound flex min-h-[70vh] flex-col items-center justify-center gap-4 px-[var(--content-pad,48px)] py-16 text-center">
      <div className="notfound__code text-[72px] font-extrabold leading-none tracking-[-0.04em] text-ink">404</div>
      <div className="notfound__msg text-[24px] font-bold text-ink">Page not found.</div>
      <p className="notfound__sub text-text-mid">That link might be old, or we moved something.</p>
      <Link to="/" className="btn btn--primary">Back to home</Link>
    </main>
  );
}
