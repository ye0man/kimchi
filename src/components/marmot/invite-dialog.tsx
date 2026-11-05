import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMarmotAccount } from "@/hooks/use-marmot";
import {
  InviteDeliveryError,
  inviteKeyPackages,
} from "@/lib/marmot/actions/invites";
import { describeInviteCandidate } from "@/lib/marmot/invitations";
import type { InviteCandidate } from "@/lib/marmot/types";
import { formatTimeAgo } from "@/lib/time";
import type { NostrEvent } from "applesauce-core/helpers/event";

export function InviteDialog({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const account = useMarmotAccount();
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<InviteCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keyPackageJson, setKeyPackageJson] = useState("");
  const [keyPackageError, setKeyPackageError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setInput("");
    setResult(null);
    setSelected(new Set());
    setKeyPackageJson("");
    setKeyPackageError(null);
    setSent(false);
    setError(null);
  };

  const search = async () => {
    if (!account || loading || inviting || !input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const group = account.group(groupId);
      const { events } = await account.keyPackageDiscovery.load(
        input.trim(),
        setProgress,
      );
      const candidates = events
        .sort((a, b) => b.created_at - a.created_at)
        .map((event) => describeInviteCandidate(event, account.pubkey, group));
      setResult(candidates);
      setSelected(
        new Set(candidates.filter((c) => c.invitable).map((c) => c.id)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const addKeyPackage = () => {
    if (!account || !keyPackageJson.trim()) return;
    setKeyPackageError(null);
    try {
      const event = JSON.parse(keyPackageJson) as NostrEvent;
      if (!event || event.kind !== 30443 || !event.id || !event.pubkey) {
        throw new Error("That is not a KeyPackage event.");
      }
      const candidate = describeInviteCandidate(
        event,
        account.pubkey,
        account.group(groupId),
      );
      setResult((previous) => [
        ...(previous ?? []).filter((entry) => entry.id !== candidate.id),
        candidate,
      ]);
      if (!candidate.invitable) {
        setKeyPackageError(
          candidate.reasons.join(", ") || "That KeyPackage cannot be used.",
        );
        return;
      }
      setSelected((previous) => new Set(previous).add(candidate.id));
      setKeyPackageJson("");
    } catch (err) {
      setKeyPackageError(err instanceof Error ? err.message : String(err));
    }
  };

  const invite = async () => {
    if (!account || !result || inviting) return;
    setInviting(true);
    setError(null);
    try {
      const events = result
        .filter((c) => selected.has(c.id))
        .map((c) => c.event);
      await inviteKeyPackages(account.client, account.group(groupId), events);
      setSent(true);
      setSelected(new Set());
    } catch (err) {
      if (err instanceof InviteDeliveryError)
        err.failures.forEach((failure) => account.notify(failure));
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Don't let an outside-click/escape close the dialog mid-invite.
        if (inviting || loading) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite to group</DialogTitle>
          <DialogDescription>
            Enter a contact's npub or name@domain. If we cannot find their key
            package, ask them for it instead.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <p
            role="status"
            className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm"
          >
            Invite sent. On the other device, open <strong>Invites</strong> to
            accept and join the group.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void search()}
                placeholder="npub1… or name@domain"
                disabled={loading || inviting}
                autoFocus
              />
              <Button
                onClick={() => void search()}
                disabled={loading || inviting || !input.trim()}
              >
                {loading ? "…" : "Find"}
              </Button>
            </div>

            {loading && (
              <p className="text-sm text-muted-foreground" role="status">
                {progress}
              </p>
            )}
            {result && (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {result.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No published key packages found. Make sure the other device
                    is online and has opened Kimchi once, or paste its key
                    package below.
                  </p>
                )}
                {result.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-start gap-2 rounded border p-2 text-sm"
                  >
                    <Checkbox
                      checked={selected.has(c.id)}
                      disabled={!c.invitable}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                    />
                    <div className="min-w-0">
                      <div className="font-mono text-xs">
                        {c.deviceId ?? "device"} · ref{" "}
                        {c.refHex?.slice(0, 8) ?? "?"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.alreadyMember
                          ? "already a member"
                          : c.invitable
                            ? "invitable"
                            : c.reasons.join(", ") || "not invitable"}
                        {" · "}
                        <span
                          title={new Date(c.createdAt * 1000).toLocaleString()}
                        >
                          published {formatTimeAgo(c.createdAt)}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-md border p-3">
              <label
                htmlFor="invite-key-package"
                className="text-sm font-medium"
              >
                Paste a key package instead
              </label>
              <p className="text-xs text-muted-foreground">
                On the other device, tap the QR button, then{" "}
                <strong>Copy key package</strong>, and paste it here.
              </p>
              <Textarea
                id="invite-key-package"
                value={keyPackageJson}
                onChange={(e) => setKeyPackageJson(e.target.value)}
                placeholder='{"kind":30443,…}'
                rows={2}
                disabled={inviting}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={inviting || !keyPackageJson.trim()}
                onClick={addKeyPackage}
              >
                Add key package
              </Button>
              {keyPackageError && (
                <p className="text-xs text-destructive">{keyPackageError}</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </>
        )}

        <DialogFooter>
          {sent ? (
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          ) : (
            <Button
              onClick={() => void invite()}
              disabled={!result || selected.size === 0 || inviting || loading}
            >
              {inviting
                ? "Inviting…"
                : `Invite ${selected.size > 0 ? `(${selected.size})` : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
