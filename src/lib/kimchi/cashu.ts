import {
  LockBuilder,
  PaymentRequest,
  Wallet,
  decodePaymentRequest,
  getEncodedToken,
  getPubKeyFromPrivKey,
} from "@cashu/cashu-ts";
import type { Proof } from "@cashu/cashu-ts";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";

export const MINIBITS_MINT = "https://mint.minibits.cash/Bitcoin";

const PROOFS_PREFIX = "kimchi:proofs:";
const SECRETS_PREFIX = "kimchi:secrets:";
const REDEEMED_PREFIX = "kimchi:redeemed:";

export interface Quote {
  id: string;
  invoice: string;
  state: string;
}

export interface PayResult {
  keep: Proof[];
  payload: string;
}

export interface RedeemResult {
  received: Proof[];
  total: number;
}

export function loadProofs(mintUrl: string): Proof[] {
  try {
    const raw = localStorage.getItem(`${PROOFS_PREFIX}${mintUrl}`);
    if (!raw) return [];
    return JSON.parse(raw) as Proof[];
  } catch {
    return [];
  }
}

export function saveProofs(mintUrl: string, proofs: Proof[]): void {
  try {
    localStorage.setItem(`${PROOFS_PREFIX}${mintUrl}`, JSON.stringify(proofs));
  } catch {}
}

export function loadSecrets(tabId: string): Record<string, { privkey: string; pubkey: string }> {
  try {
    const raw = localStorage.getItem(`${SECRETS_PREFIX}${tabId}`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, { privkey: string; pubkey: string }>;
  } catch {
    return {};
  }
}

export function saveSecrets(
  tabId: string,
  secrets: Record<string, { privkey: string; pubkey: string }>,
): void {
  try {
    localStorage.setItem(`${SECRETS_PREFIX}${tabId}`, JSON.stringify(secrets));
  } catch {}
}

export function clearSecrets(tabId: string): void {
  try {
    localStorage.removeItem(`${SECRETS_PREFIX}${tabId}`);
  } catch {}
}

export function markRedeemed(tabId: string, shareId: string): void {
  try {
    localStorage.setItem(`${REDEEMED_PREFIX}${tabId}:${shareId}`, "1");
  } catch {}
}

export function isRedeemed(tabId: string, shareId: string): boolean {
  try {
    return localStorage.getItem(`${REDEEMED_PREFIX}${tabId}:${shareId}`) === "1";
  } catch {
    return false;
  }
}

function amountNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (
    value &&
    typeof (value as { toNumber?: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

export function getBalance(proofs: Proof[]): number {
  return proofs.reduce((total, proof) => total + amountNumber(proof.amount), 0);
}

export function generateKey(): { privkey: string; pubkey: string } {
  const privkey = bytesToHex(randomBytes(32));
  const pubkey = bytesToHex(getPubKeyFromPrivKey(hexToBytes(privkey)));
  return { privkey, pubkey };
}

export async function createWallet(mintUrl: string): Promise<Wallet> {
  const wallet = new Wallet(mintUrl);
  await wallet.loadMint();
  return wallet;
}

export function createRequest(args: {
  id: string;
  amount: number;
  mint: string;
  pubkey: string;
  description: string;
}): PaymentRequest {
  return new PaymentRequest(
    undefined,
    args.id,
    args.amount,
    "sat",
    [args.mint],
    args.description,
    false,
    { kind: "P2PK", data: args.pubkey },
    false,
  );
}

export async function payRequest(
  wallet: Wallet,
  mintUrl: string,
  creq: string,
  proofs: Proof[],
  memo: string,
): Promise<PayResult> {
  const request = decodePaymentRequest(creq);
  try {
    const { keep, send } = await wallet.ops
      .sendToRequest(request, proofs)
      .includeFees(true)
      .run();
    return {
      keep,
      payload: request.encodePayload(mintUrl, send, { memo }),
    };
  } catch (error) {
    const lock = request.toP2PKOptions();
    if (!lock) throw error;
    const amount = request.amount?.toNumber();
    if (!amount) throw error;
    const { keep, send } = await wallet.ops
      .send(amount, proofs)
      .asLocked(new LockBuilder().addMainPubkey(lock.pubkey))
      .includeFees(true)
      .run();
    return {
      keep,
      payload: request.encodePayload(mintUrl, send, { memo }),
    };
  }
}

export async function redeemRequest(
  wallet: Wallet,
  creq: string,
  payload: string,
  expectedAmount: number,
  privkey: string,
): Promise<RedeemResult> {
  const request = decodePaymentRequest(creq);
  const parsed = PaymentRequest.decodePayload(payload);
  if (!request.includesMint(parsed.mint)) {
    throw new Error("payment came from the wrong mint");
  }

  try {
    wallet.isPaymentRequestSatisfied(request, parsed.proofs, expectedAmount, {
      privkeys: privkey,
    });
  } catch {
    // Older or differently encoded locks still get redeemed below; the amount
    // check after redemption is the hard gate.
  }

  const states = await wallet.checkProofsStates(parsed.proofs);
  if (states.some((state) => state.state === "SPENT")) {
    throw new Error("that payment was already redeemed");
  }
  if (states.some((state) => state.state === "PENDING")) {
    throw new Error("payment is still pending at the mint");
  }

  const token = getEncodedToken({ mint: parsed.mint, proofs: parsed.proofs });
  const received = await wallet.receive(token, { privkey });
  const total = getBalance(received);
  if (total < expectedAmount) {
    throw new Error(`underpaid: got ${total}, expected ${expectedAmount}`);
  }
  return { received, total };
}

export async function createQuote(wallet: Wallet, amount: number): Promise<Quote> {
  const quote = await wallet.createMintQuoteBolt11(amount);
  return { id: quote.quote, invoice: quote.request, state: String(quote.state) };
}

export async function claimQuote(
  wallet: Wallet,
  quoteId: string,
  amount: number,
): Promise<Proof[]> {
  const quote = await wallet.checkMintQuoteBolt11(quoteId);
  const state = String(quote.state);
  if (state !== "PAID" && state !== "ISSUED") {
    throw new Error(`invoice not paid yet (${state})`);
  }
  return wallet.mintProofsBolt11(amount, quote.quote);
}

export async function receiveToken(wallet: Wallet, token: string): Promise<Proof[]> {
  return wallet.receive(token);
}
