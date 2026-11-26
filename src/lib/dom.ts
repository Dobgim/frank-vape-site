type InertEntry = { el: Element; inert: boolean; ariaHidden: string | null };

/**
 * Marks every top-level app node except the one holding `keep` inert +
 * aria-hidden, the way the original site did for body children while a
 * dialog was open. Returns a function that restores the previous attributes.
 */
export function makeSiblingsInert(keep: Element): () => void {
  const root = document.getElementById("root") ?? document.body;
  let owner: Element | null = keep;
  while (owner && owner.parentElement !== root) owner = owner.parentElement;
  const entries: InertEntry[] = [];
  Array.from(root.children).forEach((child) => {
    if (child === owner || child.tagName === "SCRIPT" || child.tagName === "NOSCRIPT") return;
    entries.push({ el: child, inert: child.hasAttribute("inert"), ariaHidden: child.getAttribute("aria-hidden") });
    child.setAttribute("inert", "");
    child.setAttribute("aria-hidden", "true");
  });
  return () => {
    entries.forEach((e) => {
      if (!e.inert) e.el.removeAttribute("inert");
      if (e.ariaHidden == null) e.el.removeAttribute("aria-hidden");
      else e.el.setAttribute("aria-hidden", e.ariaHidden);
    });
  };
}

/** Keeps Tab / Shift+Tab inside `container`. */
export function trapTab(event: KeyboardEvent, container: Element, selector?: string): void {
  if (event.key !== "Tab") return;
  const nodes = container.querySelectorAll<HTMLElement>(
    selector ?? 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  const focusable = Array.from(nodes).filter((n) => n.offsetParent !== null && !(n as HTMLButtonElement).disabled);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function prefersReducedMotion(): boolean {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

export function isMobileViewport(): boolean {
  return !!(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
}

export function readStorage(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(storage: "local" | "session", key: string, value: string): void {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    /* storage blocked (private mode); the feature degrades gracefully */
  }
}
