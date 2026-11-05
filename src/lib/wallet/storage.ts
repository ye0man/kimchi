import type { Proof } from "@cashu/cashu-ts";

const ROOT = "kimchi:wallet:v1";

export type WalletTxKind = "mint" | "receive" | "send" | "pay" | "redeem";

export interface WalletTx {
  id: string;
  kind: WalletTxKind;
  amount: number;
  mint: string;
  at: number;
  note?: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Load proofs for one account and mint, migrating legacy single-mint keys. */
export function loadProofs(account: string, mint: string): Proof[] {
  const scoped = `${ROOT}:${account}:proofs:${mint}`;
  try {
    if (localStorage.getItem(scoped)) return read<Proof[]>(scoped, []);
    const legacy = localStorage.getItem(`kimchi:proofs:${mint}`);
    if (legacy) {
      const proofs = JSON.parse(legacy) as Proof[];
      write(scoped, proofs);
      return proofs;
    }
  } catch {}
  return read<Proof[]>(scoped, []);
}

/** Persist proofs for one account and mint. */
export function saveProofs(
  account: string,
  mint: string,
  proofs: Proof[],
): void {
  write(`${ROOT}:${account}:proofs:${mint}`, proofs);
}

/** Transaction history for one account, newest first. */
export function loadHistory(account: string): WalletTx[] {
  return read<WalletTx[]>(`${ROOT}:${account}:history`, []).sort(
    (a, b) => b.at - a.at,
  );
}

/** Append one transaction to the account history. */
export function appendHistory(
  account: string,
  tx: Omit<WalletTx, "id" | "at">,
): void {
  const list = loadHistory(account);
  const entry: WalletTx = {
    ...tx,
    id: crypto.randomUUID(),
    at: Date.now(),
  };
  write(`${ROOT}:${account}:history`, [entry, ...list].slice(0, 200));
}

/** Remember the selected mint for an account. */
export function loadMint(account: string, fallback: string): string {
  return read<string>(`${ROOT}:${account}:mint`, fallback) || fallback;
}

/** Persist the selected mint for an account. */
export function saveMint(account: string, mint: string): void {
  write(`${ROOT}:${account}:mint`, mint);
}
