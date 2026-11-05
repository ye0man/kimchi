import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { IconArrowRight, IconUserPlus } from "@tabler/icons-react";

import { JarMascot } from "@/components/kimchi/jar-mascot";
import { UserAvatar, UserName } from "@/components/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGroups, useMarmotAccount } from "@/hooks/use-marmot";
import { recordGroupMembers } from "@/lib/contacts";
import { createGroup, inviteKeyPackages } from "@/lib/marmot/actions/invites";
import { describeInviteCandidate } from "@/lib/marmot/invitations";
import {
  parseInviteCard,
  rememberPendingLink,
} from "@/lib/marmot/invite-links";
import "@/styles/kimchi.css";

/** Landing page for a guest-shared invite card. */
export function AddPage() {
  const { code } = useParams<{ code: string }>();
  const card = code ? parseInviteCard(code) : null;
  const account = useMarmotAccount();
  const groups = useGroups() ?? [];
  const navigate = useNavigate();
  const [name, setName] = useState("Kimchi table");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account && card) rememberPendingLink(window.location.href);
  }, [account, card]);

  useEffect(() => {
    if (!selected && groups[0]) setSelected(groups[0].idStr);
  }, [groups, selected]);

  const candidate = useMemo(
    () =>
      account && card ? describeInviteCandidate(card.k, account.pubkey) : null,
    [account, card],
  );

  if (!card) {
    return (
      <Shell>
        <JarMascot />
        <h1 className="kimchi-title">That card is not valid</h1>
        <p className="kimchi-hint">
          Ask your friend to share a fresh invite card.
        </p>
        <Button
          className="w-full rounded-full"
          onClick={() => navigate("/groups")}
        >
          Open Kimchi
        </Button>
      </Shell>
    );
  }

  if (!account) {
    return (
      <Shell>
        <JarMascot full />
        <h1 className="kimchi-title">Add your friend</h1>
        <p className="kimchi-hint">
          Create a private identity first, then come back to this card.
        </p>
        <Button className="w-full rounded-full" asChild>
          <Link to="/signin">
            Create an identity <IconArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </Shell>
    );
  }

  const addToExisting = async (groupId: string) => {
    const group = groups.find((entry) => entry.idStr === groupId);
    if (!group) return;
    setBusy(true);
    setError(null);
    try {
      const eligibility = describeInviteCandidate(
        card.k,
        account.pubkey,
        group,
      );
      if (!eligibility.invitable) {
        throw new Error(
          eligibility.reasons.join(", ") || "That key package cannot join.",
        );
      }
      await inviteKeyPackages(account.client, group, [card.k]);
      recordGroupMembers(account.pubkey, group.idStr, [card.p]);
      navigate(`/groups/${group.idStr}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const createWithFriend = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const relays = await account.requirePublishRelays();
      const created = await createGroup(account.client, name.trim(), {
        relays,
        invitees: [card.k],
      });
      recordGroupMembers(account.pubkey, created.group.idStr, [card.p]);
      created.warnings.forEach((warning) => account.notify(warning));
      navigate(`/groups/${created.group.idStr}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="flex w-full items-center gap-3 rounded-3xl border border-kimchi-line bg-kimchi-soft/70 p-3 text-left">
        <UserAvatar pubkey={card.p} size={48} />
        <div className="min-w-0 flex-1">
          <UserName pubkey={card.p} className="block truncate font-black" />
          <span className="block truncate text-[11px] font-bold text-kimchi-muted">
            {card.p.slice(0, 16)}…
          </span>
        </div>
        <IconUserPlus className="size-5 shrink-0 text-kimchi-red" />
      </div>

      {candidate && !candidate.invitable && (
        <p className="kimchi-error">
          {candidate.reasons.join(", ") || "That key package cannot join."}
        </p>
      )}
      {error && <p className="kimchi-error">{error}</p>}

      {groups.length > 0 && (
        <div className="w-full space-y-2 text-left">
          <div className="text-[10px] font-black tracking-[0.14em] text-kimchi-muted uppercase">
            Add to a table
          </div>
          {groups.map((group) => (
            <button
              key={group.idStr}
              type="button"
              disabled={busy}
              onClick={() => void addToExisting(group.idStr)}
              className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-bold transition-colors ${
                selected === group.idStr
                  ? "border-kimchi-red bg-white"
                  : "border-kimchi-line bg-kimchi-paper hover:bg-white"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                {group.groupData?.name || group.idStr.slice(0, 8)}
              </span>
              <IconArrowRight className="size-4 text-kimchi-muted" />
            </button>
          ))}
        </div>
      )}

      <div className="w-full space-y-2 border-t border-kimchi-line pt-3 text-left">
        <div className="text-[10px] font-black tracking-[0.14em] text-kimchi-muted uppercase">
          Or start a new table
        </div>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Dinner"
          disabled={busy}
        />
        <Button
          className="w-full rounded-full"
          disabled={
            busy || !name.trim() || (candidate ? !candidate.invitable : false)
          }
          onClick={() => void createWithFriend()}
        >
          {busy ? "Working…" : "Create and add"}
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="kimchi-root kimchi-signin">
      <div className="kimchi-card kimchi-signin-card flex flex-col items-center gap-3 text-center">
        {children}
      </div>
    </div>
  );
}
