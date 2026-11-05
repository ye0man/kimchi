import type { NostrEvent } from "applesauce-core/helpers/event";

/** A host-signed capability encoded in a join link. */
export interface JoinLink {
  v: 1;
  g: string;
  h: string;
  r: string[];
  n: string;
  e: number;
  t?: string;
}

/** A guest's shareable identity card: npub plus a published key package. */
export interface InviteCard {
  v: 1;
  p: string;
  k: NostrEvent;
  r?: string[];
}

export interface InviteToken {
  v: 1;
  nonce: string;
  groupId: string;
  host: string;
  createdAt: number;
  expiresAt: number;
  maxUses: number;
  uses: number;
}

export interface PendingJoin {
  groupId: string;
  host: string;
  at: number;
}

const TOKENS_PREFIX = "kimchi:invite-tokens:v1:";
const PENDING_PREFIX = "kimchi:pending-joins:v1:";
const PENDING_LINK = "kimchi:pending-link";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encode a JSON value as URL-safe base64. */
export function encodePayload(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** Decode URL-safe base64 JSON, returning null on malformed input. */
export function decodePayload<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as T;
  } catch {
    return null;
  }
}

/** Absolute URL for an app route, respecting the deployment base path. */
export function appUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(
    path.replace(/^\//, ""),
    `${window.location.origin}${base}`,
  ).toString();
}

/** Build a link a host can share so guests can request to join. */
export function buildJoinLink(args: {
  groupId: string;
  host: string;
  relays: string[];
  nonce: string;
  expiresAt: number;
  title?: string;
}): string {
  const payload: JoinLink = {
    v: 1,
    g: args.groupId,
    h: args.host,
    r: args.relays,
    n: args.nonce,
    e: args.expiresAt,
    t: args.title,
  };
  return appUrl(`join/${encodePayload(payload)}`);
}

/** Parse a join link or its bare code from a URL, QR, or clipboard. */
export function parseJoinLink(input: string): JoinLink | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/join\/([A-Za-z0-9_-]+)/);
  const payload = decodePayload<JoinLink>(match ? match[1] : trimmed);
  if (!payload || payload.v !== 1) return null;
  if (!payload.g || !payload.h || !payload.n || !payload.e) return null;
  return payload;
}

/** Build a shareable guest card carrying npub + a published key package. */
export function buildInviteCard(args: {
  pubkey: string;
  keyPackage: NostrEvent;
  relays?: string[];
}): string {
  const payload: InviteCard = {
    v: 1,
    p: args.pubkey,
    k: args.keyPackage,
    r: args.relays,
  };
  return appUrl(`add/${encodePayload(payload)}`);
}

/** Parse an invite card or its bare code. */
export function parseInviteCard(input: string): InviteCard | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/add\/([A-Za-z0-9_-]+)/);
  const payload = decodePayload<InviteCard>(match ? match[1] : trimmed);
  if (!payload || payload.v !== 1) return null;
  if (!payload.p || !payload.k || payload.k.kind !== 30443) return null;
  return payload;
}

function readTokens(host: string): InviteToken[] {
  try {
    const raw = localStorage.getItem(`${TOKENS_PREFIX}${host}`);
    return raw ? (JSON.parse(raw) as InviteToken[]) : [];
  } catch {
    return [];
  }
}

function writeTokens(host: string, tokens: InviteToken[]): void {
  try {
    localStorage.setItem(`${TOKENS_PREFIX}${host}`, JSON.stringify(tokens));
  } catch {}
}

/** Mint a capability token for a group join link. */
export function createInviteToken(
  host: string,
  groupId: string,
  options: { hours?: number; maxUses?: number } = {},
): InviteToken {
  const now = Date.now();
  const token: InviteToken = {
    v: 1,
    nonce: crypto.randomUUID().replace(/-/g, ""),
    groupId,
    host,
    createdAt: now,
    expiresAt: now + (options.hours ?? 24) * 3_600_000,
    maxUses: options.maxUses ?? 50,
    uses: 0,
  };
  writeTokens(host, [...readTokens(host), token]);
  return token;
}

/** List live tokens for one group, pruning expired entries. */
export function listInviteTokens(host: string, groupId: string): InviteToken[] {
  const now = Date.now();
  const live = readTokens(host).filter(
    (token) => token.expiresAt > now && token.uses < token.maxUses,
  );
  writeTokens(host, live);
  return live.filter((token) => token.groupId === groupId);
}

/** Find a token without consuming a use. */
export function findInviteToken(
  host: string,
  nonce: string,
): InviteToken | null {
  return readTokens(host).find((token) => token.nonce === nonce) ?? null;
}

/** Validate and consume one use of a join token. */
export function consumeInviteToken(
  host: string,
  nonce: string,
  groupId: string,
): InviteToken | null {
  const tokens = readTokens(host);
  const index = tokens.findIndex((token) => token.nonce === nonce);
  if (index < 0) return null;
  const token = tokens[index];
  if (token.groupId !== groupId) return null;
  if (token.expiresAt <= Date.now()) return null;
  if (token.uses >= token.maxUses) return null;
  token.uses += 1;
  writeTokens(host, tokens);
  return token;
}

/** Revoke one join token. */
export function revokeInviteToken(host: string, nonce: string): void {
  writeTokens(
    host,
    readTokens(host).filter((token) => token.nonce !== nonce),
  );
}

/** Remember that this account is waiting on a Welcome for a group. */
export function addPendingJoin(pubkey: string, join: PendingJoin): void {
  try {
    const list = listPendingJoins(pubkey).filter(
      (entry) => entry.groupId !== join.groupId,
    );
    localStorage.setItem(
      `${PENDING_PREFIX}${pubkey}`,
      JSON.stringify([...list, join]),
    );
  } catch {}
}

/** Pending join requests for an account. */
export function listPendingJoins(pubkey: string): PendingJoin[] {
  try {
    const raw = localStorage.getItem(`${PENDING_PREFIX}${pubkey}`);
    return raw ? (JSON.parse(raw) as PendingJoin[]) : [];
  } catch {
    return [];
  }
}

/** Remove a completed join request. */
export function removePendingJoin(pubkey: string, groupId: string): void {
  try {
    localStorage.setItem(
      `${PENDING_PREFIX}${pubkey}`,
      JSON.stringify(
        listPendingJoins(pubkey).filter((entry) => entry.groupId !== groupId),
      ),
    );
  } catch {}
}

/** Keep a join link across the sign-in redirect. */
export function rememberPendingLink(link: string): void {
  try {
    sessionStorage.setItem(PENDING_LINK, link);
  } catch {}
}

/** Read and clear a join link saved before sign-in. */
export function takePendingLink(): string | null {
  try {
    const value = sessionStorage.getItem(PENDING_LINK);
    sessionStorage.removeItem(PENDING_LINK);
    return value;
  } catch {
    return null;
  }
}
