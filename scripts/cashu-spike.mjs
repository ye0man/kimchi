import {
  PaymentRequest,
  Wallet,
  decodePaymentRequest,
  getPubKeyFromPrivKey,
} from "@cashu/cashu-ts";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";

const MINT = process.env.MINT ?? "https://mint.minibits.cash/Bitcoin";
const AMOUNT = 21;

const wallet = new Wallet(MINT);
await wallet.loadMint();
const info = wallet.getMintInfo();
console.log("mint:", info.name);
console.log("NUT-11 P2PK:", info.isSupported(11).supported);
console.log("NUT-07 state:", info.isSupported(7).supported);
console.log("NUT-14 HTLC:", info.isSupported(14).supported);

const sk = bytesToHex(randomBytes(32));
const pk = bytesToHex(getPubKeyFromPrivKey(hexToBytes(sk)));
console.log("tab pubkey:", pk);

const request = new PaymentRequest(
  undefined,
  "kimchi-spike-1",
  AMOUNT,
  "sat",
  [MINT],
  "Kimchi spike",
  false,
  { kind: "P2PK", data: pk },
  false,
);
const creq = request.toEncodedCreqA();
console.log("creq length:", creq.length);
console.log("creq prefix:", creq.slice(0, 24));

const decoded = decodePaymentRequest(creq);
console.log("decoded id:", decoded.id);
console.log("decoded amount:", decoded.amount?.toString());
console.log("decoded unit:", decoded.unit);
console.log("decoded mints:", decoded.mints);
console.log("decoded lock:", decoded.nut10?.kind, decoded.nut10?.data?.slice(0, 16));
console.log("includes mint:", decoded.includesMint(MINT));
console.log("amount to send:", decoded.amountToSend(MINT, ["bolt11"]).toString());

const quote = await wallet.createMintQuoteBolt11(AMOUNT);
console.log("quote id:", quote.quote);
console.log("quote state:", quote.state);
console.log("invoice prefix:", quote.request.slice(0, 40));
