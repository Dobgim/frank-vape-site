import { useEffect } from "react";

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Sets <title>, meta description, OG tags and the page's body attributes. */
export function usePageMeta(title: string, description: string, opts: { bodyClass?: string; pageType?: string } = {}) {
  const { bodyClass, pageType } = opts;
  useEffect(() => {
    document.title = title;
    if (description) {
      setMeta('meta[name="description"]', "name", "description", description);
      setMeta('meta[property="og:description"]', "property", "og:description", description);
    }
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    if (bodyClass) document.body.classList.add(bodyClass);
    if (pageType) document.body.setAttribute("data-page-type", pageType);
    return () => {
      if (bodyClass) document.body.classList.remove(bodyClass);
      if (pageType) document.body.removeAttribute("data-page-type");
    };
  }, [title, description, bodyClass, pageType]);
}
