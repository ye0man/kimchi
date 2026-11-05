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
}

export interface ContactDraft {
  pubkey: string;
  name?: string;
  picture?: string;
  relays?: string[];
  groupId?: string;
  keyPackage?: unknown;
}

const PREFIX = "kimchi:contacts:v1:";
const cache = new Map<string, Contact[]>();
const sorted = new Map<string, Contact[]>();
const listeners = new Map<string, Set<() => void>>();

function key(account: string): string {
  return `${PREFIX}${account}`;
}

function read(account: string): Contact[] {
  const cached = cache.get(account);
  if (cached) return cached;
  let contacts: Contact[] = [];
  try {
    const raw = localStorage.getItem(key(account));
    if (raw) contacts = JSON.parse(raw) as Contact[];
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
    });
  }
  write(account, [...current.values()]);
}

/** Remember every member of a group so re-invites take one tap. */
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

/** Remove a contact from this device. */
export function removeContact(account: string, pubkey: string): void {
  write(
    account,
    read(account).filter((contact) => contact.pubkey !== pubkey),
  );
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

const EMPTY: Contact[] = [];
