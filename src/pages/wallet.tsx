import { useEffect, useState } from "react";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBolt,
  IconCopy,
  IconRefresh,
  IconWallet,
} from "@tabler/icons-react";

import { JarMascot } from "@/components/kimchi/jar-mascot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMarmotAccount } from "@/hooks/use-marmot";
import { MINIBITS_MINT } from "@/lib/kimchi/cashu";
import { formatSats } from "@/lib/kimchi/rate";
import { useAccountWallet } from "@/lib/wallet/use-wallet";
import { loadMint, saveMint, type WalletTx } from "@/lib/wallet/storage";

type Panel = "add" | "receive" | "send" | null;

function txLabel(kind: WalletTx["kind"]): string {
  switch (kind) {
    case "mint":
      return "Added sats";
    case "receive":
      return "Received";
    case "send":
      return "Sent";
    case "pay":
      return "Paid a tab";
    case "redeem":
      return "Redeemed a tab";
  }
}

/** First-class Kimchi wallet: mint, top up, send, receive, history. */
export function WalletPage() {
  const account = useMarmotAccount();
  const [mint, setMint] = useState(() =>
    account ? loadMint(account.pubkey, MINIBITS_MINT) : MINIBITS_MINT,
  );
  const [mintDraft, setMintDraft] = useState(mint);
  const wallet = useAccountWallet(account?.pubkey, mint);
  const [panel, setPanel] = useState<Panel>(null);
  const [amount, setAmount] = useState(5_000);
  const [token, setToken] = useState("");
  const [outgoing, setOutgoing] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (account) saveMint(account.pubkey, mint);
  }, [account, mint]);

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b bg-card/70 px-4 py-3">
        <JarMascot />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black">Wallet</h1>
          <p className="text-[11px] font-bold text-muted-foreground">
            Cashu ecash, straight from Kimchi.
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          title="Refresh"
          onClick={() => setMint((value) => value)}
        >
          <IconRefresh className="size-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <section className="kimchi-surface p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-black tracking-[0.16em] text-muted-foreground uppercase">
              <IconWallet size={13} /> Balance
            </div>
            <div className="mt-1 text-4xl font-black tracking-tight text-primary">
              {formatSats(wallet.balance)}
              <span className="ml-1 text-sm font-extrabold text-muted-foreground">
                sats
              </span>
            </div>
            <div className="mt-1 truncate text-[10px] font-bold text-muted-foreground">
              {mint.replace(/^https?:\/\//, "")}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button
                className="rounded-full"
                variant={panel === "add" ? "default" : "outline"}
                onClick={() => setPanel(panel === "add" ? null : "add")}
              >
                <IconBolt className="size-4" /> Add
              </Button>
              <Button
                className="rounded-full"
                variant={panel === "receive" ? "default" : "outline"}
                onClick={() => setPanel(panel === "receive" ? null : "receive")}
              >
                <IconArrowDownLeft className="size-4" /> Receive
              </Button>
              <Button
                className="rounded-full"
                variant={panel === "send" ? "default" : "outline"}
                onClick={() => setPanel(panel === "send" ? null : "send")}
              >
                <IconArrowUpRight className="size-4" /> Send
              </Button>
            </div>
          </section>

          {panel === "add" && (
            <section className="kimchi-surface space-y-3 p-4">
              <h2 className="text-sm font-black">Add sats</h2>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
                <Button
                  className="rounded-full"
                  disabled={wallet.busy || !wallet.wallet}
                  onClick={() => void wallet.fund(amount)}
                >
                  Invoice
                </Button>
              </div>
              {wallet.quote && (
                <>
                  <Textarea
                    readOnly
                    value={wallet.quote.invoice}
                    className="h-24 font-mono text-[10px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        void copy(wallet.quote!.invoice, "invoice")
                      }
                    >
                      <IconCopy className="size-4" />
                      {copied === "invoice" ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      className="rounded-full"
                      disabled={wallet.busy}
                      onClick={() => void wallet.claim(amount)}
                    >
                      I paid — claim
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}

          {panel === "receive" && (
            <section className="kimchi-surface space-y-3 p-4">
              <h2 className="text-sm font-black">Receive ecash</h2>
              <Textarea
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste a cashu token"
                className="h-24 font-mono text-[10px]"
              />
              <Button
                className="rounded-full"
                disabled={wallet.busy || !token.trim()}
                onClick={() => {
                  void wallet.receive(token).then(() => setToken(""));
                }}
              >
                Receive
              </Button>
            </section>
          )}

          {panel === "send" && (
            <section className="kimchi-surface space-y-3 p-4">
              <h2 className="text-sm font-black">Send ecash</h2>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
                <Button
                  className="rounded-full"
                  disabled={wallet.busy || amount <= 0}
                  onClick={() => {
                    void wallet
                      .send(amount)
                      .then((value) => setOutgoing(value));
                  }}
                >
                  Create token
                </Button>
              </div>
              {outgoing && (
                <>
                  <Textarea
                    readOnly
                    value={outgoing}
                    className="h-24 font-mono text-[10px]"
                  />
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void copy(outgoing, "token")}
                  >
                    <IconCopy className="size-4" />
                    {copied === "token" ? "Copied" : "Copy token"}
                  </Button>
                </>
              )}
            </section>
          )}

          {wallet.error && (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-bold text-destructive">
              {wallet.error}
            </p>
          )}

          <section className="kimchi-surface p-4">
            <h2 className="mb-2 text-sm font-black">Mint</h2>
            <div className="flex gap-2">
              <Input
                value={mintDraft}
                onChange={(event) => setMintDraft(event.target.value)}
                placeholder="https://mint.example.com"
                className="min-w-0 flex-1"
              />
              <Button
                className="rounded-full"
                variant="outline"
                onClick={() => setMint(mintDraft.trim())}
              >
                Use
              </Button>
            </div>
            <p className="mt-2 text-[10px] font-semibold text-muted-foreground">
              Balances are stored per account and mint. Use a mint that supports
              NUT-11 P2PK for tab payments.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="px-1 text-[10px] font-black tracking-[0.14em] text-muted-foreground uppercase">
              Activity
            </h2>
            {wallet.history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs font-semibold text-muted-foreground">
                No wallet activity yet.
              </p>
            ) : (
              wallet.history.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-2"
                >
                  <span
                    className={`grid size-8 place-items-center rounded-full ${
                      tx.kind === "send" || tx.kind === "pay"
                        ? "bg-primary/10 text-primary"
                        : "bg-kimchi-green/15 text-kimchi-green-dark"
                    }`}
                  >
                    {tx.kind === "send" || tx.kind === "pay" ? (
                      <IconArrowUpRight size={16} />
                    ) : (
                      <IconArrowDownLeft size={16} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">
                      {txLabel(tx.kind)}
                    </span>
                    <span className="block text-[10px] font-semibold text-muted-foreground">
                      {new Date(tx.at).toLocaleString()}
                      {tx.note ? ` · ${tx.note}` : ""}
                    </span>
                  </span>
                  <span
                    className={`text-sm font-black ${
                      tx.kind === "send" || tx.kind === "pay"
                        ? "text-primary"
                        : "text-kimchi-green-dark"
                    }`}
                  >
                    {tx.kind === "send" || tx.kind === "pay" ? "−" : "+"}
                    {formatSats(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
