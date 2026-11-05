import { useEffect, useState } from "react";
import { IconCopy, IconRefresh, IconShare } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QRImage } from "@/components/qr-image";
import { useGroup, useMarmotAccount } from "@/hooks/use-marmot";
import {
  buildJoinLink,
  createInviteToken,
  listInviteTokens,
  revokeInviteToken,
} from "@/lib/marmot/invite-links";

/** Host-side sheet that mints and shares a one-tap join link for a group. */
export function ShareJoinDialog({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const account = useMarmotAccount();
  const group = useGroup(groupId);
  const [link, setLink] = useState("");
  const [expires, setExpires] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mint = () => {
    if (!account || !group) return;
    setError(null);
    try {
      let token = listInviteTokens(account.pubkey, groupId)[0];
      if (!token) {
        token = createInviteToken(account.pubkey, groupId, {
          hours: 24,
          maxUses: 50,
        });
      }
      setLink(
        buildJoinLink({
          groupId,
          host: account.pubkey,
          relays: group.groupData?.relays ?? account.relays,
          nonce: token.nonce,
          expiresAt: token.expiresAt,
          title: group.groupData?.name || undefined,
        }),
      );
      setExpires(token.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (open) mint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account, group]);

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    if (!link) return;
    try {
      await navigator.share({
        title: group?.groupData?.name || "Join my Kimchi table",
        text: "Tap to join my Kimchi table.",
        url: link,
      });
    } catch {
      await copy();
    }
  };

  const revoke = () => {
    if (!account) return;
    const token = listInviteTokens(account.pubkey, groupId)[0];
    if (token) revokeInviteToken(account.pubkey, token.nonce);
    mint();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share this table</DialogTitle>
          <DialogDescription>
            Anyone with this link can ask to join. You add them automatically.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col items-center gap-3">
            <QRImage data={link} className="w-[min(260px,68vw,50dvh)]" />
            <div className="flex w-full gap-2">
              <Button
                className="flex-1 rounded-full"
                onClick={() => void share()}
              >
                <IconShare className="size-4" /> Share
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => void copy()}
              >
                <IconCopy className="size-4" /> {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-center text-[11px] font-semibold text-muted-foreground">
              {expires ? `Expires ${new Date(expires).toLocaleString()}. ` : ""}
              Open this group on your device so join requests can be added.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={revoke}
            >
              <IconRefresh className="size-4" /> New link
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Open the group first, then try again.
          </p>
        )}
        {error && <p className="text-xs font-bold text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
