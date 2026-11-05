import { useCallback, useEffect, useState } from "react";
import { getEncodedToken, type Proof, type Wallet } from "@cashu/cashu-ts";

import {
  claimQuote,
  createQuote,
  createWallet,
  getBalance,
  payRequest,
  receiveToken,
  redeemRequest,
  type Quote,
} from "@/lib/kimchi/cashu";
import {
  appendHistory,
  loadHistory,
  loadProofs,
  saveProofs,
  type WalletTx,
} from "./storage";

export interface AccountWallet {
  wallet: Wallet | null;
  proofs: Proof[];
  balance: number;
  busy: boolean;
  error: string | null;
  quote: Quote | null;
  history: WalletTx[];
  pay: (creq: string, amount: number, memo: string) => Promise<string>;
  redeem: (
    creq: string,
    payload: string,
    amount: number,
    privkey: string,
  ) => Promise<number>;
  fund: (amount: number) => Promise<void>;
  claim: (amount: number) => Promise<void>;
  receive: (token: string) => Promise<void>;
  send: (amount: number) => Promise<string>;
  clearQuote: () => void;
  clearError: () => void;
}

/** Account-scoped Cashu wallet for one mint. */
export function useAccountWallet(
  account: string | undefined,
  mintUrl: string,
): AccountWallet {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [history, setHistory] = useState<WalletTx[]>([]);

  useEffect(() => {
    if (!account) return;
    let alive = true;
    setWallet(null);
    setProofs(loadProofs(account, mintUrl));
    setHistory(loadHistory(account));
    setError(null);
    createWallet(mintUrl)
      .then((next) => {
        if (alive) setWallet(next);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [account, mintUrl]);

  useEffect(() => {
    if (!account) return;
    saveProofs(account, mintUrl, proofs);
  }, [account, mintUrl, proofs]);

  const fail = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  }, []);

  const refreshHistory = useCallback(() => {
    if (account) setHistory(loadHistory(account));
  }, [account]);

  const run = useCallback(
    async <T>(task: () => Promise<T>): Promise<T> => {
      setBusy(true);
      setError(null);
      try {
        return await task();
      } catch (err) {
        fail(err);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  const pay = (creq: string, amount: number, memo: string) =>
    run(async () => {
      if (!wallet) throw new Error("wallet is still loading");
      const result = await payRequest(wallet, mintUrl, creq, proofs, memo);
      setProofs(result.keep);
      if (account)
        appendHistory(account, {
          kind: "pay",
          amount,
          mint: mintUrl,
          note: memo,
        });
      refreshHistory();
      return result.payload;
    });

  const redeem = (
    creq: string,
    payload: string,
    amount: number,
    privkey: string,
  ) =>
    run(async () => {
      if (!wallet) throw new Error("wallet is still loading");
      const result = await redeemRequest(
        wallet,
        creq,
        payload,
        amount,
        privkey,
      );
      setProofs((previous) => [...previous, ...result.received]);
      if (account)
        appendHistory(account, {
          kind: "redeem",
          amount: result.total,
          mint: mintUrl,
        });
      refreshHistory();
      return result.total;
    });

  const fund = (amount: number) =>
    run(async () => {
      if (!wallet) throw new Error("wallet is still loading");
      setQuote(await createQuote(wallet, amount));
    });

  const claim = (amount: number) =>
    run(async () => {
      if (!wallet || !quote) throw new Error("create an invoice first");
      const minted = await claimQuote(wallet, quote.id, amount);
      setProofs((previous) => [...previous, ...minted]);
      setQuote(null);
      if (account)
        appendHistory(account, {
          kind: "mint",
          amount: getBalance(minted),
          mint: mintUrl,
        });
      refreshHistory();
    });

  const receive = (token: string) =>
    run(async () => {
      if (!wallet) throw new Error("wallet is still loading");
      const received = await receiveToken(wallet, token.trim());
      setProofs((previous) => [...previous, ...received]);
      if (account)
        appendHistory(account, {
          kind: "receive",
          amount: getBalance(received),
          mint: mintUrl,
        });
      refreshHistory();
    });

  const send = (amount: number) =>
    run(async () => {
      if (!wallet) throw new Error("wallet is still loading");
      const { keep, send: outgoing } = await wallet.ops
        .send(amount, proofs)
        .includeFees(true)
        .run();
      const token = getEncodedToken({ mint: mintUrl, proofs: outgoing });
      setProofs(keep);
      if (account)
        appendHistory(account, { kind: "send", amount, mint: mintUrl });
      refreshHistory();
      return token;
    });

  return {
    wallet,
    proofs,
    balance: getBalance(proofs),
    busy,
    error,
    quote,
    history,
    pay,
    redeem,
    fund,
    claim,
    receive,
    send,
    clearQuote: () => setQuote(null),
    clearError: () => setError(null),
  };
}
