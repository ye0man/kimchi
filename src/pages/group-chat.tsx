import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, GitFork, Link2, Soup, UserPlus, Users } from "lucide-react";
import { getGroupMembers } from "@internet-privacy/marmot-ts";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { MessageList } from "@/components/chat/message-list";
import { Button } from "@/components/ui/button";
import { Jdenticon } from "@/components/jdenticon";
import { ChatView } from "@/components/chat/chat-view";
import { InviteDialog } from "@/components/marmot/invite-dialog";
import { MembersDialog } from "@/components/marmot/members-dialog";
import { GroupInfoDialog } from "@/components/marmot/group-info-dialog";
import { ShareJoinDialog } from "@/components/marmot/share-join-dialog";
import { recordGroupMembers } from "@/lib/contacts";
import { retryFoundingWelcome } from "@/lib/marmot/actions/invites";
import { useAction, useGroup, useMarmotAccount } from "@/hooks/use-marmot";

export function GroupChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const group = useGroup(id);
  const account = useMarmotAccount();
  const retryWelcome = useAction((account, pubkey: string) =>
    retryFoundingWelcome(account.client, account.group(id!), pubkey),
  );
  const [invite, setInvite] = useState(false);
  const [share, setShare] = useState(false);
  const [members, setMembers] = useState(false);
  const [info, setInfo] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("share") !== "1") return;
    setShare(true);
    const next = new URLSearchParams(searchParams);
    next.delete("share");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!account || !group) return;
    recordGroupMembers(
      account.pubkey,
      group.idStr,
      [...new Set(getGroupMembers(group.state))].filter(
        (pubkey) => pubkey !== account.pubkey,
      ),
    );
  }, [account, group]);

  if (!id) return null;

  if (!group) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {group === null ? "Group not found." : "Loading…"}
      </div>
    );
  }

  const supported = group.profileSupport.kind === "supported";
  const canChat = supported && group.status === "active";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <Button
          size="icon"
          variant="ghost"
          className="md:hidden"
          onClick={() => navigate("/groups")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <button
          type="button"
          onClick={() => setInfo(true)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-accent/50"
          title="Group info"
        >
          <span className="size-8 shrink-0 overflow-hidden rounded-md bg-muted">
            <Jdenticon value={group.idStr} size={32} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">
              {group.groupData?.name || group.idStr.slice(0, 8)}
            </div>
            {group.groupData?.description && (
              <div className="truncate text-xs text-muted-foreground">
                {group.groupData.description}
              </div>
            )}
          </div>
        </button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Share join link"
          title="Share join link"
          disabled={!canChat}
          onClick={() => setShare(true)}
        >
          <Link2 className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Invite to group"
          disabled={!canChat}
          onClick={() => setInvite(true)}
        >
          <UserPlus className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setMembers(true)}>
          <Users className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => navigate(`/groups/${id}/kimchi`)}
          title="Kimchi tab"
        >
          <Soup className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => navigate(`/groups/${id}/debug`)}
          title="Debug: fork graph & pending events"
        >
          <GitFork className="size-4" />
        </Button>
      </header>

      {group.pendingWelcomes.length > 0 && (
        <Alert>
          <AlertTitle>Some founding invites were not delivered</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              These members were added, but their invites need another delivery
              attempt. Retry before reloading; after a reload, remove the
              unreachable members and invite them again with fresh key packages.
            </p>
            {group.pendingWelcomes.map((outcome) => (
              <div
                key={outcome.recipient.keyPackageEventId}
                className="flex items-center gap-2"
              >
                <span className="min-w-0 flex-1 truncate">
                  {outcome.recipient.pubkey.slice(0, 12)}…{" "}
                  {outcome.kind === "failed" && outcome.error}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retryWelcome.pending}
                  onClick={() =>
                    void retryWelcome.run(outcome.recipient.pubkey)
                  }
                >
                  Retry delivery
                </Button>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {!canChat && (
        <Alert>
          <AlertTitle>
            {supported ? `Group ${group.status}` : "Older group profile"}
          </AlertTitle>
          <AlertDescription>
            {supported
              ? "This group is read-only."
              : "This group cannot send or receive new messages after the upgrade. Your saved messages remain readable. Create a new group and invite the members again. You can remove this group's local data from Group info."}
          </AlertDescription>
        </Alert>
      )}
      <div className="min-h-0 flex-1">
        {canChat ? (
          <ChatView key={id} groupId={id} />
        ) : (
          <div className="flex h-full flex-col">
            <MessageList groupId={id} readOnly />
          </div>
        )}
      </div>

      <InviteDialog groupId={id} open={invite} onOpenChange={setInvite} />
      <ShareJoinDialog groupId={id} open={share} onOpenChange={setShare} />
      <MembersDialog groupId={id} open={members} onOpenChange={setMembers} />
      <GroupInfoDialog groupId={id} open={info} onOpenChange={setInfo} />
    </div>
  );
}
