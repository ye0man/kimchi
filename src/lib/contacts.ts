import { useSyncExternalStore } from "react";

/** A locally remembered person you have shared a group with. */
export interface Contact {
  pubkey: string;
  name?: string;
  picture?: string;
  relays?: string[];
  lastSeen: number;
  groups: string[];
  keyPackage?: unknown;
  /** True when the user explicitly chose to keep this person. */
  saved: boolean;
}

export interface ContactDraft {
  pubkey: string;
  name?: string;
  picture?: string;
  relays?: string[];
  groupId?: string;
  keyPackage?: unknown;
  saved?: boolean;
  /** Manual adds are saved and clear any previous "goodbye". */
  explicit?: boolean;
}

interface Dismissal {
  pubkey: string;
  until: number;
}

const PREFIX = "kimchi:contacts:v1:";
const DISMISSED_PREFIX = "kimchi:contacts-dismissed:v1:";
const RECENT_TTL_MS = 24 * 3_600_000;
const DISMISS_TTL_MS = 30 * 24 * 3_600_000;

const cache = new Map<string, Contact[]>();
const sorted = new Map<string, Contact[]>();
const listeners = new Map<string, Set<() => void>>();
const EMPTY: Contact[] = [];

function key(account: string): string {
  return `${PREFIX}${account}`;
}

function read(account: string): Contact[] {
  const cached = cache.get(account);
  if (cached) return cached;
  let contacts: Contact[] = [];
  try {
    const raw = localStorage.getItem(key(account));
    if (raw) {
      contacts = (JSON.parse(raw) as Contact[]).map((contact) => ({
        ...contact,
        groups: contact.groups ?? [],
        saved: Boolean(contact.saved),
      }));
    }
  } catch {
    contacts = [];
  }
  cache.set(account, contacts);
  return contacts;
}

function emit(account: string): void {
  for (const listener of listeners.get(account) ?? []) listener();
}

function write(account: string, contacts: Contact[]): void {
  cache.set(account, contacts);
  sorted.delete(account);
  try {
    localStorage.setItem(key(account), JSON.stringify(contacts));
  } catch {}
  emit(account);
}

function readDismissed(account: string): Dismissal[] {
  try {
    const raw = localStorage.getItem(`${DISMISSED_PREFIX}${account}`);
    return raw ? (JSON.parse(raw) as Dismissal[]) : [];
  } catch {
    return [];
  }
}

function writeDismissed(account: string, list: Dismissal[]): void {
  try {
    localStorage.setItem(`${DISMISSED_PREFIX}${account}`, JSON.stringify(list));
  } catch {}
}

function isDismissed(account: string, pubkey: string): boolean {
  const now = Date.now();
  return readDismissed(account).some(
    (entry) => entry.pubkey === pubkey && entry.until > now,
  );
}

function clearDismissed(account: string, pubkey: string): void {
  const list = readDismissed(account).filter(
    (entry) => entry.pubkey !== pubkey,
  );
  writeDismissed(account, list);
}

/** All locally remembered contacts for an account, newest activity first. */
export function listContacts(account: string): Contact[] {
  const stable = sorted.get(account);
  if (stable) return stable;
  const next = [...read(account)].sort((a, b) => b.lastSeen - a.lastSeen);
  sorted.set(account, next);
  return next;
}

/** Merge people into the contact book without dropping existing group links. */
export function upsertContacts(account: string, drafts: ContactDraft[]): void {
  if (!account || drafts.length === 0) return;
  const current = new Map(
    read(account).map((contact) => [contact.pubkey, contact]),
  );
  for (const draft of drafts) {
    if (!draft.pubkey || draft.pubkey === account) continue;
    if (draft.explicit) clearDismissed(account, draft.pubkey);
    else if (isDismissed(account, draft.pubkey)) continue;
    const previous = current.get(draft.pubkey);
    const groups = new Set(previous?.groups ?? []);
    if (draft.groupId) groups.add(draft.groupId);
    current.set(draft.pubkey, {
      pubkey: draft.pubkey,
      name: draft.name ?? previous?.name,
      picture: draft.picture ?? previous?.picture,
      relays: draft.relays ?? previous?.relays,
      lastSeen: Date.now(),
      groups: [...groups],
      keyPackage: draft.keyPackage ?? previous?.keyPackage,
      saved: draft.saved ?? previous?.saved ?? false,
    });
  }
  write(account, [...current.values()]);
}

/** Remember every member of a group as a recent (expiring) person. */
export function recordGroupMembers(
  account: string,
  groupId: string,
  pubkeys: string[],
): void {
  upsertContacts(
    account,
    pubkeys.map((pubkey) => ({ pubkey, groupId })),
  );
}

/** Explicitly keep a person, clearing any previous "goodbye". */
export function saveContact(account: string, pubkey: string): void {
  const existing = read(account).find((contact) => contact.pubkey === pubkey);
  if (existing) {
    write(
      account,
      read(account).map((contact) =>
        contact.pubkey === pubkey
          ? { ...contact, saved: true, lastSeen: Date.now() }
          : contact,
      ),
    );
  } else {
    upsertContacts(account, [{ pubkey, saved: true, explicit: true }]);
  }
  clearDismissed(account, pubkey);
}

/** Remove a person from history and suppress automatic re-adding for 30 days. */
export function dismissContact(account: string, pubkey: string): void {
  write(
    account,
    read(account).filter((contact) => contact.pubkey !== pubkey),
  );
  const now = Date.now();
  const list = readDismissed(account).filter(
    (entry) => entry.until > now && entry.pubkey !== pubkey,
  );
  writeDismissed(account, [...list, { pubkey, until: now + DISMISS_TTL_MS }]);
}

/** Remove a contact without a suppression tombstone. */
export function removeContact(account: string, pubkey: string): void {
  write(
    account,
    read(account).filter((contact) => contact.pubkey !== pubkey),
  );
}

/** Persist a loaded profile name/picture without refreshing activity time. */
export function updateContactProfile(
  account: string,
  pubkey: string,
  fields: { name?: string; picture?: string },
): void {
  const contacts = read(account);
  const index = contacts.findIndex((contact) => contact.pubkey === pubkey);
  if (index < 0) return;
  const current = contacts[index];
  const name = fields.name ?? current.name;
  const picture = fields.picture ?? current.picture;
  if (name === current.name && picture === current.picture) return;
  const next = contacts.slice();
  next[index] = { ...current, name, picture };
  write(account, next);
}

/** Drop unsaved recent people older than the retention window. */
export function pruneRecentContacts(
  account: string,
  maxAgeMs = RECENT_TTL_MS,
): number {
  const now = Date.now();
  const contacts = read(account);
  const next = contacts.filter(
    (contact) => contact.saved || now - contact.lastSeen < maxAgeMs,
  );
  if (next.length !== contacts.length) write(account, next);
  const dismissed = readDismissed(account);
  const liveDismissals = dismissed.filter((entry) => entry.until > now);
  if (liveDismissals.length !== dismissed.length)
    writeDismissed(account, liveDismissals);
  return contacts.length - next.length;
}

/** Subscribe to contact-book changes for an account. */
export function subscribeContacts(
  account: string,
  listener: () => void,
): () => void {
  const set = listeners.get(account) ?? new Set();
  set.add(listener);
  listeners.set(account, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(account);
  };
}

/** Reactive contact list for an account. */
export function useContacts(account: string | undefined): Contact[] {
  return useSyncExternalStore(
    (listener) => (account ? subscribeContacts(account, listener) : () => {}),
    () => (account ? listContacts(account) : EMPTY),
  );
}
