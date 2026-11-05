import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/copy-button";
import { QRImage } from "@/components/qr-image";
import { useKeyPackages, useMarmotAccount } from "@/hooks/use-marmot";
import { selectDeviceKeyPackage } from "@/lib/marmot/key-packages";
import { buildInviteCard } from "@/lib/marmot/invite-links";

/**
 * Shows the account's npub and a shareable invite card. Other Marmot/Nostr apps
 * can scan the npub; Kimchi hosts can scan the card to add this person in one tap.
 */
export function MyQrDialog({
  npub,
  open,
  onOpenChange,
}: {
  npub: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const account = useMarmotAccount();
  const packages = useKeyPackages();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"npub" | "card">("npub");
  const current = account
    ? selectDeviceKeyPackage(packages, account.clientId)
    : undefined;
  const keyPackage = current?.published?.length
    ? [...current.published].sort((a, b) => b.created_at - a.created_at)[0]
    : undefined;

  const cardUrl =
    account && keyPackage
      ? buildInviteCard({ pubkey: account.pubkey, keyPackage })
      : null;

  const publish = async () => {
    if (!account) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await account.ensureKeyPackage();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (!open || !account) return;
    let active = true;
    setPublishing(true);
    setPublishError(null);
    account
      .ensureKeyPackage()
      .catch((err) => {
        if (active)
          setPublishError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setPublishing(false);
      });
    return () => {
      active = false;
    };
  }, [open, account]);

  const data = mode === "card" && cardUrl ? cardUrl : npub;

  const share = async () => {
    if (!cardUrl) return;
    try {
      await navigator.share({
        title: "Join my Kimchi table",
        text: "Scan or tap this to add me on Kimchi.",
        url: cardUrl,
      });
    } catch {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan to invite me</DialogTitle>
          <DialogDescription>
            {mode === "npub"
              ? "Other apps can scan this to discover your account."
              : "A Kimchi host can scan or tap this card to add you in one step."}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-1 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-black ${
              mode === "npub"
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground"
            }`}
            onClick={() => setMode("npub")}
          >
            My npub
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-black ${
              mode === "card"
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground"
            }`}
            onClick={() => setMode("card")}
            disabled={!cardUrl}
          >
            Invite card
          </button>
        </div>

        <div className="flex w-full min-w-0 flex-col items-center gap-4">
          <QRImage data={data} className="w-[min(280px,70vw,55dvh)]" />

          {mode === "card" && cardUrl ? (
            <Button
              className="w-full rounded-full"
              onClick={() => void share()}
            >
              {copied ? "Invite link copied" : "Share invite card"}
            </Button>
          ) : (
            <div className="flex w-full items-center gap-2 rounded-md bg-muted p-2">
              <code className="min-w-0 flex-1 truncate text-xs">{npub}</code>
              <CopyButton text={npub} variant="ghost" size="icon" />
            </div>
          )}

          {keyPackage ? (
            <div className="w-full space-y-1">
              <p className="text-xs text-muted-foreground">
                If relay discovery fails, copy this key package and paste it
                into the host&apos;s <strong>Invite</strong> dialog under{" "}
                <strong>Paste a key package instead</strong>.
              </p>
              {current?.used && (
                <p className="text-xs text-destructive">
                  This package was already used by an earlier invite. Rotate it
                  in <strong>Settings → Key packages</strong>, then copy the new
                  one.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    JSON.stringify(keyPackage),
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied" : "Copy key package"}
              </Button>
              {cardUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full"
                  onClick={async () => {
                    await navigator.clipboard.writeText(cardUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  Copy invite link
                </Button>
              )}
              <details className="w-full">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Show key package JSON
                </summary>
                <textarea
                  id="my-key-package"
                  readOnly
                  value={JSON.stringify(keyPackage)}
                  className="mt-1 h-24 w-full rounded-md border bg-muted p-2 text-[10px]"
                />
              </details>
            </div>
          ) : (
            <div className="w-full space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">No key package yet</p>
              <p className="text-xs text-muted-foreground">
                {publishing
                  ? "Publishing your key package…"
                  : "This device needs to publish a key package before a host can invite it."}
              </p>
              {publishError && (
                <p className="text-xs text-destructive">{publishError}</p>
              )}
              {!publishing && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full"
                  onClick={() => void publish()}
                >
                  Publish key package
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
