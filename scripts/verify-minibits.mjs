import {
  PaymentRequest,
  Wallet,
  decodePaymentRequest,
  getPubKeyFromPrivKey,
} from "@cashu/cashu-ts";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";

const mintUrl = process.env.MINT_URL || "https://mint.minibits.cash/Bitcoin";

const wallet = new Wallet(mintUrl);
await wallet.loadMint();
const info = wallet.getMintInfo();

console.log("mint:", mintUrl);
console.log("name:", info.name);
for (const nut of [3, 4, 5, 7, 10, 11, 18]) {
  try {
    const support = info.isSupported(nut);
    console.log(
      `NUT-${nut}: ${support?.supported ? "supported" : "not advertised"}`,
    );
  } catch {
    console.log(`NUT-${nut}: not a mint-info NUT in cashu-ts`);
  }
}

const privkey = bytesToHex(randomBytes(32));
const pubkey = bytesToHex(getPubKeyFromPrivKey(hexToBytes(privkey)));
const request = new PaymentRequest(
  undefined,
  `verify-${Date.now()}`,
  21,
  "sat",
  [mintUrl],
  "Kimchi NUT-11/NUT-18 check",
  false,
  { kind: "P2PK", data: pubkey },
  false,
);
const creq = request.toEncodedCreqA();
const decoded = decodePaymentRequest(creq);
console.log("request prefix:", creq.slice(0, 5));
console.log("request decodes:", Boolean(decoded));
console.log("NUT-10 lock kind:", decoded.nut10?.kind);
console.log("NUT-10 lock pubkey matches:", decoded.nut10?.data === pubkey);
console.log("request mint:", decoded.mints?.join(","));
console.log(
  "NUT-18 payload helpers:",
  typeof request.encodePayload === "function" &&
    typeof PaymentRequest.decodePayload === "function",
);
