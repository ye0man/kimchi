import { useRef, useState } from "react";
import {
  CheckStateEnum,
  LockBuilder,
  PaymentRequest,
  Wallet,
  decodePaymentRequest,
  getEncodedToken,
  getPubKeyFromPrivKey,
} from "@cashu/cashu-ts";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Proof } from "@cashu/cashu-ts";

const DEFAULT_MINT = "https://mint.minibits.cash/Bitcoin";

export default function CashuHarness() {
  const payerRef = useRef<Wallet | null>(null);
  const payeeRef = useRef<Wallet | null>(null);

  const [mintUrl, setMintUrl] = useState(DEFAULT_MINT);
  const [mintName, setMintName] = useState("");
  const [mintNuts, setMintNuts] = useState("");
  const [status, setStatus] = useState("idle");

  const [amount, setAmount] = useState(100);
  const [privKey, setPrivKey] = useState("");
  const [pubKey, setPubKey] = useState("");
  const [creq, setCreq] = useState("");
  const [decoded, setDecoded] = useState("");

  const [payerProofs, setPayerProofs] = useState<Proof[]>([]);
  const [payeeProofs, setPayeeProofs] = useState<Proof[]>([]);
  const [invoice, setInvoice] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [payload, setPayload] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [proofStates, setProofStates] = useState("");
  const [log, setLog] = useState<string[]>([]);

  function addLog(line: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 40));
  }

  async function ensureWallets() {
    if (!payerRef.current) {
      payerRef.current = new Wallet(mintUrl);
      await payerRef.current.loadMint();
    }
    if (!payeeRef.current) {
      payeeRef.current = new Wallet(mintUrl);
      await payeeRef.current.loadMint();
    }
    return { payer: payerRef.current, payee: payeeRef.current };
  }

  async function loadMint() {
    try {
      setStatus("loading mint");
      payerRef.current = new Wallet(mintUrl);
      await payerRef.current.loadMint();
      payeeRef.current = new Wallet(mintUrl);
      await payeeRef.current.loadMint();
      const info = payerRef.current.getMintInfo();
      setMintName(info.name);
      setMintNuts(
        `P2PK=${info.isSupported(11).supported} NUT07=${info.isSupported(7).supported} NUT14=${info.isSupported(14).supported}`,
      );
      addLog(`mint loaded: ${info.name}`);
      setStatus("mint ready");
    } catch (error) {
      setStatus(`mint error: ${String(error)}`);
      addLog(`mint error: ${String(error)}`);
    }
  }

  function generateKey() {
    try {
      const sk = bytesToHex(randomBytes(32));
      const pk = bytesToHex(getPubKeyFromPrivKey(hexToBytes(sk)));
      setPrivKey(sk);
      setPubKey(pk);
      addLog(`P2PK key generated ${pk.slice(0, 12)}…`);
    } catch (error) {
      addLog(`key error: ${String(error)}`);
    }
  }

  function createRequest() {
    try {
      const request = new PaymentRequest(
        undefined,
        `kimchi-spike-${Date.now()}`,
        amount,
        "sat",
        [mintUrl],
        "Kimchi spike",
        false,
        { kind: "P2PK", data: pubKey },
        false,
      );
      const encoded = request.toEncodedCreqA();
      setCreq(encoded);
      const roundTrip = decodePaymentRequest(encoded);
      setDecoded(
        `id=${roundTrip.id} amount=${roundTrip.amount?.toString()} unit=${roundTrip.unit} mints=${roundTrip.mints?.join(",")} lock=${roundTrip.nut10?.kind}:${roundTrip.nut10?.data?.slice(0, 12)}…`,
      );
      addLog(`request encoded (${encoded.length} chars) and decoded`);
    } catch (error) {
      addLog(`request error: ${String(error)}`);
    }
  }

  async function createQuote() {
    try {
      const { payer } = await ensureWallets();
      const quote = await payer.createMintQuoteBolt11(amount);
      setQuoteId(quote.quote);
      setInvoice(quote.request);
      addLog(`mint quote ${quote.quote} created for ${amount} sats`);
      setStatus("invoice ready — pay it, then claim");
    } catch (error) {
      addLog(`quote error: ${String(error)}`);
    }
  }

  async function claimQuote() {
    try {
      const { payer } = await ensureWallets();
      const quote = await payer.checkMintQuoteBolt11(quoteId);
      addLog(`quote state ${String(quote.state)}`);
      if (String(quote.state) !== "PAID" && String(quote.state) !== "ISSUED") {
        setStatus(`quote not paid yet (${String(quote.state)})`);
        return;
      }
      const proofs = await payer.mintProofsBolt11(amount, quote.quote);
      setPayerProofs((prev) => [...prev, ...proofs]);
      addLog(`minted ${proofs.length} proofs, total ${proofs.reduce((n, p) => n + Number(p.amount), 0)} sats`);
      setStatus("payer funded");
    } catch (error) {
      addLog(`claim error: ${String(error)}`);
    }
  }

  async function payRequest() {
    try {
      const { payer } = await ensureWallets();
      const request = decodePaymentRequest(creq);
      const { keep, send } = await payer.ops
        .sendToRequest(request, payerProofs)
        .includeFees(true)
        .run();
      const encodedPayload = request.encodePayload(mintUrl, send, { memo: "kimchi spike" });
      setPayerProofs(keep);
      setPayload(encodedPayload);
      addLog(`paid request, payload ${encodedPayload.length} chars, send=${send.length} proofs`);
      setStatus("payload ready — redeem on the payee");
    } catch (error) {
      addLog(`pay error: ${String(error)}`);
    }
  }

  async function redeemPayload() {
    try {
      const { payee } = await ensureWallets();
      const request = decodePaymentRequest(creq);
      const parsed = PaymentRequest.decodePayload(payload);
      const mintOk = request.includesMint(parsed.mint);
      const satisfied = payee.isPaymentRequestSatisfied(request, parsed.proofs, amount, {
        privkeys: privKey,
      });
      const states = await payee.checkProofsStates(parsed.proofs);
      setProofStates(states.map((s) => `${s.state}:${s.Y.slice(0, 10)}…`).join("\n"));
      addLog(`payload mintOk=${mintOk} satisfied=${satisfied}`);
      if (!mintOk || !satisfied) {
        setStatus("payload rejected");
        return;
      }
      const token = getEncodedToken({ mint: parsed.mint, proofs: parsed.proofs });
      const received = await payee.receive(token, { privkey: privKey });
      setPayeeProofs((prev) => [...prev, ...received]);
      addLog(`redeemed ${received.length} proofs to payee`);
      setStatus("redeemed");
    } catch (error) {
      addLog(`redeem error: ${String(error)}`);
    }
  }

  async function manualPay() {
    try {
      const { payer } = await ensureWallets();
      const { keep, send } = await payer.ops
        .send(amount, payerProofs)
        .asLocked(new LockBuilder().addMainPubkey(pubKey))
        .includeFees(true)
        .run();
      const token = getEncodedToken({ mint: mintUrl, proofs: send });
      setPayerProofs(keep);
      setManualToken(token);
      addLog(`manual P2PK send: ${send.length} proofs, token ${token.length} chars`);
      setStatus("manual token ready");
    } catch (error) {
      addLog(`manual pay error: ${String(error)}`);
    }
  }

  async function manualRedeem() {
    try {
      const { payee } = await ensureWallets();
      const received = await payee.receive(manualToken, { privkey: privKey });
      setPayeeProofs((prev) => [...prev, ...received]);
      addLog(`manual redeem: ${received.length} proofs`);
      setStatus("manual redeemed");
    } catch (error) {
      addLog(`manual redeem error: ${String(error)}`);
    }
  }

  async function checkStates() {
    try {
      const { payee } = await ensureWallets();
      const states = await payee.checkProofsStates(payeeProofs);
      setProofStates(states.map((s) => `${s.state}:${s.Y.slice(0, 10)}…`).join("\n"));
      addLog(`payee proof states: ${states.map((s) => s.state).join(",")}`);
      if (states.every((s) => s.state === CheckStateEnum.UNSPENT)) {
        addLog("all payee proofs unspent");
      }
    } catch (error) {
      addLog(`state error: ${String(error)}`);
    }
  }

  const payerBalance = payerProofs.reduce((n, p) => n + Number(p.amount), 0);
  const payeeBalance = payeeProofs.reduce((n, p) => n + Number(p.amount), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold">Kimchi · Cashu spike</h1>
        <p className="text-sm text-muted-foreground">
          NUT-18 payment request with a NUT-11 P2PK lock against Minibits.
        </p>
      </div>

      <section className="space-y-3 border p-4">
        <h2 className="font-semibold">1. Mint</h2>
        <div className="flex gap-2">
          <Input value={mintUrl} onChange={(e) => setMintUrl(e.target.value)} />
          <Button onClick={loadMint}>Load</Button>
        </div>
        <p className="text-sm">
          {mintName} {mintNuts}
        </p>
        <p className="text-sm text-muted-foreground">status: {status}</p>
      </section>

      <section className="space-y-3 border p-4">
        <h2 className="font-semibold">2. Tab key + request</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="amount">sats</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-28"
          />
          <Button onClick={generateKey}>Generate P2PK key</Button>
          <Button onClick={createRequest} disabled={!pubKey}>
            Create request
          </Button>
        </div>
        <p className="break-all text-xs text-muted-foreground">pubkey: {pubKey}</p>
        <textarea
          className="h-20 w-full border p-2 text-xs"
          readOnly
          value={creq}
          placeholder="creqA…"
        />
        <p className="text-xs text-muted-foreground">{decoded}</p>
      </section>

      <section className="space-y-3 border p-4">
        <h2 className="font-semibold">3. Fund payer</h2>
        <div className="flex gap-2">
          <Button onClick={createQuote}>Create mint quote</Button>
          <Button onClick={claimQuote} disabled={!quoteId}>
            Claim paid quote
          </Button>
        </div>
        {invoice && (
          <textarea className="h-20 w-full border p-2 text-xs" readOnly value={invoice} />
        )}
        <p className="text-sm">payer balance: {payerBalance} sats</p>
      </section>

      <section className="space-y-3 border p-4">
        <h2 className="font-semibold">4. Pay the request</h2>
        <div className="flex gap-2">
          <Button onClick={payRequest} disabled={!creq || payerProofs.length === 0}>
            Pay with NUT-18
          </Button>
          <Button onClick={manualPay} disabled={!pubKey || payerProofs.length === 0}>
            Manual P2PK fallback
          </Button>
        </div>
        <textarea
          className="h-24 w-full border p-2 text-xs"
          readOnly
          value={payload}
          placeholder="NUT-18 payload"
        />
        <textarea
          className="h-24 w-full border p-2 text-xs"
          readOnly
          value={manualToken}
          placeholder="manual cashu token"
        />
      </section>

      <section className="space-y-3 border p-4">
        <h2 className="font-semibold">5. Host redeems</h2>
        <div className="flex gap-2">
          <Button onClick={redeemPayload} disabled={!payload || !privKey}>
            Verify + redeem payload
          </Button>
          <Button onClick={manualRedeem} disabled={!manualToken || !privKey}>
            Redeem manual token
          </Button>
          <Button onClick={checkStates} disabled={payeeProofs.length === 0}>
            Check states
          </Button>
        </div>
        <p className="text-sm">payee balance: {payeeBalance} sats</p>
        <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{proofStates}</pre>
      </section>

      <section className="space-y-2 border p-4">
        <h2 className="font-semibold">Log</h2>
        <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {log.join("\n")}
        </pre>
      </section>
    </div>
  );
}
