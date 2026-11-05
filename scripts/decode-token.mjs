import { Wallet, getDecodedToken } from "@cashu/cashu-ts";

const token = process.env.KIMCHI_TOKEN ?? "";
if (!token) throw new Error("set KIMCHI_TOKEN");

const wallet = new Wallet("https://mint.minibits.cash/Bitcoin");
await wallet.loadMint();
const { keysets } = await wallet.mint.getKeySets();
const decoded = getDecodedToken(
  token,
  keysets.map((keyset) => keyset.id),
);
const total = decoded.proofs.reduce(
  (sum, proof) => sum + proof.amount.toNumber(),
  0,
);
console.log(
  JSON.stringify(
    {
      mint: decoded.mint,
      unit: decoded.unit,
      proofs: decoded.proofs.length,
      total,
    },
    null,
    2,
  ),
);
