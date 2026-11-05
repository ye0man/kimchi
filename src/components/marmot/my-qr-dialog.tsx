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

/**
 * Shows the account's npub as a scannable QR code. Other Marmot/Nostr apps can
 * scan it to discover this account (and its published key package) and send an
 * invite.
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
  const current =
    packages.find((pkg) => pkg.identifier === account?.clientId) ??
    packages.find((pkg) => (pkg.published?.length ?? 0) > 0);
  const keyPackage = current?.published?.[0];

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan to invite me</DialogTitle>
          <DialogDescription>
            Other apps can scan this to invite you to a group.
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full min-w-0 flex-col items-center gap-4">
          {/* Cap by both width and height so the code never overflows a small
              or short (landscape) screen. */}
          <QRImage data={npub} className="w-[min(280px,70vw,55dvh)]" />
          <div className="flex w-full items-center gap-2 rounded-md bg-muted p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{npub}</code>
            <CopyButton text={npub} variant="ghost" size="icon" />
          </div>
          {keyPackage ? (
            <div className="w-full space-y-1">
              <p className="text-xs text-muted-foreground">
                If relay discovery fails, copy this key package and paste it
                into the host&apos;s <strong>Invite</strong> dialog under{" "}
                <strong>Paste a key package instead</strong>.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
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
                  className="w-full"
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
