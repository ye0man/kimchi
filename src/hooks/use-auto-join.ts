import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useMarmotAccount, useWatchedInvites } from "@/hooks/use-marmot";
import { joinInvite } from "@/lib/marmot/actions/invites";
import { listPendingJoins, removePendingJoin } from "@/lib/marmot/invite-links";

/**
 * Accept the Welcome that answers a pending join-link request. Matching on the
 * host pubkey is enough: the guest only has an outstanding request for a group
 * that host already holds a link to.
 */
export function useAutoJoin(): string | null {
  const account = useMarmotAccount();
  const invites = useWatchedInvites();
  const navigate = useNavigate();
  const running = useRef(false);
  const [joined, setJoined] = useState<string | null>(null);

  useEffect(() => {
    if (!account || running.current) return;
    const pending = listPendingJoins(account.pubkey);
    if (pending.length === 0) return;
    const match = invites.find(
      (entry) =>
        entry.joinable &&
        pending.some((request) => request.host === entry.invite.pubkey),
    );
    if (!match) return;
    running.current = true;
    void (async () => {
      try {
        const group = await joinInvite(account.client, match.invite.id);
        for (const request of listPendingJoins(account.pubkey)) {
          if (request.host === match.invite.pubkey)
            removePendingJoin(account.pubkey, request.groupId);
        }
        setJoined(group.idStr);
        navigate(`/groups/${group.idStr}`);
      } catch (error) {
        account.notifyError(error);
      } finally {
        running.current = false;
      }
    })();
  }, [account, invites, navigate]);

  return joined;
}
