import { useState } from "react";
import { useNavigate } from "react-router";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGroup, useMarmotAccount } from "@/hooks/use-marmot";
import { useKimchiMessages, useKimchiState } from "@/lib/kimchi/use-kimchi";
import { openTabStatus } from "@/lib/kimchi/tab-status";
import { clearSecrets } from "@/lib/kimchi/cashu";
import { formatSats } from "@/lib/kimchi/rate";
import { disbandGroup } from "@/lib/marmot/actions/group-admin";

/**
 * Owner-facing permanent group deletion. Warns when a tab is still open and
 * has unpaid shares, but still lets the host delete anyway.
 */
export function DeleteGroupDialog({
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
  const messages = useKimchiMessages(groupId);
  const { tab, paid, closing } = useKimchiState(messages);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    open: tabOpen,
    openShares,
    unpaid,
    outstanding,
  } = openTabStatus({
    tab,
    paid,
    closing,
    groupStatus: group?.status,
  });

  const remove = async () => {
    if (!account || !group) return;
    setBusy(true);
    setError(null);
    try {
      await disbandGroup(account.client, group);
      if (tab) clearSecrets(tab.tab_id);
      onOpenChange(false);
      navigate("/groups");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <IconTrash size={20} /> Delete this group?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes{" "}
            <strong>{group?.groupData?.name || groupId.slice(0, 8)}</strong> for
            everyone. The chat and its local history cannot be recovered.
          </DialogDescription>
        </DialogHeader>

        {tabOpen ? (
          <div className="rounded-2xl border border-amber-400/50 bg-amber-50 p-3 text-amber-950">
            <div className="flex items-center gap-2 text-sm font-black">
              <IconAlertTriangle size={17} />
              {unpaid.length > 0
                ? "Open tab is not fully paid"
                : "The tab is still open"}
            </div>
            <p className="mt-1 text-xs font-semibold">
              {unpaid.length > 0
                ? `${unpaid.length} of ${openShares.length} shares are unpaid (${formatSats(outstanding)} sats outstanding). Deleting now closes the tab and discards pending payments.`
                : "The tab is fully paid but has not been closed. Deleting the group will remove the settled tab and chat."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-muted/50 p-3 text-xs font-semibold text-muted-foreground">
            There is no open tab in this group.
          </div>
        )}

        {error && (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-bold text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            className="w-full rounded-full"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy
              ? "Deleting…"
              : tabOpen && unpaid.length > 0
                ? "Delete anyway"
                : "Delete group"}
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-full"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Keep group open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
