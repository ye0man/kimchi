import {
  LockBuilder,
  PaymentRequest,
  Wallet,
  decodePaymentRequest,
  getEncodedToken,
  getPubKeyFromPrivKey,
} from "@cashu/cashu-ts";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";

const MINT = "https://mint.minibits.cash/Bitcoin";
const AMOUNT = 21;
const quoteId = process.argv[2];
const token = process.argv[3];

if (!quoteId && !token) {
  console.error("usage: node scripts/cashu-roundtrip.mjs <quoteId> [token]");
  process.exit(1);
}

const payer = new Wallet(MINT);
await payer.loadMint();
const payee = new Wallet(MINT);
await payee.loadMint();

let payerProofs = [];

if (quoteId && quoteId !== "-") {
  const quote = await payer.checkMintQuoteBolt11(quoteId);
  console.log("quote state:", quote.state);
  if (String(quote.state) !== "PAID" && String(quote.state) !== "ISSUED") {
    console.log("quote is not paid yet; pay the invoice and rerun");
    process.exit(2);
  }
  payerProofs = await payer.mintProofsBolt11(AMOUNT, quote.quote);
  console.log("minted payer proofs:", payerProofs.length);
}

if (token) {
  const received = await payer.receive(token);
  payerProofs = [...payerProofs, ...received];
  console.log("received token proofs:", received.length);
}

const payerBalance = payerProofs.reduce((n, p) => n + Number(p.amount), 0);
console.log("payer balance:", payerBalance);
if (payerBalance < AMOUNT) {
  console.error("payer balance too low");
  process.exit(3);
}

const sk = bytesToHex(randomBytes(32));
const pk = bytesToHex(getPubKeyFromPrivKey(hexToBytes(sk)));
console.log("tab pubkey:", pk);

const request = new PaymentRequest(
  undefined,
  `kimchi-roundtrip-${Date.now()}`,
  AMOUNT,
  "sat",
  [MINT],
  "Kimchi roundtrip",
  false,
  { kind: "P2PK", data: pk },
  false,
);
const creq = request.toEncodedCreqA();
const decoded = decodePaymentRequest(creq);
console.log("creq:", creq);
console.log("decoded amount:", decoded.amount?.toString(), "lock:", decoded.nut10?.kind);

let payload = "";
let manualToken = "";

try {
  const { keep, send } = await payer.ops
    .sendToRequest(decoded, payerProofs)
    .includeFees(true)
    .run();
  payerProofs = keep;
  payload = decoded.encodePayload(MINT, send, { memo: "kimchi spike" });
  console.log("sendToRequest OK, send proofs:", send.length, "payload:", payload.length);
} catch (error) {
  console.log("sendToRequest FAILED:", String(error));
  console.log("falling back to manual asLocked");
  const { keep, send } = await payer.ops
    .send(AMOUNT, payerProofs)
    .asLocked(new LockBuilder().addMainPubkey(pk))
    .includeFees(true)
    .run();
  payerProofs = keep;
  manualToken = getEncodedToken({ mint: MINT, proofs: send });
  console.log("manual token OK, send proofs:", send.length);
}

if (payload) {
  const parsed = PaymentRequest.decodePayload(payload);
  const mintOk = decoded.includesMint(parsed.mint);
  const satisfied = payee.isPaymentRequestSatisfied(decoded, parsed.proofs, AMOUNT, {
    privkeys: sk,
  });
  const states = await payee.checkProofsStates(parsed.proofs);
  console.log("mintOk:", mintOk, "satisfied:", satisfied, "states:", states.map((s) => s.state).join(","));
  if (!mintOk || !satisfied) process.exit(4);
  const received = await payee.receive(
    getEncodedToken({ mint: parsed.mint, proofs: parsed.proofs }),
    { privkey: sk },
  );
  const balance = received.reduce((n, p) => n + Number(p.amount), 0);
  console.log("payee redeemed:", received.length, "proofs, balance:", balance);
  const after = await payee.checkProofsStates(received);
  console.log("payee states:", after.map((s) => s.state).join(","));
}

if (manualToken) {
  const received = await payee.receive(manualToken, { privkey: sk });
  const balance = received.reduce((n, p) => n + Number(p.amount), 0);
  console.log("manual payee redeemed:", received.length, "proofs, balance:", balance);
}

console.log("OK");
