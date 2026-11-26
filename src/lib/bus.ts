/** Tiny typed event bus so the hero, request modal and locator can talk without prop drilling. */
type Events = {
  "locator:flavor": { flavor: string };
  "locator:find": { market: string; zip: string };
  "request:open": undefined;
};

type Handler<K extends keyof Events> = (payload: Events[K]) => void;
const handlers: { [K in keyof Events]?: Set<Handler<K>> } = {};

/** Locator requests made before the locator mounted are replayed on subscribe. */
const pending: Partial<{ [K in keyof Events]: Events[K] }> = {};

export function emit<K extends keyof Events>(type: K, payload: Events[K]): void {
  const set = handlers[type];
  if (set && set.size) set.forEach((h) => h(payload));
  else pending[type] = payload;
}

export function on<K extends keyof Events>(type: K, handler: Handler<K>): () => void {
  const store = handlers as Record<string, Set<Handler<K>> | undefined>;
  const set = (store[type] ??= new Set<Handler<K>>());
  set.add(handler);
  if (type in pending) {
    const payload = pending[type] as Events[K];
    delete pending[type];
    handler(payload);
  }
  return () => set.delete(handler);
}
