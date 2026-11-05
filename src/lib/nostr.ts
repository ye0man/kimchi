import { EventStore } from "applesauce-core";
import { createEventLoaderForStore } from "applesauce-loaders/loaders";
import { RelayPool } from "applesauce-relay";
import { initNostrWasm } from "nostr-wasm";

import { extraRelays$, lookupRelays$ } from "./settings";

// Initialize nostr-wasm for signature verification of public events.
const nw = await initNostrWasm();

/** In-memory store for public Nostr data (profiles, relay lists, key packages). */
export const eventStore = new EventStore();

eventStore.verifyEvent = (e) => {
  try {
    nw.verifyEvent(e);
    return true;
  } catch {
    return false;
  }
};

/** Shared relay connection pool. */
export const pool = new RelayPool();

/**
 * Any subscription to a missing replaceable auto-fetches it (batched/deduped)
 * from the configured lookup + extra relays, landing it in `eventStore` — this
 * powers both reactive `castUser(...).*$` reads and the imperative Directory.
 */
export const eventLoader = createEventLoaderForStore(eventStore, pool, {
  lookupRelays: lookupRelays$,
  extraRelays: extraRelays$,
});

if (import.meta.env.DEV) {
  // @ts-expect-error debugging handle
  window.eventStore = eventStore;
  // @ts-expect-error debugging handle
  window.pool = pool;
}
