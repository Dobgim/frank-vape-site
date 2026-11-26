import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readStorage, writeStorage } from "./dom";

const KEY = "mwah_wholesale_order";
export const MAX_UNITS_PER_LINE = 9999;

/** slug -> units */
export type OrderLines = Record<string, number>;

type OrderValue = {
  lines: OrderLines;
  totalUnits: number;
  setUnits: (slug: string, units: number) => void;
  add: (slug: string, units: number) => void;
  clear: () => void;
};

const OrderContext = createContext<OrderValue | null>(null);

function load(): OrderLines {
  try {
    const parsed = JSON.parse(readStorage("local", KEY) || "{}");
    const out: OrderLines = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Math.floor(Number(v));
      if (n > 0) out[k] = Math.min(n, MAX_UNITS_PER_LINE);
    }
    return out;
  } catch {
    return {};
  }
}

/** Wholesale order sheet kept in this browser until it is submitted. */
export function OrderProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<OrderLines>(load);

  useEffect(() => writeStorage("local", KEY, JSON.stringify(lines)), [lines]);

  const setUnits = useCallback((slug: string, units: number) => {
    setLines((prev) => {
      const n = Math.max(0, Math.min(MAX_UNITS_PER_LINE, Math.floor(units) || 0));
      const next = { ...prev };
      if (n === 0) delete next[slug];
      else next[slug] = n;
      return next;
    });
  }, []);

  const add = useCallback((slug: string, units: number) => {
    setLines((prev) => ({ ...prev, [slug]: Math.min(MAX_UNITS_PER_LINE, (prev[slug] || 0) + Math.max(1, Math.floor(units))) }));
  }, []);

  const clear = useCallback(() => setLines({}), []);

  const value = useMemo(() => ({
    lines,
    totalUnits: Object.values(lines).reduce((a, b) => a + b, 0),
    setUnits,
    add,
    clear,
  }), [lines, setUnits, add, clear]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder(): OrderValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrder must be used inside <OrderProvider>");
  return ctx;
}
