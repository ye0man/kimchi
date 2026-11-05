import { Wallet } from "@cashu/cashu-ts";

const MINT = "https://mint.minibits.cash/Bitcoin";
const AMOUNT = 21;

const wallet = new Wallet(MINT);
await wallet.loadMint();
const quote = await wallet.createMintQuoteBolt11(AMOUNT);

console.log(
  JSON.stringify(
    {
      mint: MINT,
      amount: AMOUNT,
      quote: quote.quote,
      state: quote.state,
      expiry: quote.expiry,
      invoice: quote.request,
    },
    null,
    2,
  ),
);
