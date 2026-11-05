import { useEffect, useMemo, useState } from "react";
import { use$ } from "applesauce-react/hooks";
import type { Proof, Wallet } from "@cashu/cashu-ts";

import { useGroupStore } from "@/hooks/use-marmot";
import {
  claimQuote,
  createQuote,
  createWallet,
  getBalance,
  loadProofs,
  payRequest,
  receiveToken,
  redeemRequest,
  saveProofs,
  type Quote,
} from "./cashu";
import { parseKimchiRumor } from "./rumors";
import {
  KIMCHI_KIND,
  type KimchiClosingMsg,
  type KimchiPaidMsg,
  type KimchiParsed,
  type KimchiPaymentMsg,
  type KimchiTab,
  type KimchiTabMsg,
} from "./types";

export function useKimchiMessages(groupId: string | undefined): KimchiParsed[] {
  const store = useGroupStore(groupId);
  const timeline = use$(
    () =>
      store ? store.timeline({ kinds: [KIMCHI_KIND] }) : undefined,
    [store],
  );
  return useMemo(() => {
    if (!timeline) return [];
    return [...timeline]
      .map(parseKimchiRumor)
      .filter((entry): entry is KimchiParsed => entry !== null)
      .sort((a, b) => a.created_at - b.created_at);
  }, [timeline]);
}

export interface KimchiState {
  tab: KimchiTab | null;
  tabMsg: KimchiTabMsg | null;
  paid: Map<string, KimchiPaidMsg>;
  pending: KimchiPaymentMsg[];
  closing: KimchiClosingMsg | null;
}

export function useKimchiState(messages: KimchiParsed[]): KimchiState {
  return useMemo(() => {
    const tabMsg =
      [...messages]
        .reverse()
        .find((entry) => entry.msg.type === "kimchi.tab") ?? null;
    const paid = new Map<string, KimchiPaidMsg>();
    for (const entry of messages) {
      if (entry.msg.type !== "kimchi.paid") continue;
      paid.set(entry.msg.share_id, entry.msg);
    }
    const pending: KimchiPaymentMsg[] = [];
    const seen = new Set<string>();
    for (const entry of [...messages].reverse()) {
      if (entry.msg.type !== "kimchi.payment") continue;
      if (paid.has(entry.msg.share_id)) continue;
      if (seen.has(entry.msg.share_id)) continue;
      seen.add(entry.msg.share_id);
      pending.push(entry.msg);
    }
    const closing =
      [...messages]
        .reverse()
        .find((entry) => entry.msg.type === "kimchi.closing") ?? null;
    return {
      tab: tabMsg?.msg.type === "kimchi.tab" ? tabMsg.msg.tab : null,
      tabMsg: tabMsg?.msg.type === "kimchi.tab" ? tabMsg.msg : null,
      paid,
      pending,
      closing: closing?.msg.type === "kimchi.closing" ? closing.msg : null,
    };
  }, [messages]);
}

export interface KimchiWallet {
  wallet: Wallet | null;
  proofs: Proof[];
  balance: number;
  busy: boolean;
  error: string | null;
  log: string[];
  pay: (creq: string, amount: number, memo: string) => Promise<string>;
  redeem: (
    creq: string,
    payload: string,
    amount: number,
    privkey: string,
  ) => Promise<number>;
  fund: (amount: number) => Promise<Quote>;
  claim: (quoteId: string, amount: number) => Promise<void>;
  paste: (token: string) => Promise<void>;
}

export function useKimchiWallet(mintUrl: string): KimchiWallet {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [proofs, setProofs] = useState<Proof[]>(() => loadProofs(mintUrl));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    setWallet(null);
    setProofs(loadProofs(mintUrl));
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
  }, [mintUrl]);

  useEffect(() => {
    saveProofs(mintUrl, proofs);
  }, [mintUrl, proofs]);

  function addLog(line: string) {
    setLog((previous) => [line, ...previous].slice(0, 12));
  }

  async function pay(creq: string, amount: number, memo: string): Promise<string> {
    if (!wallet) throw new Error("wallet is still loading");
    setBusy(true);
    setError(null);
    try {
      const result = await payRequest(wallet, mintUrl, creq, proofs, memo);
      setProofs(result.keep);
      addLog(`paid ${amount} sats → request ${creq.slice(0, 12)}…`);
      return result.payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function redeem(
    creq: string,
    payload: string,
    amount: number,
    privkey: string,
  ): Promise<number> {
    if (!wallet) throw new Error("wallet is still loading");
    setBusy(true);
    setError(null);
    try {
      const result = await redeemRequest(wallet, creq, payload, amount, privkey);
      setProofs((previous) => [...previous, ...result.received]);
      addLog(`redeemed ${result.total} sats`);
      return result.total;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function fund(amount: number): Promise<Quote> {
    if (!wallet) throw new Error("wallet is still loading");
    setBusy(true);
    setError(null);
    try {
      const quote = await createQuote(wallet, amount);
      addLog(`invoice for ${amount} sats created`);
      return quote;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function claim(quoteId: string, amount: number): Promise<void> {
    if (!wallet) throw new Error("wallet is still loading");
    setBusy(true);
    setError(null);
    try {
      const minted = await claimQuote(wallet, quoteId, amount);
      setProofs((previous) => [...previous, ...minted]);
      addLog(`claimed ${getBalance(minted)} sats`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function paste(token: string): Promise<void> {
    if (!wallet) throw new Error("wallet is still loading");
    setBusy(true);
    setError(null);
    try {
      const received = await receiveToken(wallet, token.trim());
      setProofs((previous) => [...previous, ...received]);
      addLog(`received ${getBalance(received)} sats`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return {
    wallet,
    proofs,
    balance: getBalance(proofs),
    busy,
    error,
    log,
    pay,
    redeem,
    fund,
    claim,
    paste,
  };
}
